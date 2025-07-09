const IDocumentManager = require('../interfaces/IDocumentManager');
const { getYDoc, docs, getDocumentStateSize, applyUpdateToDoc } = require('../utils/y-websocket-utils');
const RedisDocumentSync = require('../services/RedisDocumentSync');

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

    if (config.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, config.cleanupInterval);
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
    try {
      await this.redisSync.broadcastUpdate(documentId, update, origin, {
        timestamp: Date.now(),
        size: update.length
      });

      this.logger.debug('Local update broadcasted', {
        documentId,
        updateSize: update.length,
        origin
      });

    } catch (error) {
      this.logger.error('Failed to broadcast update', error, {
        documentId,
        updateSize: update ? update.length : 0,
        origin
      });
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
        throw new Error('Cannot remove document with active connections');
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

      const cleanupPromises = [];
      this.documentStats.forEach((stats, documentId) => {
        const idleTime = now - stats.lastAccessed;
        if (idleTime > maxIdleTime && stats.connectionCount === 0) {
          cleanupPromises.push(this.removeDocument(documentId));
          cleanedCount++;
        }
      });

      // Wait for all cleanup operations to complete
      await Promise.all(cleanupPromises);

      if (cleanedCount > 0) {
        this.logger.info('Document cleanup completed', { cleanedCount });
      }

      return cleanedCount;
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
