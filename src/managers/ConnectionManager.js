const IConnectionManager = require('../interfaces/IConnectionManager');
const { docs } = require('../utils/y-websocket-utils');

/**
 * Connection Manager Implementation for y-websocket
 * Follows Single Responsibility Principle - manages only WebSocket connections
 * Follows Dependency Inversion Principle - depends on abstractions (Logger)
 * Now works with y-websocket's connection management
 */
class ConnectionManager extends IConnectionManager {
  constructor(logger) {
    super();
    this.logger = logger;
    this.connections = new Map(); // connectionId -> connection metadata
    this.documentConnections = new Map(); // documentId -> Set of connectionIds
  }

  addConnection(connectionId, ws, metadata = {}) {
    try {
      const connection = {
        id: connectionId,
        ws: ws,
        documentId: metadata.documentId,
        userId: metadata.userId,
        joinedAt: new Date(),
        lastActivity: new Date(),
        ...metadata
      };

      this.connections.set(connectionId, connection);

      // Track document connections
      if (connection.documentId) {
        if (!this.documentConnections.has(connection.documentId)) {
          this.documentConnections.set(connection.documentId, new Set());
        }
        this.documentConnections.get(connection.documentId).add(connectionId);
      }

      this.logger.info('Connection added', {
        connectionId,
        documentId: connection.documentId,
        userId: connection.userId
      });

      return connection;
    } catch (error) {
      this.logger.error('Failed to add connection', error, { connectionId });
      throw error;
    }
  }

  removeConnection(connectionId) {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        this.logger.warn('Attempted to remove non-existent connection', { connectionId });
        return false;
      }

      // Remove from document connections
      if (connection.documentId) {
        const docConnections = this.documentConnections.get(connection.documentId);
        if (docConnections) {
          docConnections.delete(connectionId);
          if (docConnections.size === 0) {
            this.documentConnections.delete(connection.documentId);
          }
        }
      }

      this.connections.delete(connectionId);

      this.logger.info('Connection removed', {
        connectionId,
        documentId: connection.documentId,
        duration: Date.now() - connection.joinedAt.getTime()
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to remove connection', error, { connectionId });
      throw error;
    }
  }

  getConnection(connectionId) {
    return this.connections.get(connectionId) || null;
  }

  getConnectionsByDocument(documentId) {
    // Get connections from y-websocket's document
    const doc = docs.get(documentId);
    if (!doc) return [];

    // Convert WebSocket connections to our connection format
    const connections = [];
    doc.conns.forEach((controlledIds, ws) => {
      // Try to find our connection metadata
      const connectionId = this.findConnectionIdByWs(ws);
      const connection = connectionId ? this.connections.get(connectionId) : null;

      if (connection) {
        connections.push(connection);
      } else {
        // Create a minimal connection object if we don't have metadata
        connections.push({
          id: `ws-${Date.now()}-${Math.random()}`,
          ws: ws,
          documentId: documentId,
          joinedAt: new Date(),
          lastActivity: new Date()
        });
      }
    });

    return connections;
  }

  findConnectionIdByWs(ws) {
    for (const [connectionId, connection] of this.connections) {
      if (connection.ws === ws) {
        return connectionId;
      }
    }
    return null;
  }

  getConnectionCount() {
    return this.connections.size;
  }

  broadcast(documentId, message, excludeConnectionId = null) {
    try {
      // y-websocket handles broadcasting internally through document updates
      // This method is kept for compatibility but may not be needed
      const connections = this.getConnectionsByDocument(documentId);
      let broadcastCount = 0;

      connections.forEach(connection => {
        if (connection.id !== excludeConnectionId && connection.ws) {
          try {
            // Send as JSON message (you might need to adapt this based on your message format)
            if (connection.ws.readyState === 1) { // WebSocket.OPEN
              connection.ws.send(JSON.stringify(message));
              broadcastCount++;
            }
          } catch (error) {
            this.logger.warn('Failed to broadcast to connection', error, {
              connectionId: connection.id
            });
          }
        }
      });

      this.logger.debug('Message broadcasted', {
        documentId,
        broadcastCount,
        excludeConnectionId
      });

      return broadcastCount;
    } catch (error) {
      this.logger.error('Failed to broadcast message', error, { documentId });
      throw error;
    }
  }

  updateLastActivity(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = new Date();
    }
  }

  getConnectionStats() {
    const stats = {
      totalConnections: this.connections.size,
      documentsWithConnections: this.documentConnections.size,
      connectionsByDocument: {}
    };

    this.documentConnections.forEach((connections, documentId) => {
      stats.connectionsByDocument[documentId] = connections.size;
    });

    return stats;
  }
}

module.exports = ConnectionManager;
