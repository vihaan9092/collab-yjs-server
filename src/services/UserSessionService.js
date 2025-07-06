/**
 * User Session Management Service
 * Handles user sessions, permissions, and document access control
 */

const Redis = require('ioredis');
const Logger = require('../utils/Logger');
const AuthConfig = require('../config/AuthConfig');

class UserSessionService {
    constructor(config = {}) {
        this.redisUrl = config.redisUrl || AuthConfig.redis.url;
        this.keyPrefix = AuthConfig.redis.keyPrefix;
        
        // Initialize Redis for session storage
        this.redis = new Redis(this.redisUrl, {
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            keyPrefix: this.keyPrefix
        });
        
        this.logger = Logger;
        
        // Track active sessions
        this.activeSessions = new Map();
        this.userConnections = new Map(); // userId -> Set of connectionIds
        this.documentSessions = new Map(); // documentId -> Set of userIds
        
        this.redis.on('connect', () => {
            this.logger.info('Redis connected for user sessions');
        });
        
        this.redis.on('error', (err) => {
            this.logger.error('Redis session error:', err);
        });
    }

    /**
     * Create a new user session
     * @param {Object} user - User object
     * @param {string} connectionId - WebSocket connection ID
     * @param {string} documentId - Document ID
     * @returns {Object} Session information
     */
    async createSession(user, connectionId, documentId) {
        try {
            const sessionId = `session:${user.id}:${connectionId}`;
            const sessionData = {
                userId: user.id,
                username: user.username,
                email: user.email,
                connectionId,
                documentId,
                permissions: user.permissions || [],
                groups: user.groups || [],
                createdAt: new Date().toISOString(),
                lastActivity: new Date().toISOString(),
                isActive: true
            };

            // Store session in Redis
            await this.redis.setex(
                sessionId, 
                AuthConfig.redis.ttl.userSession, 
                JSON.stringify(sessionData)
            );

            // Track in memory for quick access
            this.activeSessions.set(connectionId, sessionData);

            // Track user connections
            if (!this.userConnections.has(user.id)) {
                this.userConnections.set(user.id, new Set());
            }
            this.userConnections.get(user.id).add(connectionId);

            // Track document sessions
            if (!this.documentSessions.has(documentId)) {
                this.documentSessions.set(documentId, new Set());
            }
            this.documentSessions.get(documentId).add(user.id);

            // Update user presence
            await this.updateUserPresence(user.id, documentId, 'online');

            this.logger.info('User session created', {
                userId: user.id,
                connectionId,
                documentId,
                sessionId
            });

            return sessionData;

        } catch (error) {
            this.logger.error('Failed to create user session', {
                userId: user.id,
                connectionId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Get session by connection ID
     * @param {string} connectionId - WebSocket connection ID
     * @returns {Object} Session data
     */
    async getSession(connectionId) {
        try {
            // Check memory first
            if (this.activeSessions.has(connectionId)) {
                return this.activeSessions.get(connectionId);
            }

            // Check Redis
            const sessionKeys = await this.redis.keys(`session:*:${connectionId}`);
            if (sessionKeys.length > 0) {
                const sessionData = await this.redis.get(sessionKeys[0]);
                if (sessionData) {
                    const session = JSON.parse(sessionData);
                    this.activeSessions.set(connectionId, session);
                    return session;
                }
            }

            return null;

        } catch (error) {
            this.logger.error('Failed to get session', {
                connectionId,
                error: error.message
            });
            return null;
        }
    }

    /**
     * Update session activity
     * @param {string} connectionId - WebSocket connection ID
     */
    async updateActivity(connectionId) {
        try {
            const session = await this.getSession(connectionId);
            if (!session) return;

            session.lastActivity = new Date().toISOString();
            
            // Update in memory
            this.activeSessions.set(connectionId, session);

            // Update in Redis
            const sessionId = `session:${session.userId}:${connectionId}`;
            await this.redis.setex(
                sessionId,
                AuthConfig.redis.ttl.userSession,
                JSON.stringify(session)
            );

        } catch (error) {
            this.logger.error('Failed to update session activity', {
                connectionId,
                error: error.message
            });
        }
    }

    /**
     * Validate document access for a session
     * @param {string} connectionId - WebSocket connection ID
     * @param {string} documentId - Document ID
     * @returns {Object} Access validation result
     */
    async validateDocumentAccess(connectionId, documentId) {
        try {
            const session = await this.getSession(connectionId);
            if (!session) {
                return { hasAccess: false, reason: 'No active session' };
            }

            // Check if user has access to this document
            const accessInfo = await this.djangoService.checkDocumentAccess(
                session.token || '',
                session.userId,
                documentId
            );

            if (!accessInfo.hasAccess) {
                return { hasAccess: false, reason: 'Access denied by Django' };
            }

            // Update session with document access info
            session.documentAccess = {
                [documentId]: {
                    permissions: accessInfo.permissions,
                    role: accessInfo.role,
                    lastChecked: new Date().toISOString()
                }
            };

            this.activeSessions.set(connectionId, session);

            return {
                hasAccess: true,
                permissions: accessInfo.permissions,
                role: accessInfo.role
            };

        } catch (error) {
            this.logger.error('Document access validation failed', {
                connectionId,
                documentId,
                error: error.message
            });
            return { hasAccess: false, reason: 'Validation error' };
        }
    }

    /**
     * Remove session on disconnect
     * @param {string} connectionId - WebSocket connection ID
     */
    async removeSession(connectionId) {
        try {
            const session = await this.getSession(connectionId);
            if (!session) return;

            const { userId, documentId } = session;

            // Remove from Redis
            const sessionId = `session:${userId}:${connectionId}`;
            await this.redis.del(sessionId);

            // Remove from memory
            this.activeSessions.delete(connectionId);

            // Update user connections tracking
            if (this.userConnections.has(userId)) {
                this.userConnections.get(userId).delete(connectionId);
                if (this.userConnections.get(userId).size === 0) {
                    this.userConnections.delete(userId);
                    
                    // Update user presence to offline if no more connections
                    await this.updateUserPresence(userId, documentId, 'offline');
                }
            }

            // Update document sessions tracking
            if (this.documentSessions.has(documentId)) {
                // Check if user has other connections to this document
                const userHasOtherConnections = this.userConnections.has(userId) &&
                    Array.from(this.userConnections.get(userId)).some(connId => {
                        const otherSession = this.activeSessions.get(connId);
                        return otherSession && otherSession.documentId === documentId;
                    });

                if (!userHasOtherConnections) {
                    this.documentSessions.get(documentId).delete(userId);
                    if (this.documentSessions.get(documentId).size === 0) {
                        this.documentSessions.delete(documentId);
                    }
                }
            }

            // Notify Django about user disconnect
            if (session.user) {
                await this.djangoService.notifyUserActivity(
                    session.user,
                    documentId,
                    'disconnect'
                );
            }

            this.logger.info('User session removed', {
                userId,
                connectionId,
                documentId
            });

        } catch (error) {
            this.logger.error('Failed to remove session', {
                connectionId,
                error: error.message
            });
        }
    }

    /**
     * Get active users for a document
     * @param {string} documentId - Document ID
     * @returns {Array} List of active users
     */
    getActiveUsers(documentId) {
        const activeUsers = [];
        
        if (this.documentSessions.has(documentId)) {
            for (const userId of this.documentSessions.get(documentId)) {
                const userConnections = this.userConnections.get(userId);
                if (userConnections && userConnections.size > 0) {
                    // Get user info from any active session
                    const connectionId = Array.from(userConnections)[0];
                    const session = this.activeSessions.get(connectionId);
                    if (session) {
                        activeUsers.push({
                            id: session.userId,
                            username: session.username,
                            email: session.email,
                            connectionCount: userConnections.size,
                            lastActivity: session.lastActivity
                        });
                    }
                }
            }
        }

        return activeUsers;
    }

    /**
     * Update user presence status
     * @param {string} userId - User ID
     * @param {string} documentId - Document ID
     * @param {string} status - Presence status (online/offline/away)
     */
    async updateUserPresence(userId, documentId, status) {
        try {
            const presenceKey = `presence:${documentId}:${userId}`;
            const presenceData = {
                userId,
                documentId,
                status,
                timestamp: new Date().toISOString()
            };

            if (status === 'offline') {
                await this.redis.del(presenceKey);
            } else {
                await this.redis.setex(presenceKey, 300, JSON.stringify(presenceData)); // 5 minutes
            }

        } catch (error) {
            this.logger.error('Failed to update user presence', {
                userId,
                documentId,
                status,
                error: error.message
            });
        }
    }

    /**
     * Get session statistics
     * @returns {Object} Session statistics
     */
    getSessionStats() {
        return {
            activeSessions: this.activeSessions.size,
            activeUsers: this.userConnections.size,
            activeDocuments: this.documentSessions.size,
            totalConnections: Array.from(this.userConnections.values())
                .reduce((total, connections) => total + connections.size, 0)
        };
    }

    /**
     * Clean up expired sessions
     */
    async cleanupExpiredSessions() {
        try {
            const now = Date.now();
            const expiredConnections = [];

            for (const [connectionId, session] of this.activeSessions) {
                const lastActivity = new Date(session.lastActivity).getTime();
                const sessionAge = now - lastActivity;
                
                // Remove sessions older than 1 hour of inactivity
                if (sessionAge > 3600000) {
                    expiredConnections.push(connectionId);
                }
            }

            for (const connectionId of expiredConnections) {
                await this.removeSession(connectionId);
            }

            if (expiredConnections.length > 0) {
                this.logger.info('Cleaned up expired sessions', {
                    count: expiredConnections.length
                });
            }

        } catch (error) {
            this.logger.error('Session cleanup failed', error);
        }
    }

    /**
     * Close service and connections
     */
    async close() {
        if (this.redis) {
            await this.redis.quit();
        }
        if (this.djangoService) {
            await this.djangoService.close();
        }
    }
}

module.exports = UserSessionService;
