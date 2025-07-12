/**
 * Connection Pool Manager for Large Document Optimization
 * Handles connection pooling, load balancing, and resource allocation
 */

const EventEmitter = require('events');

class ConnectionPool extends EventEmitter {
  constructor(logger, config = {}) {
    super();
    this.logger = logger;
    this.config = {
      maxConnectionsPerDocument: config.maxConnectionsPerDocument || 50,
      maxTotalConnections: config.maxTotalConnections || 1000,
      connectionTimeout: config.connectionTimeout || 30000,
      heartbeatInterval: config.heartbeatInterval || 25000,
      loadBalancingEnabled: config.loadBalancingEnabled !== false,
      priorityLevels: config.priorityLevels || ['high', 'normal', 'low'],
      ...config
    };

    this.connections = new Map(); // connectionId -> connection data
    this.documentConnections = new Map(); // documentId -> Set of connectionIds
    this.userConnections = new Map(); // userId -> Set of connectionIds
    this.connectionQueues = new Map(); // priority -> queue of pending connections
    
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      queuedConnections: 0,
      rejectedConnections: 0,
      averageLatency: 0
    };

    this.startConnectionMonitoring();
  }

  /**
   * Start connection monitoring and cleanup
   */
  startConnectionMonitoring() {
    // Heartbeat monitoring
    setInterval(() => {
      this.performHeartbeatCheck();
    }, this.config.heartbeatInterval);

    // Connection cleanup
    setInterval(() => {
      this.cleanupStaleConnections();
    }, 60000); // Every minute

    // Load balancing
    if (this.config.loadBalancingEnabled) {
      setInterval(() => {
        this.balanceConnections();
      }, 10000); // Every 10 seconds
    }
  }

  /**
   * Add a new connection to the pool
   * @param {Object} connectionData - Connection information
   * @returns {boolean} Success status
   */
  addConnection(connectionData) {
    const {
      connectionId,
      documentId,
      userId,
      ws,
      priority = 'normal',
      metadata = {}
    } = connectionData;

    try {
      // Check connection limits
      if (!this.canAcceptConnection(documentId, userId)) {
        this.queueConnection(connectionData);
        return false;
      }

      // Create connection record
      const connection = {
        id: connectionId,
        documentId,
        userId,
        ws,
        priority,
        metadata,
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        messageCount: 0,
        bytesTransferred: 0,
        latency: 0,
        status: 'active'
      };

      // Add to maps
      this.connections.set(connectionId, connection);
      
      if (!this.documentConnections.has(documentId)) {
        this.documentConnections.set(documentId, new Set());
      }
      this.documentConnections.get(documentId).add(connectionId);

      if (userId) {
        if (!this.userConnections.has(userId)) {
          this.userConnections.set(userId, new Set());
        }
        this.userConnections.get(userId).add(connectionId);
      }

      // Update stats
      this.stats.totalConnections++;
      this.stats.activeConnections++;

      // Setup connection monitoring
      this.setupConnectionMonitoring(connection);

      this.logger.info('Connection added to pool', {
        connectionId,
        documentId,
        userId,
        priority,
        totalConnections: this.stats.activeConnections
      });

      this.emit('connectionAdded', connection);
      return true;

    } catch (error) {
      this.logger.error('Failed to add connection to pool', error, {
        connectionId,
        documentId,
        userId
      });
      return false;
    }
  }

  /**
   * Remove connection from pool
   * @param {string} connectionId - Connection ID
   */
  removeConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      // Remove from document connections
      const docConnections = this.documentConnections.get(connection.documentId);
      if (docConnections) {
        docConnections.delete(connectionId);
        if (docConnections.size === 0) {
          this.documentConnections.delete(connection.documentId);
        }
      }

      // Remove from user connections
      if (connection.userId) {
        const userConnections = this.userConnections.get(connection.userId);
        if (userConnections) {
          userConnections.delete(connectionId);
          if (userConnections.size === 0) {
            this.userConnections.delete(connection.userId);
          }
        }
      }

      // Remove from main map
      this.connections.delete(connectionId);

      // Update stats
      this.stats.activeConnections--;

      this.logger.info('Connection removed from pool', {
        connectionId,
        documentId: connection.documentId,
        userId: connection.userId,
        duration: Date.now() - connection.connectedAt,
        messageCount: connection.messageCount,
        bytesTransferred: connection.bytesTransferred
      });

      this.emit('connectionRemoved', connection);

      // Process queued connections
      this.processQueuedConnections(connection.documentId);

    } catch (error) {
      this.logger.error('Failed to remove connection from pool', error, {
        connectionId
      });
    }
  }

  /**
   * Check if a new connection can be accepted
   * @param {string} documentId - Document ID
   * @param {string} userId - User ID
   * @returns {boolean} Can accept connection
   */
  canAcceptConnection(documentId, userId) {
    // Check total connection limit
    if (this.stats.activeConnections >= this.config.maxTotalConnections) {
      this.stats.rejectedConnections++;
      return false;
    }

    // Check per-document limit
    const docConnections = this.documentConnections.get(documentId);
    if (docConnections && docConnections.size >= this.config.maxConnectionsPerDocument) {
      return false;
    }

    // Check per-user limit (if configured)
    if (this.config.maxConnectionsPerUser && userId) {
      const userConnections = this.userConnections.get(userId);
      if (userConnections && userConnections.size >= this.config.maxConnectionsPerUser) {
        return false;
      }
    }

    return true;
  }

  /**
   * Queue connection for later processing
   * @param {Object} connectionData - Connection data
   */
  queueConnection(connectionData) {
    const priority = connectionData.priority || 'normal';
    
    if (!this.connectionQueues.has(priority)) {
      this.connectionQueues.set(priority, []);
    }

    this.connectionQueues.get(priority).push({
      ...connectionData,
      queuedAt: Date.now()
    });

    this.stats.queuedConnections++;

    this.logger.info('Connection queued', {
      connectionId: connectionData.connectionId,
      documentId: connectionData.documentId,
      priority,
      queueSize: this.connectionQueues.get(priority).length
    });
  }

  /**
   * Process queued connections
   * @param {string} documentId - Document ID that freed up space
   */
  processQueuedConnections(documentId) {
    // Process by priority order
    for (const priority of this.config.priorityLevels) {
      const queue = this.connectionQueues.get(priority);
      if (!queue || queue.length === 0) continue;

      // Find connections for the same document first
      const docIndex = queue.findIndex(conn => conn.documentId === documentId);
      if (docIndex !== -1) {
        const connectionData = queue.splice(docIndex, 1)[0];
        this.stats.queuedConnections--;
        
        if (this.addConnection(connectionData)) {
          this.logger.info('Queued connection processed', {
            connectionId: connectionData.connectionId,
            documentId: connectionData.documentId,
            waitTime: Date.now() - connectionData.queuedAt
          });
          return;
        }
      }

      // Process any other queued connection
      if (queue.length > 0) {
        const connectionData = queue.shift();
        this.stats.queuedConnections--;
        
        if (this.addConnection(connectionData)) {
          this.logger.info('Queued connection processed', {
            connectionId: connectionData.connectionId,
            documentId: connectionData.documentId,
            waitTime: Date.now() - connectionData.queuedAt
          });
          return;
        } else {
          // Re-queue if still can't accept
          this.queueConnection(connectionData);
        }
      }
    }
  }

  /**
   * Setup monitoring for a connection
   * @param {Object} connection - Connection object
   */
  setupConnectionMonitoring(connection) {
    const ws = connection.ws;
    
    // Track message count and bytes
    const originalSend = ws.send;
    ws.send = function(data) {
      connection.messageCount++;
      connection.bytesTransferred += data.length || 0;
      connection.lastActivity = Date.now();
      return originalSend.call(this, data);
    };

    // Track incoming messages
    ws.on('message', () => {
      connection.lastActivity = Date.now();
    });

    // Track connection close
    ws.on('close', () => {
      connection.status = 'closed';
    });

    // Track errors
    ws.on('error', (error) => {
      connection.status = 'error';
      this.logger.error('WebSocket error in connection pool', error, {
        connectionId: connection.id
      });
    });
  }

  /**
   * Perform heartbeat check on all connections
   */
  performHeartbeatCheck() {
    const now = Date.now();
    const staleConnections = [];

    this.connections.forEach((connection, connectionId) => {
      const timeSinceActivity = now - connection.lastActivity;
      
      if (timeSinceActivity > this.config.connectionTimeout) {
        staleConnections.push(connectionId);
      } else if (timeSinceActivity > this.config.heartbeatInterval) {
        // Send ping
        try {
          if (connection.ws.readyState === 1) { // WebSocket.OPEN
            connection.ws.ping();
          }
        } catch (error) {
          staleConnections.push(connectionId);
        }
      }
    });

    // Remove stale connections
    staleConnections.forEach(connectionId => {
      this.removeConnection(connectionId);
    });

    if (staleConnections.length > 0) {
      this.logger.info('Removed stale connections', {
        count: staleConnections.length,
        activeConnections: this.stats.activeConnections
      });
    }
  }

  /**
   * Clean up stale connections
   */
  cleanupStaleConnections() {
    const now = Date.now();
    let cleaned = 0;

    this.connections.forEach((connection, connectionId) => {
      if (connection.status === 'closed' || connection.status === 'error') {
        this.removeConnection(connectionId);
        cleaned++;
      }
    });

    // Clean up old queued connections
    this.connectionQueues.forEach((queue, priority) => {
      const originalLength = queue.length;
      this.connectionQueues.set(priority, 
        queue.filter(conn => now - conn.queuedAt < 300000) // 5 minutes
      );
      const removed = originalLength - this.connectionQueues.get(priority).length;
      this.stats.queuedConnections -= removed;
    });

    if (cleaned > 0) {
      this.logger.info('Connection cleanup completed', {
        connectionsRemoved: cleaned,
        activeConnections: this.stats.activeConnections
      });
    }
  }

  /**
   * Balance connections across documents
   */
  balanceConnections() {
    // Implementation for load balancing logic
    // This could include moving connections between instances
    // or throttling high-load documents
    
    const documentLoads = new Map();
    
    this.documentConnections.forEach((connections, documentId) => {
      documentLoads.set(documentId, connections.size);
    });

    // Log load distribution
    if (documentLoads.size > 0) {
      const loads = Array.from(documentLoads.values());
      const avgLoad = loads.reduce((a, b) => a + b, 0) / loads.length;
      const maxLoad = Math.max(...loads);
      
      this.logger.debug('Connection load distribution', {
        documents: documentLoads.size,
        averageLoad: avgLoad.toFixed(2),
        maxLoad,
        totalConnections: this.stats.activeConnections
      });
    }
  }

  /**
   * Get connection pool statistics
   * @returns {Object} Pool statistics
   */
  getStats() {
    return {
      ...this.stats,
      documentsActive: this.documentConnections.size,
      usersActive: this.userConnections.size,
      queueSizes: Object.fromEntries(
        Array.from(this.connectionQueues.entries()).map(([priority, queue]) => [
          priority,
          queue.length
        ])
      )
    };
  }

  /**
   * Get connections for a specific document
   * @param {string} documentId - Document ID
   * @returns {Array} Array of connections
   */
  getDocumentConnections(documentId) {
    const connectionIds = this.documentConnections.get(documentId);
    if (!connectionIds) return [];

    return Array.from(connectionIds).map(id => this.connections.get(id)).filter(Boolean);
  }

  /**
   * Destroy the connection pool
   */
  destroy() {
    this.connections.clear();
    this.documentConnections.clear();
    this.userConnections.clear();
    this.connectionQueues.clear();
    this.removeAllListeners();
    this.logger.info('ConnectionPool destroyed');
  }
}

module.exports = ConnectionPool;
