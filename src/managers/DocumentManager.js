const IDocumentManager = require('../interfaces/IDocumentManager');
const { getYDoc, docs, getDocumentStateSize, applyUpdateToDoc } = require('../utils/y-websocket-utils');
const RedisDocumentSync = require('../services/RedisDocumentSync');
const DocumentChunker = require('../optimizations/DocumentChunker');
const MemoryManager = require('../optimizations/MemoryManager');
const ConnectionPool = require('../optimizations/ConnectionPool');
const PerformanceMonitor = require('../optimizations/PerformanceMonitor');
const { getOptimizedDebounceConfig } = require('../config/debounceConfig');

class DocumentManager extends IDocumentManager {
  constructor(logger, config = {}) {
    super();
    this.logger = logger;
    this.config = config;
    this.documentStats = new Map();
    this.gcEnabled = config.gcEnabled !== false;

    this.redisSync = new RedisDocumentSync(logger, {
      redisUrl: config.redisUrl || process.env.REDIS_URL,
      keyPrefix: config.redisKeyPrefix || 'collab:'
    });

    this.syncedDocuments = new Set();

    // Initialize optimization components (with feature flags)
    const optimizationsEnabled = process.env.ENABLE_OPTIMIZATIONS !== 'false';

    this.documentChunker = new DocumentChunker(logger, {
      chunkSize: config.chunkSize || 64 * 1024,
      compressionEnabled: config.compressionEnabled !== false
    });

    // Only enable memory-intensive components if explicitly enabled
    if (optimizationsEnabled) {
      this.memoryManager = new MemoryManager(logger, {
        maxMemoryUsage: config.maxMemoryUsage || 1024 * 1024 * 1024, // Increase to 1GB
        documentCacheSize: config.documentCacheSize || 50, // Reduce cache size
        gcInterval: config.gcInterval || 60000, // Increase interval to 1 minute
        gcThreshold: 0.95 // Only cleanup at 95% usage
      });

      this.connectionPool = new ConnectionPool(logger, {
        maxConnectionsPerDocument: config.maxConnectionsPerDocument || 50,
        maxTotalConnections: config.maxTotalConnections || 1000
      });

      this.performanceMonitor = new PerformanceMonitor(logger, {
        metricsInterval: config.metricsInterval || 60000, // Reduce frequency
        alertThresholds: {
          memoryUsage: 0.95, // Only alert at 95%
          ...config.alertThresholds
        }
      });

      // Setup event listeners
      this.setupOptimizationListeners();

      this.logger.info('Performance optimizations enabled', {
        memoryLimit: `${(config.maxMemoryUsage || 1024 * 1024 * 1024) / 1024 / 1024}MB`,
        cacheSize: config.documentCacheSize || 50
      });
    } else {
      this.logger.info('Performance optimizations disabled');
    }

    if (config.cleanupInterval) {
      this.logger.info('Document cleanup scheduled', {
        intervalMs: config.cleanupInterval,
        maxIdleTimeMs: config.maxIdleTime || 30 * 60 * 1000
      });
      this.cleanupInterval = setInterval(async () => {
        try {
          await this.cleanup();
        } catch (error) {
          this.logger.error('Scheduled cleanup failed, continuing operation', error);
          // Don't throw - just log and continue
        }
      }, config.cleanupInterval);
    } else {
      this.logger.warn('Document cleanup not scheduled - cleanupInterval not configured');
    }
  }

  /**
   * Setup optimization event listeners
   */
  setupOptimizationListeners() {
    // Memory management alerts (only if enabled)
    if (this.memoryManager) {
      this.memoryManager.on('memoryStats', (stats) => {
        if (stats.usagePercent > 0.9) { // Only warn at 90%+
          this.logger.warn('High memory usage detected', {
            usagePercent: `${(stats.usagePercent * 100).toFixed(2)}%`,
            heapUsed: `${(stats.heapUsed / 1024 / 1024).toFixed(2)}MB`
          });
        }
      });
    }

    // Performance monitoring alerts (only if enabled)
    if (this.performanceMonitor) {
      this.performanceMonitor.on('alert', (alert) => {
        this.logger.warn('Performance alert', alert);
      });
    }

    // Connection pool events (only if enabled)
    if (this.connectionPool && this.performanceMonitor) {
      this.connectionPool.on('connectionAdded', (connection) => {
        this.performanceMonitor.trackConnectionPerformance(connection.id, {
          connectedAt: connection.connectedAt,
          documentId: connection.documentId
        });
      });

      this.connectionPool.on('connectionRemoved', (connection) => {
        this.performanceMonitor.trackConnectionPerformance(connection.id, {
          disconnectedAt: Date.now(),
          duration: Date.now() - connection.connectedAt
        });
      });
    }
  }

  async getDocument(documentId) {
    try {
      const doc = await getYDoc(documentId, this.gcEnabled);

      if (!this.documentStats.has(documentId)) {
        this.documentStats.set(documentId, {
          createdAt: new Date(),
          lastAccessed: new Date(),
          updateCount: 0,
          connectionCount: 0
        });

        this.logger.info('Document created', { documentId });
      }

      // Setup Redis sync for new documents
      if (!this.syncedDocuments.has(documentId)) {
        await this.setupDocumentSync(documentId, doc);
      }

      // Update last accessed time
      const stats = this.documentStats.get(documentId);
      if (stats) {
        stats.lastAccessed = new Date();
      }

      return doc;
    } catch (error) {
      this.logger.error('Failed to get document', error, { documentId });
      throw error;
    }
  }

  hasDocument(documentId) {
    return docs.has(documentId);
  }

  /**
   * Setup Redis synchronization for a document
   * @param {string} documentId - Document ID
   * @param {WSSharedDoc} doc - YJS document instance
   */
  async setupDocumentSync(documentId, doc) {
    try {
      // Subscribe to Redis updates for this document
      await this.redisSync.subscribeToDocument(documentId, (update, origin, metadata, syncInfo) => {
        this.handleRemoteUpdate(documentId, doc, update, origin, metadata, syncInfo);
      });

      // Listen for local document updates to broadcast
      doc.on('update', (update, origin) => {
        // Only broadcast updates that didn't come from Redis sync
        if (origin !== 'redis-sync') {
          this.broadcastUpdate(documentId, update, origin);
        }
      });

      this.syncedDocuments.add(documentId);

      this.logger.info('Document sync setup completed', {
        documentId,
        instanceId: this.redisSync.instanceId
      });

    } catch (error) {
      this.logger.error('Failed to setup document sync', error, { documentId });
      throw error;
    }
  }

  /**
   * Handle remote update from Redis
   * @param {string} documentId - Document ID
   * @param {WSSharedDoc} doc - YJS document instance
   * @param {Uint8Array} update - YJS update
   * @param {any} origin - Update origin
   * @param {Object} metadata - Update metadata
   * @param {Object} syncInfo - Sync information
   */
  handleRemoteUpdate(documentId, doc, update, origin, metadata, syncInfo) {
    try {
      // Apply the update with special origin to prevent re-broadcasting
      applyUpdateToDoc(doc, update, 'redis-sync');

      // Update statistics
      const stats = this.documentStats.get(documentId);
      if (stats) {
        stats.updateCount++;
        stats.lastAccessed = new Date();
      }

      this.logger.debug('Remote update applied', {
        documentId,
        updateSize: update.length,
        sourceInstance: syncInfo.sourceInstance,
        messageId: syncInfo.messageId
      });

    } catch (error) {
      this.logger.error('Failed to apply remote update', error, {
        documentId,
        updateSize: update ? update.length : 0,
        sourceInstance: syncInfo?.sourceInstance
      });
    }
  }

  /**
   * Broadcast local update to other instances
   * @param {string} documentId - Document ID
   * @param {Uint8Array} update - YJS update
   * @param {any} origin - Update origin
   */
  async broadcastUpdate(documentId, update, origin) {
    const startTime = Date.now();

    try {
      // Get connection count for optimization (only if connection pool is enabled)
      const connectionCount = this.connectionPool ?
        this.connectionPool.getDocumentConnections(documentId).length : 0;

      // Optimize update for large documents (only if chunker is available)
      let optimizedUpdate = update;
      if (this.documentChunker && update.length > 64 * 1024) { // 64KB threshold
        // Use chunking for large updates
        const chunks = this.documentChunker.chunkUpdate(update);

        if (chunks.length > 1) {
          // Broadcast chunks separately
          for (let i = 0; i < chunks.length; i++) {
            await this.redisSync.broadcastUpdate(documentId, chunks[i], origin, {
              timestamp: Date.now(),
              size: chunks[i].length,
              chunkIndex: i,
              totalChunks: chunks.length,
              isChunked: true
            });
          }

          this.logger.debug('Large update chunked and broadcasted', {
            documentId,
            originalSize: update.length,
            chunkCount: chunks.length,
            connectionCount
          });

          // Track performance (only if monitor is enabled)
          if (this.performanceMonitor) {
            this.performanceMonitor.trackDocumentPerformance(documentId, {
              updateLatency: Date.now() - startTime,
              updateSize: update.length,
              connectionCount,
              wasChunked: true
            });
          }

          return;
        }
      }

      // Regular broadcast for smaller updates
      await this.redisSync.broadcastUpdate(documentId, optimizedUpdate, origin, {
        timestamp: Date.now(),
        size: optimizedUpdate.length,
        connectionCount
      });

      const latency = Date.now() - startTime;

      this.logger.debug('Local update broadcasted', {
        documentId,
        updateSize: optimizedUpdate.length,
        latency: `${latency}ms`,
        connectionCount,
        origin
      });

      // Track performance (only if monitor is enabled)
      if (this.performanceMonitor) {
        this.performanceMonitor.trackDocumentPerformance(documentId, {
          updateLatency: latency,
          updateSize: optimizedUpdate.length,
          connectionCount,
          wasChunked: false
        });
      }

    } catch (error) {
      this.logger.error('Failed to broadcast update', error, {
        documentId,
        updateSize: update ? update.length : 0,
        origin
      });

      // Track error (only if monitor is enabled)
      if (this.performanceMonitor) {
        this.performanceMonitor.recordError('broadcast', error, {
          documentId,
          updateSize: update ? update.length : 0
        });
      }
    }
  }

  async removeDocument(documentId) {
    try {
      const doc = docs.get(documentId);
      if (!doc) {
        this.logger.warn('Attempted to remove non-existent document', { documentId });
        return false;
      }

      // Only remove if no active connections
      if (doc.conns.size > 0) {
        this.logger.warn('Cannot remove document with active connections', {
          documentId,
          activeConnections: doc.conns.size
        });
        return false;
      }

      // Cleanup Redis sync
      if (this.syncedDocuments.has(documentId)) {
        await this.redisSync.unsubscribeFromDocument(documentId);
        this.syncedDocuments.delete(documentId);
      }

      // Destroy the document
      doc.destroy();

      // Remove from global docs map and local stats
      docs.delete(documentId);
      this.documentStats.delete(documentId);

      this.logger.info('Document removed', { documentId });
      return true;
    } catch (error) {
      this.logger.error('Failed to remove document', error, { documentId });
      throw error;
    }
  }

  getDocumentStats(documentId) {
    try {
      const doc = docs.get(documentId);
      const stats = this.documentStats.get(documentId);

      if (!doc || !stats) {
        return null;
      }

      return {
        ...stats,
        size: getDocumentStateSize(doc),
        connectionCount: doc.conns.size,
        exists: true
      };
    } catch (error) {
      this.logger.error('Failed to get document stats', error, { documentId });
      throw error;
    }
  }

  getAllDocumentIds() {
    return Array.from(docs.keys());
  }

  async cleanup() {
    try {
      const now = new Date();
      const maxIdleTime = this.config.maxIdleTime || 30 * 60 * 1000; // 30 minutes default
      let cleanedCount = 0;

      // Log memory usage before cleanup
      const memBefore = process.memoryUsage();

      this.logger.info('Starting document cleanup', {
        totalDocuments: this.documentStats.size,
        syncedDocuments: this.syncedDocuments.size,
        maxIdleTimeMs: maxIdleTime,
        memoryBeforeCleanup: `${(memBefore.heapUsed / 1024 / 1024).toFixed(2)}MB`
      });

      const cleanupPromises = [];
      this.documentStats.forEach((stats, documentId) => {
        const idleTime = now - stats.lastAccessed;
        if (idleTime > maxIdleTime && stats.connectionCount === 0) {
          this.logger.debug('Scheduling document for cleanup', {
            documentId,
            idleTimeMs: idleTime,
            connectionCount: stats.connectionCount
          });

          // Wrap removeDocument in a promise that handles errors gracefully
          const cleanupPromise = this.removeDocument(documentId)
            .then(() => {
              this.logger.debug('Document cleaned up successfully', { documentId });
              return true;
            })
            .catch((error) => {
              this.logger.warn('Failed to cleanup document, skipping', {
                documentId,
                error: error.message,
                connectionCount: stats.connectionCount
              });
              return false;
            });

          cleanupPromises.push(cleanupPromise);
          cleanedCount++;
        }
      });

      // Wait for all cleanup operations to complete
      const results = await Promise.all(cleanupPromises);
      const actualCleanedCount = results.filter(result => result === true).length;

      // Log memory usage after cleanup
      const memAfter = process.memoryUsage();
      const memoryFreed = (memBefore.heapUsed - memAfter.heapUsed) / 1024 / 1024;

      this.logger.info('Document cleanup completed', {
        scheduledForCleanup: cleanedCount,
        actuallyCleanedCount: actualCleanedCount,
        skippedCount: cleanedCount - actualCleanedCount,
        documentsRemaining: this.documentStats.size,
        memoryAfterCleanup: `${(memAfter.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        memoryFreed: `${memoryFreed.toFixed(2)}MB`
      });

      return actualCleanedCount;
    } catch (error) {
      this.logger.error('Document cleanup failed', error);
      throw error;
    }
  }



  setupDocumentListeners(doc, documentId) {
    // y-websocket handles document listeners internally
    // We can add custom listeners here if needed
    doc.on('update', (update, origin) => {
      // Update statistics
      const stats = this.documentStats.get(documentId);
      if (stats) {
        stats.updateCount++;
        stats.lastAccessed = new Date();
      }

      this.logger.debug('Document updated', {
        documentId,
        updateSize: update.length,
        origin
      });
    });

    // Listen for document destruction
    doc.on('destroy', () => {
      this.logger.debug('Document destroyed', { documentId });
    });
  }

  updateConnectionCount(documentId, count) {
    const stats = this.documentStats.get(documentId);
    if (stats) {
      stats.connectionCount = count;
    }
  }

  getOverallStats() {
    try {
      const totalConnections = Array.from(docs.values())
        .reduce((sum, doc) => sum + doc.conns.size, 0);

      return {
        totalDocuments: docs.size,
        totalConnections,
        totalStats: this.documentStats.size,
        syncedDocuments: this.syncedDocuments.size,
        redisSync: this.redisSync.getMetrics(),
        memoryUsage: process.memoryUsage()
      };
    } catch (error) {
      this.logger.error('Failed to get overall stats', error);
      throw error;
    }
  }

  async destroy() {
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Cleanup Redis sync service
    if (this.redisSync) {
      await this.redisSync.destroy();
    }

    // Destroy all documents from the global docs map
    if (docs && typeof docs.forEach === 'function') {
      docs.forEach((doc, documentId) => {
        try {
          if (doc && typeof doc.destroy === 'function') {
            doc.destroy();
          }
        } catch (error) {
          this.logger.warn('Error destroying document', { documentId, error: error.message });
        }
      });

      // Clear the global docs map
      docs.clear();
    }

    // Clear local stats and sync tracking
    if (this.documentStats) {
      this.documentStats.clear();
    }
    if (this.syncedDocuments) {
      this.syncedDocuments.clear();
    }

    this.logger.info('DocumentManager destroyed');
  }
}

module.exports = DocumentManager;
