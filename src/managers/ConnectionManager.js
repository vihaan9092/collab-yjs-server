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
    this.wsToConnectionId = new Map(); // WebSocket -> connectionId (for O(1) lookup)
    this.connectionTimeouts = new Map(); // connectionId -> timeout handle

    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections();
    }, 60000); // Clean up every minute
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
        isActive: true,
        ...metadata
      };

      this.connections.set(connectionId, connection);

      // Add reverse lookup for O(1) WebSocket to connectionId mapping
      this.wsToConnectionId.set(ws, connectionId);

      // Track document connections
      if (connection.documentId) {
        if (!this.documentConnections.has(connection.documentId)) {
          this.documentConnections.set(connection.documentId, new Set());
        }
        this.documentConnections.get(connection.documentId).add(connectionId);
      }

      // Set up connection timeout (30 minutes of inactivity)
      this.resetConnectionTimeout(connectionId);

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

      // Mark as inactive first
      connection.isActive = false;

      // Remove from reverse lookup
      if (connection.ws) {
        this.wsToConnectionId.delete(connection.ws);
      }

      // Clear connection timeout
      this.clearConnectionTimeout(connectionId);

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
    // O(1) lookup using reverse index
    return this.wsToConnectionId.get(ws) || null;
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
      // Reset the timeout when there's activity
      this.resetConnectionTimeout(connectionId);
    }
  }

  /**
   * Reset connection timeout for inactive connections
   */
  resetConnectionTimeout(connectionId) {
    // Clear existing timeout
    this.clearConnectionTimeout(connectionId);

    // Set new timeout (30 minutes)
    const timeoutHandle = setTimeout(() => {
      this.handleConnectionTimeout(connectionId);
    }, 30 * 60 * 1000); // 30 minutes

    this.connectionTimeouts.set(connectionId, timeoutHandle);
  }

  /**
   * Clear connection timeout
   */
  clearConnectionTimeout(connectionId) {
    const timeoutHandle = this.connectionTimeouts.get(connectionId);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      this.connectionTimeouts.delete(connectionId);
    }
  }

  /**
   * Handle connection timeout
   */
  handleConnectionTimeout(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.logger.info('Connection timed out due to inactivity', {
        connectionId,
        documentId: connection.documentId,
        userId: connection.userId,
        lastActivity: connection.lastActivity
      });

      // Close the WebSocket if it's still open
      if (connection.ws && connection.ws.readyState === 1) {
        connection.ws.close(1000, 'Connection timeout');
      }

      // Remove the connection
      this.removeConnection(connectionId);
    }
  }

  /**
   * Clean up stale connections
   */
  cleanupStaleConnections() {
    const now = new Date();
    const staleConnections = [];

    for (const [connectionId, connection] of this.connections) {
      // Check if WebSocket is closed
      if (connection.ws && connection.ws.readyState === 3) { // WebSocket.CLOSED
        staleConnections.push(connectionId);
        continue;
      }

      // Check for very old inactive connections (2 hours)
      const inactiveTime = now - connection.lastActivity;
      if (inactiveTime > 2 * 60 * 60 * 1000) { // 2 hours
        staleConnections.push(connectionId);
      }
    }

    if (staleConnections.length > 0) {
      this.logger.info('Cleaning up stale connections', {
        count: staleConnections.length,
        connectionIds: staleConnections
      });

      staleConnections.forEach(connectionId => {
        this.removeConnection(connectionId);
      });
    }
  }

  /**
   * Destroy the connection manager and clean up resources
   */
  destroy() {
    // Clear all timeouts
    for (const timeoutHandle of this.connectionTimeouts.values()) {
      clearTimeout(timeoutHandle);
    }
    this.connectionTimeouts.clear();

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Close all connections
    for (const connection of this.connections.values()) {
      if (connection.ws && connection.ws.readyState === 1) {
        connection.ws.close(1000, 'Server shutdown');
      }
    }

    // Clear all maps
    this.connections.clear();
    this.documentConnections.clear();
    this.wsToConnectionId.clear();

    this.logger.info('ConnectionManager destroyed');
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
