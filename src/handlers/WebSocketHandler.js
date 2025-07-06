const { docs } = require('../utils/y-websocket-utils');
const { extractDocumentId, parseDocumentMetadata } = require('../utils/DocumentUtils');

/**
 * WebSocket Handler for y-websocket
 * Follows Single Responsibility Principle - handles WebSocket connection metadata
 * Follows Dependency Inversion Principle - depends on abstractions
 * Note: y-websocket handles the actual protocol, this class manages connection metadata
 */
class WebSocketHandler {
  constructor(connectionManager, documentManager, logger) {
    this.connectionManager = connectionManager;
    this.documentManager = documentManager;
    this.logger = logger;
  }

  /**
   * Handle new WebSocket connection
   * This is called after y-websocket has set up the connection
   * @param {WebSocket} ws - WebSocket instance
   * @param {Object} req - HTTP request object
   */
  handleConnection(ws, req) {
    // Use consistent document ID extraction
    const documentId = extractDocumentId(req);
    const documentMetadata = parseDocumentMetadata(req);
    const userId = documentMetadata.searchParams.userId || `user-${Date.now()}`;

    this.logger.info('New WebSocket connection', {
      documentId,
      userId,
      documentMetadata,
      origin: req.headers.origin
    });

    // Generate connection ID
    const connectionId = `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Add connection to our manager
    const connection = this.connectionManager.addConnection(connectionId, ws, {
      documentId,
      userId,
      origin: req.headers.origin
    });

    // Handle disconnection
    ws.on('close', () => {
      this.handleDisconnection(connectionId, 'connection closed');
    });

    ws.on('error', (error) => {
      this.logger.error('WebSocket error', error, { connectionId, documentId });
      this.handleDisconnection(connectionId, 'error');
    });

    return connection;
  }

  /**
   * Handle WebSocket disconnection
   * @param {string} connectionId - Connection ID
   * @param {string} reason - Disconnection reason
   */
  handleDisconnection(connectionId, reason) {
    try {
      const connection = this.connectionManager.getConnection(connectionId);
      if (!connection) {
        this.logger.warn('Attempted to handle disconnection for non-existent connection', { connectionId });
        return;
      }

      const { documentId, userId } = connection;

      // Remove connection from manager
      this.connectionManager.removeConnection(connectionId);

      // Update document connection count
      const doc = docs.get(documentId);
      if (doc) {
        this.documentManager.updateConnectionCount(documentId, doc.conns.size);
      }

      this.logger.info('WebSocket disconnected', {
        connectionId,
        documentId,
        userId,
        reason,
        duration: Date.now() - connection.joinedAt.getTime()
      });

    } catch (error) {
      this.logger.error('Failed to handle disconnection', error, { connectionId, reason });
    }
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    try {
      const totalConnections = this.connectionManager.getConnectionCount();
      const documentStats = new Map();

      // Collect stats from y-websocket documents
      docs.forEach((doc, documentId) => {
        documentStats.set(documentId, {
          connectionCount: doc.conns.size,
          awarenessStates: doc.awareness.getStates().size
        });
      });

      return {
        totalConnections,
        documentStats: Object.fromEntries(documentStats)
      };
    } catch (error) {
      this.logger.error('Failed to get connection stats', error);
      throw error;
    }
  }

  /**
   * Get document information
   * @param {string} documentId - Document ID
   */
  getDocumentInfo(documentId) {
    try {
      const doc = docs.get(documentId);
      if (!doc) {
        return null;
      }

      const connections = this.connectionManager.getConnectionsByDocument(documentId);
      
      return {
        documentId,
        connectionCount: doc.conns.size,
        awarenessStates: doc.awareness.getStates().size,
        connections: connections.map(conn => ({
          id: conn.id,
          userId: conn.userId,
          joinedAt: conn.joinedAt,
          lastActivity: conn.lastActivity
        }))
      };
    } catch (error) {
      this.logger.error('Failed to get document info', error, { documentId });
      throw error;
    }
  }

  /**
   * Force disconnect a connection
   * @param {string} connectionId - Connection ID
   */
  forceDisconnect(connectionId) {
    try {
      const connection = this.connectionManager.getConnection(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      if (connection.ws && connection.ws.readyState === 1) { // WebSocket.OPEN
        connection.ws.close(1000, 'Force disconnect');
      }

      this.handleDisconnection(connectionId, 'force disconnect');
      
      this.logger.info('Connection force disconnected', { connectionId });
      return true;
    } catch (error) {
      this.logger.error('Failed to force disconnect', error, { connectionId });
      throw error;
    }
  }

  /**
   * Send message to specific connection
   * @param {string} connectionId - Connection ID
   * @param {Object} message - Message to send
   */
  sendToConnection(connectionId, message) {
    try {
      const connection = this.connectionManager.getConnection(connectionId);
      if (!connection || !connection.ws) {
        throw new Error('Connection not found or invalid');
      }

      if (connection.ws.readyState === 1) { // WebSocket.OPEN
        connection.ws.send(JSON.stringify(message));
        this.connectionManager.updateLastActivity(connectionId);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Failed to send message to connection', error, { connectionId });
      throw error;
    }
  }

  /**
   * Health check for the handler
   */
  healthCheck() {
    try {
      const stats = this.getConnectionStats();
      return {
        status: 'healthy',
        totalConnections: stats.totalConnections,
        totalDocuments: docs.size,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Health check failed', error);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = WebSocketHandler;
