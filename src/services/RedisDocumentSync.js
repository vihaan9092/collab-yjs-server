const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');


class RedisDocumentSync {
  constructor(logger, config = {}) {
    this.logger = logger;
    this.config = config;
    this.instanceId = process.env.INSTANCE_ID || uuidv4();
    
    this.redisUrl = config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
    this.keyPrefix = config.keyPrefix || 'collab:';
    this.publisher = new Redis(this.redisUrl, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.subscriber = new Redis(this.redisUrl, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.subscriptions = new Map();
    this.documentChannels = new Map();
    this.metrics = {
      messagesSent: 0,
      messagesReceived: 0,
      documentsTracked: 0,
      lastActivity: new Date()
    };
    
    this.setupEventHandlers();
  }

  /**
   * Setup Redis event handlers
   */
  setupEventHandlers() {
    // Publisher events
    this.publisher.on('connect', () => {
      this.logger.info('Redis publisher connected for document sync', {
        instanceId: this.instanceId
      });
    });
    
    this.publisher.on('error', (err) => {
      this.logger.error('Redis publisher error:', err, {
        instanceId: this.instanceId
      });
    });
    
    // Subscriber events
    this.subscriber.on('connect', () => {
      this.logger.info('Redis subscriber connected for document sync', {
        instanceId: this.instanceId
      });
    });
    
    this.subscriber.on('error', (err) => {
      this.logger.error('Redis subscriber error:', err, {
        instanceId: this.instanceId
      });
    });
    
    // Handle incoming messages
    this.subscriber.on('message', (channel, message) => {
      this.handleIncomingMessage(channel, message);
    });
  }
  
  /**
   * Broadcast document update to all other instances
   * @param {string} documentId - Document ID
   * @param {Uint8Array} update - YJS update
   * @param {any} origin - Update origin
   * @param {Object} metadata - Additional metadata
   */
  async broadcastUpdate(documentId, update, origin = null, metadata = {}) {
    try {
      const channel = this.getChannelName(documentId, 'updates');
      const message = {
        documentId,
        update: Array.from(update), // Convert Uint8Array to regular array for JSON
        origin,
        metadata,
        timestamp: Date.now(),
        instanceId: this.instanceId,
        messageId: uuidv4()
      };
      
      await this.publisher.publish(channel, JSON.stringify(message));
      
      this.metrics.messagesSent++;
      this.metrics.lastActivity = new Date();

      // this.logger.info('Redis pub/sub message sent', {
      //   documentId,
      //   updateSize: update.length,
      //   channel,
      //   totalMessagesSent: this.metrics.messagesSent,
      //   instanceId: this.instanceId,
      //   messageId: message.messageId
      // });
      
    } catch (error) {
      this.logger.error('Failed to broadcast document update', error, {
        documentId,
        updateSize: update ? update.length : 0,
        instanceId: this.instanceId
      });
      throw error;
    }
  }
  
  /**
   * Subscribe to document updates for a specific document
   * @param {string} documentId - Document ID
   * @param {Function} handler - Update handler function
   */
  async subscribeToDocument(documentId, handler) {
    try {
      if (!this.subscriptions.has(documentId)) {
        this.subscriptions.set(documentId, new Set());
        
        // Subscribe to the Redis channel
        const channel = this.getChannelName(documentId, 'updates');
        await this.subscriber.subscribe(channel);
        this.documentChannels.set(documentId, channel);
        
        this.metrics.documentsTracked++;
        
        this.logger.info('Subscribed to document updates', {
          documentId,
          channel,
          instanceId: this.instanceId
        });
      }
      
      // Add handler to the set
      this.subscriptions.get(documentId).add(handler);
      
    } catch (error) {
      this.logger.error('Failed to subscribe to document', error, {
        documentId,
        instanceId: this.instanceId
      });
      throw error;
    }
  }
  
  /**
   * Unsubscribe from document updates
   * @param {string} documentId - Document ID
   * @param {Function} handler - Handler to remove (optional, removes all if not provided)
   */
  async unsubscribeFromDocument(documentId, handler = null) {
    try {
      const handlers = this.subscriptions.get(documentId);
      if (!handlers) return;
      
      if (handler) {
        handlers.delete(handler);
      } else {
        handlers.clear();
      }
      
      // If no more handlers, unsubscribe from Redis
      if (handlers.size === 0) {
        const channel = this.documentChannels.get(documentId);
        if (channel) {
          await this.subscriber.unsubscribe(channel);
          this.documentChannels.delete(documentId);
          this.subscriptions.delete(documentId);
          this.metrics.documentsTracked--;
          
          this.logger.info('Unsubscribed from document updates', {
            documentId,
            channel,
            instanceId: this.instanceId
          });
        }
      }
      
    } catch (error) {
      this.logger.error('Failed to unsubscribe from document', error, {
        documentId,
        instanceId: this.instanceId
      });
      throw error;
    }
  }
  
  /**
   * Handle incoming Redis messages
   * @param {string} channel - Redis channel
   * @param {string} message - Message content
   */
  handleIncomingMessage(channel, message) {
    try {
      const data = JSON.parse(message);

      this.logger.debug('Redis message received', {
        channel,
        sourceInstance: data.instanceId,
        currentInstance: this.instanceId,
        documentId: data.documentId,
        messageId: data.messageId
      });

      // Ignore messages from this instance
      if (data.instanceId === this.instanceId) {
        this.logger.debug('Ignoring message from same instance', {
          instanceId: this.instanceId,
          messageId: data.messageId
        });
        return;
      }
      
      const { documentId, update, origin, metadata, timestamp, messageId } = data;
      
      // Convert array back to Uint8Array
      const updateArray = new Uint8Array(update);
      
      // Get handlers for this document
      const handlers = this.subscriptions.get(documentId);
      if (handlers && handlers.size > 0) {
        // Call all handlers
        handlers.forEach(handler => {
          try {
            handler(updateArray, origin, metadata, {
              timestamp,
              messageId,
              sourceInstance: data.instanceId
            });
          } catch (handlerError) {
            this.logger.error('Error in document update handler', handlerError, {
              documentId,
              messageId,
              instanceId: this.instanceId
            });
          }
        });
        
        this.metrics.messagesReceived++;
        this.metrics.lastActivity = new Date();
        
        this.logger.debug('Document update received and processed', {
          documentId,
          updateSize: updateArray.length,
          handlersCount: handlers.size,
          messageId,
          sourceInstance: data.instanceId,
          instanceId: this.instanceId
        });
      }
      
    } catch (error) {
      this.logger.error('Failed to handle incoming message', error, {
        channel,
        instanceId: this.instanceId
      });
    }
  }
  
  /**
   * Get Redis channel name for document operations
   * @param {string} documentId - Document ID
   * @param {string} operation - Operation type (updates, presence, etc.)
   * @returns {string} Channel name
   */
  getChannelName(documentId, operation) {
    // Include prefix manually since pub/sub doesn't use keyPrefix
    return `${this.keyPrefix}doc:${documentId}:${operation}`;
  }
  
  /**
   * Get synchronization metrics
   * @returns {Object} Metrics object
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeSubscriptions: this.subscriptions.size,
      instanceId: this.instanceId
    };
  }
  
  /**
   * Health check for the sync service
   * @returns {Object} Health status
   */
  async healthCheck() {
    try {
      // Test Redis connectivity
      await this.publisher.ping();
      await this.subscriber.ping();
      
      return {
        status: 'healthy',
        instanceId: this.instanceId,
        metrics: this.getMetrics(),
        redis: {
          publisher: 'connected',
          subscriber: 'connected'
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        instanceId: this.instanceId,
        error: error.message,
        redis: {
          publisher: 'error',
          subscriber: 'error'
        }
      };
    }
  }
  
  /**
   * Cleanup resources
   */
  async destroy() {
    try {
      // Unsubscribe from all channels
      const channels = Array.from(this.documentChannels.values());
      if (channels.length > 0) {
        await this.subscriber.unsubscribe(...channels);
      }
      
      // Close Redis connections
      await this.publisher.quit();
      await this.subscriber.quit();
      
      // Clear internal state
      this.subscriptions.clear();
      this.documentChannels.clear();
      
      this.logger.info('Redis document sync service destroyed', {
        instanceId: this.instanceId
      });
      
    } catch (error) {
      this.logger.error('Error destroying Redis document sync service', error, {
        instanceId: this.instanceId
      });
    }
  }
}

module.exports = RedisDocumentSync;
