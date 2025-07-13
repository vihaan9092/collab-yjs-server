

const jwt = require('jsonwebtoken');
const Redis = require('ioredis');
const Logger = require('../utils/Logger');

class AuthMiddleware {
    constructor(config = {}) {
        this.jwtSecret = config.jwtSecret || process.env.JWT_SECRET || 'your-secret-key';
        this.redisUrl = config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
        this.testMode = config.testMode || process.env.AUTH_TEST_MODE === 'true';
        
        this.redis = new Redis(this.redisUrl, {
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 3,
            lazyConnect: true
        });

        this.logger = new Logger();

        this.redis.on('connect', () => {
            this.logger.info('Redis connected for authentication cache');
        });

        this.redis.on('error', (err) => {
            this.logger.error('Redis connection error:', err);
        });
    }

    validateJWTSyntax(token) {
        try {
            const cleanToken = token.replace(/^Bearer\s+/, '');

            if (cleanToken.length < 10) {
                return { isValid: false, error: 'Token too short' };
            }
            const parts = cleanToken.split('.');
            if (parts.length !== 3) {
                return { isValid: false, error: 'JWT must have exactly 3 parts (header.payload.signature)' };
            }

            // Each part must be non-empty
            if (parts.some(part => !part || part.length === 0)) {
                return { isValid: false, error: 'JWT parts cannot be empty' };
            }

            // Each part must be valid base64url
            for (let i = 0; i < parts.length; i++) {
                if (!this.isValidBase64Url(parts[i])) {
                    const partNames = ['header', 'payload', 'signature'];
                    return { isValid: false, error: `Invalid base64url encoding in ${partNames[i]}` };
                }
            }

            // Try to decode header and payload to ensure they're valid JSON
            try {
                const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
                const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

                // Header must have 'typ' and 'alg' fields
                if (!header.typ || !header.alg) {
                    return { isValid: false, error: 'JWT header missing required fields (typ, alg)' };
                }

                // Header typ should be 'JWT'
                if (header.typ !== 'JWT') {
                    return { isValid: false, error: 'JWT header typ must be "JWT"' };
                }

                // Algorithm should be supported
                const supportedAlgorithms = ['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512'];
                if (!supportedAlgorithms.includes(header.alg)) {
                    return { isValid: false, error: `Unsupported algorithm: ${header.alg}` };
                }

                // Payload should have standard claims
                if (!payload.exp && !payload.iat) {
                    return { isValid: false, error: 'JWT payload missing expiration (exp) or issued at (iat) claims' };
                }

                // Check expiration format
                if (payload.exp && (typeof payload.exp !== 'number' || payload.exp <= 0)) {
                    return { isValid: false, error: 'JWT exp claim must be a positive number' };
                }

                // Check issued at format
                if (payload.iat && (typeof payload.iat !== 'number' || payload.iat <= 0)) {
                    return { isValid: false, error: 'JWT iat claim must be a positive number' };
                }

                return { isValid: true, header, payload };

            } catch (decodeError) {
                return { isValid: false, error: 'JWT header or payload is not valid JSON' };
            }

        } catch (error) {
            return { isValid: false, error: `JWT validation error: ${error.message}` };
        }
    }

    /**
     * Check if string is valid base64url encoding
     * @param {string} str - String to check
     * @returns {boolean} - True if valid base64url
     */
    isValidBase64Url(str) {
        if (!str || typeof str !== 'string') {
            return false;
        }

        // Base64url uses A-Z, a-z, 0-9, -, _ and no padding
        // But we need to be more lenient for real-world JWTs
        const base64urlRegex = /^[A-Za-z0-9_-]+$/;

        // Try the strict check first
        if (base64urlRegex.test(str)) {
            return true;
        }

        // If strict check fails, try to validate by attempting to decode
        try {
            // Convert base64url to base64 if needed
            let base64 = str.replace(/-/g, '+').replace(/_/g, '/');

            // Add padding if needed
            while (base64.length % 4) {
                base64 += '=';
            }

            // Try to decode
            Buffer.from(base64, 'base64');
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Validate JWT token and extract user information
     * @param {string} token - JWT token from client
     * @returns {Object} - User information or null if invalid
     */
    async validateToken(token) {
        try {
            if (!token) {
                throw new Error('No token provided');
            }

            // Ensure token is a string and handle URL encoding
            let cleanToken = String(token);

            // Decode URL-encoded token if necessary
            try {
                if (cleanToken.includes('%')) {
                    cleanToken = decodeURIComponent(cleanToken);
                }
            } catch (decodeError) {
                this.logger.warn('Failed to decode URL-encoded token', {
                    service: 'realtime-yjs-server',
                    error: decodeError.message
                });
            }

            // Comprehensive JWT syntax validation
            const jwtValidation = this.validateJWTSyntax(cleanToken);
            if (!jwtValidation.isValid) {
                this.logger.warn('JWT syntax validation failed', {
                    service: 'realtime-yjs-server',
                    error: jwtValidation.error,
                    tokenLength: cleanToken.length
                });
                throw new Error(`Invalid JWT format: ${jwtValidation.error}`);
            }

            this.logger.debug('Starting token validation', {
                service: 'realtime-yjs-server',
                testMode: this.testMode,
                tokenLength: cleanToken.length,
                hasJwtSecret: !!this.jwtSecret
            });

            if (this.testMode) {
                this.logger.info('Test mode enabled - bypassing JWT verification', {
                    service: 'realtime-yjs-server',
                    tokenLength: cleanToken.length
                });

                this.logger.debug('Test mode token processing', {
                    service: 'realtime-yjs-server',
                    tokenPreview: cleanToken.substring(0, Math.min(20, cleanToken.length)) + '...'
                });

                // Try to decode the token without verification to extract user info
                let userInfo = {};
                try {
                    const decoded = jwt.decode(cleanToken);
                    if (decoded) {
                        userInfo = {
                            userId: decoded.user_id || decoded.userId || decoded.sub || 1,
                            username: decoded.username || 'testuser',
                            email: decoded.email || 'test@example.com',
                            permissions: decoded.permissions || ['read', 'write'],
                            exp: decoded.exp,
                            iat: decoded.iat
                        };
                    }
                } catch (decodeError) {
                    this.logger.info('Could not decode token, using default test user', {
                        service: 'realtime-yjs-server'
                    });
                }

                // Return default test user if decoding failed
                return {
                    userId: userInfo.userId || 1,
                    username: userInfo.username || 'testuser',
                    email: userInfo.email || 'test@example.com',
                    permissions: userInfo.permissions || ['read', 'write'],
                    exp: userInfo.exp || Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
                    iat: userInfo.iat || Math.floor(Date.now() / 1000)
                };
            }

            const decoded = jwt.verify(cleanToken, this.jwtSecret);

            this.logger.info('JWT verification successful', {
                service: 'realtime-yjs-server',
                userId: decoded.user_id || decoded.sub,
                username: decoded.username,
                exp: decoded.exp,
                currentTime: Math.floor(Date.now() / 1000)
            });

            // Check if token is expired
            if (decoded.exp && Date.now() >= decoded.exp * 1000) {
                throw new Error('Token expired');
            }

            return {
                userId: decoded.user_id || decoded.sub,
                username: decoded.username,
                email: decoded.email,
                permissions: decoded.permissions || [],
                exp: decoded.exp,
                iat: decoded.iat
            };
        } catch (error) {
            this.logger.warn('Token validation failed:', {
                service: 'realtime-yjs-server',
                error: error.message,
                errorName: error.name,
                tokenLength: token ? token.length : 0,
                secretSet: this.jwtSecret ? 'YES' : 'NO',
                testMode: this.testMode,
                tokenPreview: token ? token.substring(0, 50) + '...' : 'none'
            });
            return null;
        }
    }

    /**
     * Create user object from JWT token information
     * @param {Object} userInfo - User information from JWT
     * @returns {Object} - User data with permissions
     */
    async createUserFromJWT(userInfo) {
        try {
            this.logger.info('Creating user from JWT token', {
                userId: userInfo.user_id || userInfo.userId,
                username: userInfo.username,
                service: 'realtime-yjs-server'
            });

            // Create user object from JWT claims
            const user = {
                id: userInfo.user_id || userInfo.userId || userInfo.sub,
                username: userInfo.username || `user_${userInfo.user_id || userInfo.userId || userInfo.sub}`,
                email: userInfo.email || `${userInfo.username || 'user'}@example.com`,
                firstName: userInfo.first_name || userInfo.firstName || '',
                lastName: userInfo.last_name || userInfo.lastName || '',
                permissions: userInfo.permissions || ['read', 'write'],
                groups: userInfo.groups || [],
                isActive: true, // If JWT is valid, user is considered active
                isStaff: userInfo.is_staff || userInfo.isStaff || false,
                lastLogin: new Date().toISOString(),
                // Additional fields from JWT
                documentAccess: userInfo.document_access || [], // List of accessible document IDs
                roles: userInfo.roles || [],
                exp: userInfo.exp,
                iat: userInfo.iat
            };

            // Cache user data for token lifetime or 15 minutes, whichever is shorter
            const cacheKey = `user:${user.id}`;
            const cacheTime = userInfo.exp ?
                Math.min(userInfo.exp - Math.floor(Date.now() / 1000), 900) : 900;

            if (cacheTime > 0) {
                await this.redis.setex(cacheKey, cacheTime, JSON.stringify(user));
            }

            this.logger.info('User created from JWT successfully', {
                userId: user.id,
                username: user.username,
                permissions: user.permissions.length,
                service: 'realtime-yjs-server'
            });

            return user;

        } catch (error) {
            this.logger.error('Failed to create user from JWT:', {
                userId: userInfo.user_id || userInfo.userId,
                error: error.message,
                service: 'realtime-yjs-server'
            });
            return null;
        }
    }

    /**
     * Check if user has permission to access a document
     * @param {Object} user - User object
     * @param {string} documentId - Document ID
     * @returns {boolean} - Whether user can access document
     */
    checkDocumentAccess(user, documentId) {
        try {
            this.logger.info('Checking document access', {
                userId: user.id,
                documentId,
                service: 'realtime-yjs-server'
            });

            // Check if user has specific document access list in JWT
            if (user.documentAccess && Array.isArray(user.documentAccess)) {
                const hasAccess = user.documentAccess.includes(documentId) ||
                                user.documentAccess.includes('*'); // '*' means access to all documents

                this.logger.info('Document access check via JWT document list', {
                    userId: user.id,
                    documentId,
                    hasAccess,
                    documentAccessList: user.documentAccess,
                    service: 'realtime-yjs-server'
                });

                return hasAccess;
            }

            // Check permissions-based access
            if (user.permissions && Array.isArray(user.permissions)) {
                // Allow access if user has general document permissions
                const hasDocumentPermission = user.permissions.some(permission =>
                    permission.includes('document') ||
                    permission.includes('read') ||
                    permission.includes('write') ||
                    permission.includes('edit') ||
                    permission === '*'
                );

                if (hasDocumentPermission) {
                    this.logger.info('Document access granted via permissions', {
                        userId: user.id,
                        documentId,
                        permissions: user.permissions,
                        service: 'realtime-yjs-server'
                    });
                    return true;
                }
            }

            // Check role-based access
            if (user.roles && Array.isArray(user.roles)) {
                const hasDocumentRole = user.roles.some(role =>
                    role.includes('editor') ||
                    role.includes('collaborator') ||
                    role.includes('admin') ||
                    role === 'user'
                );

                if (hasDocumentRole) {
                    this.logger.info('Document access granted via roles', {
                        userId: user.id,
                        documentId,
                        roles: user.roles,
                        service: 'realtime-yjs-server'
                    });
                    return true;
                }
            }

            // Default: allow access for authenticated users (can be configured)
            const defaultAccess = process.env.DEFAULT_DOCUMENT_ACCESS !== 'false';

            this.logger.info('Document access check - using default policy', {
                userId: user.id,
                documentId,
                defaultAccess,
                service: 'realtime-yjs-server'
            });

            return defaultAccess;

        } catch (error) {
            this.logger.error('Document access check failed:', {
                userId: user.id,
                documentId,
                error: error.message,
                service: 'realtime-yjs-server'
            });
            // Default to deny access on error
            return false;
        }
    }

    /**
     * Authenticate WebSocket connection
     * @param {Object} socket - WebSocket connection
     * @param {Function} next - Next middleware function
     */
    async authenticateConnection(socket, next) {
        try {
            const token = socket.handshake.auth?.token ||
                         socket.handshake.headers?.authorization ||
                         socket.handshake.query?.token;

            if (!token) {
                return next(new Error('Authentication token required'));
            }

            // Validate JWT token
            const userInfo = await this.validateToken(token);
            if (!userInfo) {
                return next(new Error('Invalid or expired token'));
            }

            // Create user from JWT claims (no Django dependency)
            userInfo.token = token.replace(/^Bearer\s+/, '');
            const user = await this.createUserFromJWT(userInfo);
            if (!user || !user.isActive) {
                return next(new Error('User not found or inactive'));
            }

            // Attach user info to socket
            socket.user = user;
            socket.user.token = userInfo.token;

            this.logger.info('WebSocket connection authenticated', {
                userId: user.id,
                username: user.username,
                socketId: socket.id,
                service: 'realtime-yjs-server'
            });

            next();

        } catch (error) {
            this.logger.error('WebSocket authentication failed:', {
                error: error.message,
                service: 'realtime-yjs-server'
            });
            next(new Error('Authentication failed'));
        }
    }

    /**
     * Middleware for document access authorization
     * @param {Object} socket - WebSocket connection
     * @param {string} documentId - Document ID to access
     * @returns {boolean} - Whether access is granted
     */
    authorizeDocumentAccess(socket, documentId) {
        try {
            if (!socket.user) {
                this.logger.warn('Unauthorized document access attempt', {
                    documentId,
                    service: 'realtime-yjs-server'
                });
                return false;
            }

            const hasAccess = this.checkDocumentAccess(socket.user, documentId);

            if (hasAccess) {
                this.logger.info('Document access granted', {
                    userId: socket.user.id,
                    documentId,
                    socketId: socket.id,
                    service: 'realtime-yjs-server'
                });
            } else {
                this.logger.warn('Document access denied', {
                    userId: socket.user.id,
                    documentId,
                    socketId: socket.id,
                    service: 'realtime-yjs-server'
                });
            }

            return hasAccess;

        } catch (error) {
            this.logger.error('Document authorization error:', {
                error: error.message,
                service: 'realtime-yjs-server'
            });
            return false;
        }
    }



    /**
     * Close Redis connection
     */
    async close() {
        if (this.redis) {
            await this.redis.quit();
        }
    }
}

module.exports = AuthMiddleware;
