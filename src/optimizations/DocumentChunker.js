/**
 * Document Chunking Service for Large Document Optimization
 * Handles splitting large documents into manageable chunks for better performance
 */

const Y = require('yjs');

class DocumentChunker {
  constructor(logger, config = {}) {
    this.logger = logger;
    this.chunkSize = config.chunkSize || 64 * 1024; // 64KB chunks
    this.maxChunkSize = config.maxChunkSize || 256 * 1024; // 256KB max
    this.compressionEnabled = config.compressionEnabled !== false;
  }

  /**
   * Split large document updates into smaller chunks
   * @param {Uint8Array} update - Large YJS update
   * @returns {Array<Uint8Array>} Array of chunked updates
   */
  chunkUpdate(update) {
    if (update.length <= this.chunkSize) {
      return [update];
    }

    const chunks = [];
    let offset = 0;

    while (offset < update.length) {
      const chunkEnd = Math.min(offset + this.chunkSize, update.length);
      const chunk = update.slice(offset, chunkEnd);
      chunks.push(chunk);
      offset = chunkEnd;
    }

    this.logger.debug('Document update chunked', {
      originalSize: update.length,
      chunkCount: chunks.length,
      avgChunkSize: Math.round(update.length / chunks.length)
    });

    return chunks;
  }

  /**
   * Create incremental updates for large documents
   * @param {Y.Doc} doc - YJS document
   * @param {Uint8Array} lastState - Previous document state
   * @returns {Uint8Array} Incremental update
   */
  createIncrementalUpdate(doc, lastState) {
    try {
      if (!lastState) {
        return Y.encodeStateAsUpdate(doc);
      }

      const currentState = Y.encodeStateVector(doc);
      const diff = Y.diffUpdate(Y.encodeStateAsUpdate(doc), lastState);
      
      this.logger.debug('Incremental update created', {
        currentStateSize: currentState.length,
        diffSize: diff.length,
        compressionRatio: diff.length / currentState.length
      });

      return diff;
    } catch (error) {
      this.logger.error('Failed to create incremental update', error);
      return Y.encodeStateAsUpdate(doc);
    }
  }

  /**
   * Compress document state for storage/transmission
   * @param {Uint8Array} data - Document data
   * @returns {Uint8Array} Compressed data
   */
  async compressData(data) {
    if (!this.compressionEnabled || data.length < 1024) {
      return data;
    }

    try {
      const { gzip } = require('zlib');
      const { promisify } = require('util');
      const gzipAsync = promisify(gzip);
      
      const compressed = await gzipAsync(data);
      
      this.logger.debug('Data compressed', {
        originalSize: data.length,
        compressedSize: compressed.length,
        compressionRatio: (compressed.length / data.length * 100).toFixed(2) + '%'
      });

      return compressed;
    } catch (error) {
      this.logger.error('Compression failed', error);
      return data;
    }
  }

  /**
   * Decompress document state
   * @param {Uint8Array} compressedData - Compressed data
   * @returns {Uint8Array} Decompressed data
   */
  async decompressData(compressedData) {
    if (!this.compressionEnabled) {
      return compressedData;
    }

    try {
      const { gunzip } = require('zlib');
      const { promisify } = require('util');
      const gunzipAsync = promisify(gunzip);
      
      return await gunzipAsync(compressedData);
    } catch (error) {
      this.logger.error('Decompression failed', error);
      return compressedData;
    }
  }

  /**
   * Optimize document for transmission
   * @param {Y.Doc} doc - YJS document
   * @param {Object} options - Optimization options
   * @returns {Object} Optimized document data
   */
  async optimizeForTransmission(doc, options = {}) {
    const {
      includeHistory = false,
      maxHistorySize = 100,
      compressionLevel = 6
    } = options;

    try {
      let update;
      
      if (includeHistory) {
        // Include limited history for undo/redo
        update = Y.encodeStateAsUpdate(doc);
      } else {
        // Only current state, no history
        const snapshot = Y.snapshot(doc);
        update = Y.encodeStateAsUpdate(doc, snapshot);
      }

      // Compress if beneficial
      const compressed = await this.compressData(update);
      
      return {
        data: compressed,
        originalSize: update.length,
        compressedSize: compressed.length,
        isCompressed: compressed.length < update.length,
        metadata: {
          timestamp: Date.now(),
          version: doc.clientID,
          includesHistory: includeHistory
        }
      };
    } catch (error) {
      this.logger.error('Document optimization failed', error);
      throw error;
    }
  }

  /**
   * Calculate optimal chunk size based on network conditions
   * @param {Object} networkStats - Network performance statistics
   * @returns {number} Optimal chunk size
   */
  calculateOptimalChunkSize(networkStats = {}) {
    const {
      latency = 50,
      bandwidth = 1000000, // 1Mbps default
      packetLoss = 0
    } = networkStats;

    // Adjust chunk size based on network conditions
    let optimalSize = this.chunkSize;

    // Higher latency = larger chunks
    if (latency > 100) {
      optimalSize *= 2;
    } else if (latency < 20) {
      optimalSize *= 0.5;
    }

    // Lower bandwidth = smaller chunks
    if (bandwidth < 500000) { // < 500Kbps
      optimalSize *= 0.5;
    }

    // Packet loss = smaller chunks
    if (packetLoss > 0.01) { // > 1% packet loss
      optimalSize *= 0.7;
    }

    // Ensure within bounds
    optimalSize = Math.max(8192, Math.min(optimalSize, this.maxChunkSize));

    this.logger.debug('Optimal chunk size calculated', {
      networkLatency: latency,
      networkBandwidth: bandwidth,
      packetLoss: packetLoss,
      optimalChunkSize: optimalSize
    });

    return Math.round(optimalSize);
  }
}

module.exports = DocumentChunker;
