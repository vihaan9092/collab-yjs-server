const IDocumentManager = require('../interfaces/IDocumentManager');
const { getYDoc, docs, getDocumentStateSize, applyUpdateToDoc } = require('../utils/y-websocket-utils');

/**
 * Document Manager Implementation for y-websocket
 * Follows Single Responsibility Principle - manages only YJS documents
 * Follows Open/Closed Principle - extensible for different persistence strategies
 * Now works with y-websocket's global document storage
 */
class DocumentManager extends IDocumentManager {
  constructor(logger, config = {}) {
    super();
    this.logger = logger;
    this.config = config;
    this.documentStats = new Map(); // documentId -> stats object
    this.gcEnabled = config.gcEnabled !== false;

    // Setup cleanup interval
    if (config.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, config.cleanupInterval);
    }
  }

  getDocument(documentId) {
    try {
      // Use y-websocket's getYDoc function
      const doc = getYDoc(documentId, this.gcEnabled);

      // Initialize stats if not exists
      if (!this.documentStats.has(documentId)) {
        this.documentStats.set(documentId, {
          createdAt: new Date(),
          lastAccessed: new Date(),
          updateCount: 0,
          connectionCount: 0
        });

        this.logger.info('Document created', { documentId });
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
    return this.documents.has(documentId);
  }

  removeDocument(documentId) {
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

  cleanup() {
    try {
      const now = new Date();
      const maxIdleTime = this.config.maxIdleTime || 30 * 60 * 1000; // 30 minutes default
      let cleanedCount = 0;

      this.documentStats.forEach((stats, documentId) => {
        const idleTime = now - stats.lastAccessed;
        if (idleTime > maxIdleTime && stats.connectionCount === 0) {
          this.removeDocument(documentId);
          cleanedCount++;
        }
      });

      if (cleanedCount > 0) {
        this.logger.info('Document cleanup completed', { cleanedCount });
      }

      return cleanedCount;
    } catch (error) {
      this.logger.error('Document cleanup failed', error);
      throw error;
    }
  }

  applyUpdate(documentId, update, origin = null) {
    try {
      const doc = this.getDocument(documentId);
      applyUpdateToDoc(doc, update, origin);

      // Update statistics
      const stats = this.documentStats.get(documentId);
      if (stats) {
        stats.updateCount++;
        stats.lastAccessed = new Date();
      }

      this.logger.debug('Update applied to document', {
        documentId,
        updateSize: update.length,
        origin
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to apply update to document', error, {
        documentId,
        updateSize: update ? update.length : 0
      });
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
      return {
        totalDocuments: docs.size,
        totalStats: this.documentStats.size,
        memoryUsage: process.memoryUsage()
      };
    } catch (error) {
      this.logger.error('Failed to get overall stats', error);
      throw error;
    }
  }

  destroy() {
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Destroy all documents
    this.documents.forEach((doc, documentId) => {
      doc.destroy();
    });

    this.documents.clear();
    this.documentStats.clear();

    this.logger.info('DocumentManager destroyed');
  }
}

module.exports = DocumentManager;
