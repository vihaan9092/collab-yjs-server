/**
 * YJS Service - Main orchestrator for YJS functionality
 * Follows Single Responsibility Principle - orchestrates YJS operations
 * Follows Dependency Inversion Principle - depends on abstractions
 */
class YjsService {
  constructor(connectionManager, documentManager, webSocketHandler, logger) {
    this.connectionManager = connectionManager;
    this.documentManager = documentManager;
    this.webSocketHandler = webSocketHandler;
    this.logger = logger;
  }

  /**
   * Initialize the YJS service
   */
  initialize() {
    this.logger.info('YJS Service initializing...');
    
    // Setup periodic cleanup
    this.setupPeriodicCleanup();
    
    this.logger.info('YJS Service initialized successfully');
  }

  /**
   * Setup periodic cleanup of unused documents
   */
  setupPeriodicCleanup() {
    const cleanupInterval = 5 * 60 * 1000; // 5 minutes
    
    setInterval(() => {
      try {
        const cleanedCount = this.documentManager.cleanup();
        if (cleanedCount > 0) {
          this.logger.info('Periodic cleanup completed', { cleanedCount });
        }
      } catch (error) {
        this.logger.error('Periodic cleanup failed', error);
      }
    }, cleanupInterval);
  }

  /**
   * Get service statistics
   */
  getStats() {
    try {
      const connectionStats = this.connectionManager.getConnectionStats();
      const documentStats = this.documentManager.getOverallStats();

      return {
        connections: connectionStats,
        documents: documentStats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Failed to get service stats', error);
      throw error;
    }
  }

  /**
   * Get detailed document information
   */
  getDocumentInfo(documentId) {
    try {
      const documentStats = this.documentManager.getDocumentStats(documentId);
      const connections = this.connectionManager.getConnectionsByDocument(documentId);

      return {
        documentId,
        stats: documentStats,
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
   * Force cleanup of a specific document
   */
  cleanupDocument(documentId) {
    try {
      const connections = this.connectionManager.getConnectionsByDocument(documentId);
      
      if (connections.length > 0) {
        throw new Error('Cannot cleanup document with active connections');
      }

      const removed = this.documentManager.removeDocument(documentId);
      
      this.logger.info('Document cleanup forced', { documentId, removed });
      
      return removed;
    } catch (error) {
      this.logger.error('Failed to cleanup document', error, { documentId });
      throw error;
    }
  }

  /**
   * Handle graceful shutdown
   */
  async shutdown() {
    try {
      this.logger.info('YJS Service shutting down...');

      // Notify all connected clients via WebSocket
      const allConnections = Array.from(this.connectionManager.connections.values());
      allConnections.forEach(connection => {
        if (connection.ws && connection.ws.readyState === 1) { // WebSocket.OPEN
          try {
            connection.ws.send(JSON.stringify({
              type: 'server-shutdown',
              message: 'Server is shutting down',
              timestamp: new Date().toISOString()
            }));
          } catch (error) {
            this.logger.warn('Failed to notify client of shutdown', error, {
              connectionId: connection.id
            });
          }
        }
      });

      // Give clients time to handle shutdown notification
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Cleanup resources
      this.documentManager.destroy();

      this.logger.info('YJS Service shutdown completed');
    } catch (error) {
      this.logger.error('Error during YJS Service shutdown', error);
      throw error;
    }
  }

  /**
   * Health check for the service
   */
  healthCheck() {
    try {
      const stats = this.getStats();
      
      return {
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        stats,
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

module.exports = YjsService;
