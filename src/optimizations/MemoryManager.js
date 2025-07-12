/**
 * Memory Management Service for Large Document Optimization
 * Handles memory optimization, garbage collection, and resource management
 */

const EventEmitter = require('events');

class MemoryManager extends EventEmitter {
  constructor(logger, config = {}) {
    super();
    this.logger = logger;
    this.config = {
      maxMemoryUsage: config.maxMemoryUsage || 512 * 1024 * 1024, // 512MB
      gcThreshold: config.gcThreshold || 0.8, // 80% memory usage
      gcInterval: config.gcInterval || 30000, // 30 seconds
      documentCacheSize: config.documentCacheSize || 100,
      historyLimit: config.historyLimit || 50,
      ...config
    };

    this.documentCache = new Map();
    this.memoryStats = {
      peakUsage: 0,
      gcCount: 0,
      lastGC: null,
      documentsEvicted: 0
    };

    this.startMemoryMonitoring();
  }

  /**
   * Start memory monitoring and automatic garbage collection
   */
  startMemoryMonitoring() {
    setInterval(() => {
      this.checkMemoryUsage();
    }, this.config.gcInterval);

    // Monitor Node.js garbage collection
    if (global.gc) {
      this.logger.info('Manual garbage collection available');
    }
  }

  /**
   * Check current memory usage and trigger cleanup if needed
   */
  checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const usedMB = memUsage.heapUsed / 1024 / 1024;
    const totalMB = memUsage.heapTotal / 1024 / 1024;

    // Fix: Use heapTotal instead of arbitrary maxMemoryUsage for percentage calculation
    const usagePercent = memUsage.heapUsed / memUsage.heapTotal;
    const configUsagePercent = memUsage.heapUsed / this.config.maxMemoryUsage;

    // Update peak usage
    if (memUsage.heapUsed > this.memoryStats.peakUsage) {
      this.memoryStats.peakUsage = memUsage.heapUsed;
    }

    this.logger.debug('Memory usage check', {
      heapUsed: `${usedMB.toFixed(2)}MB`,
      heapTotal: `${totalMB.toFixed(2)}MB`,
      heapUsagePercent: `${(usagePercent * 100).toFixed(2)}%`,
      configUsagePercent: `${(configUsagePercent * 100).toFixed(2)}%`,
      documentsCached: this.documentCache.size,
      maxMemoryLimit: `${(this.config.maxMemoryUsage / 1024 / 1024).toFixed(2)}MB`
    });

    // Trigger cleanup if memory usage is high (use the more conservative threshold)
    const shouldCleanup = usagePercent > this.config.gcThreshold || configUsagePercent > this.config.gcThreshold;

    if (shouldCleanup) {
      this.performMemoryCleanup();
    }

    // Emit memory stats for monitoring (use heap-based percentage for alerts)
    this.emit('memoryStats', {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      usagePercent: usagePercent, // Use heap-based percentage
      configUsagePercent: configUsagePercent,
      documentsCached: this.documentCache.size
    });
  }

  /**
   * Perform memory cleanup operations
   */
  async performMemoryCleanup() {
    this.logger.info('Starting memory cleanup');
    const startTime = Date.now();

    try {
      // 1. Clean document cache
      const evictedDocs = this.evictOldDocuments();
      
      // 2. Trigger garbage collection if available
      if (global.gc) {
        global.gc();
        this.memoryStats.gcCount++;
        this.memoryStats.lastGC = new Date();
      }

      // 3. Clean up event listeners
      this.cleanupEventListeners();

      const duration = Date.now() - startTime;
      this.logger.info('Memory cleanup completed', {
        duration: `${duration}ms`,
        documentsEvicted: evictedDocs,
        totalGCCount: this.memoryStats.gcCount
      });

    } catch (error) {
      this.logger.error('Memory cleanup failed', error);
    }
  }

  /**
   * Evict old documents from cache
   * @returns {number} Number of documents evicted
   */
  evictOldDocuments() {
    if (this.documentCache.size <= this.config.documentCacheSize) {
      return 0;
    }

    const sortedDocs = Array.from(this.documentCache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    const toEvict = this.documentCache.size - this.config.documentCacheSize;
    let evicted = 0;

    for (let i = 0; i < toEvict && i < sortedDocs.length; i++) {
      const [docId, docData] = sortedDocs[i];
      
      // Only evict if no active connections
      if (docData.connectionCount === 0) {
        this.documentCache.delete(docId);
        evicted++;
        this.memoryStats.documentsEvicted++;
        
        this.logger.debug('Document evicted from cache', {
          documentId: docId,
          lastAccessed: docData.lastAccessed,
          size: docData.size
        });
      }
    }

    return evicted;
  }

  /**
   * Clean up unused event listeners
   */
  cleanupEventListeners() {
    // Remove listeners that haven't been active
    const maxListeners = this.getMaxListeners();
    const currentListeners = this.listenerCount('memoryStats');
    
    if (currentListeners > maxListeners * 0.8) {
      this.logger.warn('High number of event listeners detected', {
        current: currentListeners,
        max: maxListeners
      });
    }
  }

  /**
   * Optimize document for memory efficiency
   * @param {Object} doc - YJS document
   * @param {string} documentId - Document ID
   * @returns {Object} Optimized document metadata
   */
  optimizeDocument(doc, documentId) {
    try {
      const beforeSize = this.getDocumentSize(doc);
      
      // Limit history to reduce memory usage
      if (doc.history && doc.history.length > this.config.historyLimit) {
        doc.history = doc.history.slice(-this.config.historyLimit);
      }

      // Clean up unused awareness states
      if (doc.awareness) {
        const activeStates = new Set();
        doc.conns.forEach((_, ws) => {
          if (ws.readyState === 1) { // WebSocket.OPEN
            activeStates.add(ws.user?.id);
          }
        });

        // Remove awareness states for disconnected users
        doc.awareness.getStates().forEach((state, clientId) => {
          if (!activeStates.has(state.user?.id)) {
            doc.awareness.setLocalStateField(clientId, null);
          }
        });
      }

      const afterSize = this.getDocumentSize(doc);
      const sizeSaved = beforeSize - afterSize;

      // Update cache
      this.documentCache.set(documentId, {
        lastAccessed: Date.now(),
        size: afterSize,
        connectionCount: doc.conns ? doc.conns.size : 0,
        optimized: true
      });

      this.logger.debug('Document optimized', {
        documentId,
        beforeSize,
        afterSize,
        sizeSaved,
        compressionRatio: sizeSaved > 0 ? (sizeSaved / beforeSize * 100).toFixed(2) + '%' : '0%'
      });

      return {
        originalSize: beforeSize,
        optimizedSize: afterSize,
        sizeSaved,
        compressionRatio: sizeSaved / beforeSize
      };

    } catch (error) {
      this.logger.error('Document optimization failed', error, { documentId });
      return null;
    }
  }

  /**
   * Get approximate document size in memory
   * @param {Object} doc - YJS document
   * @returns {number} Size in bytes
   */
  getDocumentSize(doc) {
    try {
      // Rough estimation of document size
      const stateVector = doc.getStateVector ? doc.getStateVector() : new Uint8Array();
      const update = doc.encodeStateAsUpdate ? doc.encodeStateAsUpdate() : new Uint8Array();
      
      let size = stateVector.length + update.length;
      
      // Add awareness size
      if (doc.awareness) {
        size += JSON.stringify(doc.awareness.getStates()).length;
      }
      
      // Add connection overhead
      if (doc.conns) {
        size += doc.conns.size * 1024; // Estimate 1KB per connection
      }

      return size;
    } catch (error) {
      this.logger.error('Failed to calculate document size', error);
      return 0;
    }
  }

  /**
   * Get memory statistics
   * @returns {Object} Memory statistics
   */
  getMemoryStats() {
    const memUsage = process.memoryUsage();
    
    return {
      heap: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        usagePercent: (memUsage.heapUsed / this.config.maxMemoryUsage * 100).toFixed(2)
      },
      cache: {
        documentCount: this.documentCache.size,
        maxSize: this.config.documentCacheSize
      },
      gc: {
        count: this.memoryStats.gcCount,
        lastRun: this.memoryStats.lastGC,
        documentsEvicted: this.memoryStats.documentsEvicted
      },
      peak: {
        usage: this.memoryStats.peakUsage,
        usagePercent: (this.memoryStats.peakUsage / this.config.maxMemoryUsage * 100).toFixed(2)
      }
    };
  }

  /**
   * Force garbage collection (if available)
   */
  forceGarbageCollection() {
    if (global.gc) {
      global.gc();
      this.memoryStats.gcCount++;
      this.memoryStats.lastGC = new Date();
      this.logger.info('Manual garbage collection triggered');
      return true;
    }
    return false;
  }

  /**
   * Cleanup and destroy the memory manager
   */
  destroy() {
    this.documentCache.clear();
    this.removeAllListeners();
    this.logger.info('MemoryManager destroyed');
  }
}

module.exports = MemoryManager;
