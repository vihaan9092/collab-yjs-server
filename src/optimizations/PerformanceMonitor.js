/**
 * Performance Monitor for Large Document Optimization
 * Tracks performance metrics, identifies bottlenecks, and provides optimization insights
 */

const EventEmitter = require('events');

class PerformanceMonitor extends EventEmitter {
  constructor(logger, config = {}) {
    super();
    this.logger = logger;
    this.config = {
      metricsInterval: config.metricsInterval || 30000, // 30 seconds
      alertThresholds: {
        memoryUsage: config.memoryThreshold || 0.8, // 80%
        cpuUsage: config.cpuThreshold || 0.7, // 70%
        latency: config.latencyThreshold || 1000, // 1 second
        errorRate: config.errorRateThreshold || 0.05, // 5%
        ...config.alertThresholds
      },
      retentionPeriod: config.retentionPeriod || 3600000, // 1 hour
      ...config
    };

    this.metrics = {
      documents: new Map(), // documentId -> metrics
      connections: new Map(), // connectionId -> metrics
      system: {
        memory: [],
        cpu: [],
        network: [],
        errors: []
      },
      performance: {
        updateLatency: [],
        syncLatency: [],
        messageRate: [],
        throughput: []
      }
    };

    this.alerts = [];
    this.startMonitoring();
  }

  /**
   * Start performance monitoring
   */
  startMonitoring() {
    // Collect metrics periodically
    setInterval(() => {
      this.collectSystemMetrics();
      this.collectPerformanceMetrics();
      this.checkAlerts();
      this.cleanupOldMetrics();
    }, this.config.metricsInterval);

    this.logger.info('Performance monitoring started', {
      interval: this.config.metricsInterval,
      thresholds: this.config.alertThresholds
    });
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    const timestamp = Date.now();
    
    // Memory metrics
    const memUsage = process.memoryUsage();
    this.metrics.system.memory.push({
      timestamp,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss
    });

    // CPU metrics (simplified)
    const cpuUsage = process.cpuUsage();
    this.metrics.system.cpu.push({
      timestamp,
      user: cpuUsage.user,
      system: cpuUsage.system
    });

    // Network metrics (if available)
    this.collectNetworkMetrics(timestamp);
  }

  /**
   * Collect network metrics
   * @param {number} timestamp - Current timestamp
   */
  collectNetworkMetrics(timestamp) {
    // Calculate network metrics from connection data
    let totalBytesIn = 0;
    let totalBytesOut = 0;
    let totalMessages = 0;

    this.metrics.connections.forEach(connMetrics => {
      totalBytesIn += connMetrics.bytesReceived || 0;
      totalBytesOut += connMetrics.bytesSent || 0;
      totalMessages += connMetrics.messageCount || 0;
    });

    this.metrics.system.network.push({
      timestamp,
      bytesIn: totalBytesIn,
      bytesOut: totalBytesOut,
      totalMessages,
      activeConnections: this.metrics.connections.size
    });
  }

  /**
   * Collect performance metrics
   */
  collectPerformanceMetrics() {
    const timestamp = Date.now();

    // Calculate average latencies
    const updateLatencies = [];
    const syncLatencies = [];
    const messageRates = [];

    this.metrics.documents.forEach(docMetrics => {
      if (docMetrics.updateLatency) updateLatencies.push(docMetrics.updateLatency);
      if (docMetrics.syncLatency) syncLatencies.push(docMetrics.syncLatency);
      if (docMetrics.messageRate) messageRates.push(docMetrics.messageRate);
    });

    // Store performance metrics
    if (updateLatencies.length > 0) {
      this.metrics.performance.updateLatency.push({
        timestamp,
        average: updateLatencies.reduce((a, b) => a + b, 0) / updateLatencies.length,
        max: Math.max(...updateLatencies),
        min: Math.min(...updateLatencies)
      });
    }

    if (syncLatencies.length > 0) {
      this.metrics.performance.syncLatency.push({
        timestamp,
        average: syncLatencies.reduce((a, b) => a + b, 0) / syncLatencies.length,
        max: Math.max(...syncLatencies),
        min: Math.min(...syncLatencies)
      });
    }

    if (messageRates.length > 0) {
      this.metrics.performance.messageRate.push({
        timestamp,
        total: messageRates.reduce((a, b) => a + b, 0),
        average: messageRates.reduce((a, b) => a + b, 0) / messageRates.length
      });
    }
  }

  /**
   * Track document performance
   * @param {string} documentId - Document ID
   * @param {Object} metrics - Performance metrics
   */
  trackDocumentPerformance(documentId, metrics) {
    if (!this.metrics.documents.has(documentId)) {
      this.metrics.documents.set(documentId, {
        createdAt: Date.now(),
        updateCount: 0,
        totalSize: 0,
        connectionCount: 0,
        updateLatency: 0,
        syncLatency: 0,
        messageRate: 0,
        errorCount: 0
      });
    }

    const docMetrics = this.metrics.documents.get(documentId);
    Object.assign(docMetrics, {
      ...metrics,
      lastUpdated: Date.now()
    });

    // Emit performance event
    this.emit('documentPerformance', {
      documentId,
      metrics: docMetrics
    });
  }

  /**
   * Track connection performance
   * @param {string} connectionId - Connection ID
   * @param {Object} metrics - Connection metrics
   */
  trackConnectionPerformance(connectionId, metrics) {
    if (!this.metrics.connections.has(connectionId)) {
      this.metrics.connections.set(connectionId, {
        connectedAt: Date.now(),
        messageCount: 0,
        bytesReceived: 0,
        bytesSent: 0,
        latency: 0,
        errorCount: 0
      });
    }

    const connMetrics = this.metrics.connections.get(connectionId);
    Object.assign(connMetrics, {
      ...metrics,
      lastActivity: Date.now()
    });
  }

  /**
   * Record an error
   * @param {string} type - Error type
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   */
  recordError(type, error, context = {}) {
    const errorRecord = {
      timestamp: Date.now(),
      type,
      message: error.message,
      stack: error.stack,
      context
    };

    this.metrics.system.errors.push(errorRecord);

    // Update error counts
    if (context.documentId) {
      const docMetrics = this.metrics.documents.get(context.documentId);
      if (docMetrics) {
        docMetrics.errorCount++;
      }
    }

    if (context.connectionId) {
      const connMetrics = this.metrics.connections.get(context.connectionId);
      if (connMetrics) {
        connMetrics.errorCount++;
      }
    }

    this.emit('error', errorRecord);
  }

  /**
   * Check for performance alerts
   */
  checkAlerts() {
    const now = Date.now();
    const alerts = [];

    // Memory usage alert - use more conservative calculation
    const latestMemory = this.metrics.system.memory[this.metrics.system.memory.length - 1];
    if (latestMemory) {
      const memoryUsage = latestMemory.heapUsed / latestMemory.heapTotal;

      // Use configurable memory threshold instead of hardcoded 90%
      const memoryThreshold = this.config.alertThresholds?.memoryUsage || 0.9;
      if (memoryUsage > memoryThreshold) {
        alerts.push({
          type: 'memory',
          severity: 'warning',
          message: `High memory usage: ${(memoryUsage * 100).toFixed(2)}%`,
          value: memoryUsage,
          threshold: memoryThreshold
        });
      }
    }

    // Latency alerts
    const latestUpdateLatency = this.metrics.performance.updateLatency[this.metrics.performance.updateLatency.length - 1];
    if (latestUpdateLatency && latestUpdateLatency.average > this.config.alertThresholds.latency) {
      alerts.push({
        type: 'latency',
        severity: 'warning',
        message: `High update latency: ${latestUpdateLatency.average.toFixed(2)}ms`,
        value: latestUpdateLatency.average,
        threshold: this.config.alertThresholds.latency
      });
    }

    // Error rate alert
    const recentErrors = this.metrics.system.errors.filter(
      error => now - error.timestamp < 300000 // Last 5 minutes
    );
    const errorRate = recentErrors.length / 300; // Errors per second
    if (errorRate > this.config.alertThresholds.errorRate) {
      alerts.push({
        type: 'errorRate',
        severity: 'critical',
        message: `High error rate: ${errorRate.toFixed(3)} errors/sec`,
        value: errorRate,
        threshold: this.config.alertThresholds.errorRate
      });
    }

    // Process alerts
    alerts.forEach(alert => {
      this.alerts.push({ ...alert, timestamp: now });
      this.emit('alert', alert);
      
      this.logger.warn('Performance alert triggered', alert);
    });
  }

  /**
   * Clean up old metrics to prevent memory leaks
   */
  cleanupOldMetrics() {
    const cutoff = Date.now() - this.config.retentionPeriod;

    // Clean system metrics
    Object.keys(this.metrics.system).forEach(key => {
      if (Array.isArray(this.metrics.system[key])) {
        this.metrics.system[key] = this.metrics.system[key].filter(
          metric => metric.timestamp > cutoff
        );
      }
    });

    // Clean performance metrics
    Object.keys(this.metrics.performance).forEach(key => {
      this.metrics.performance[key] = this.metrics.performance[key].filter(
        metric => metric.timestamp > cutoff
      );
    });

    // Clean old alerts
    this.alerts = this.alerts.filter(alert => alert.timestamp > cutoff);

    // Clean inactive connections
    this.metrics.connections.forEach((metrics, connectionId) => {
      if (metrics.lastActivity && metrics.lastActivity < cutoff) {
        this.metrics.connections.delete(connectionId);
      }
    });
  }

  /**
   * Get performance summary
   * @returns {Object} Performance summary
   */
  getPerformanceSummary() {
    const now = Date.now();
    const last5Min = now - 300000;

    // Recent metrics
    const recentMemory = this.metrics.system.memory.filter(m => m.timestamp > last5Min);
    const recentLatency = this.metrics.performance.updateLatency.filter(l => l.timestamp > last5Min);
    const recentErrors = this.metrics.system.errors.filter(e => e.timestamp > last5Min);

    return {
      timestamp: now,
      system: {
        memory: {
          current: recentMemory.length > 0 ? recentMemory[recentMemory.length - 1] : null,
          average: recentMemory.length > 0 ? 
            recentMemory.reduce((sum, m) => sum + m.heapUsed, 0) / recentMemory.length : 0
        },
        connections: {
          active: this.metrics.connections.size,
          documents: this.metrics.documents.size
        }
      },
      performance: {
        latency: {
          current: recentLatency.length > 0 ? recentLatency[recentLatency.length - 1].average : 0,
          average: recentLatency.length > 0 ?
            recentLatency.reduce((sum, l) => sum + l.average, 0) / recentLatency.length : 0
        },
        errors: {
          count: recentErrors.length,
          rate: recentErrors.length / 300 // per second
        }
      },
      alerts: {
        active: this.alerts.filter(a => now - a.timestamp < 300000).length,
        recent: this.alerts.slice(-5)
      }
    };
  }

  /**
   * Get optimization recommendations
   * @returns {Array} Array of optimization recommendations
   */
  getOptimizationRecommendations() {
    const recommendations = [];
    const summary = this.getPerformanceSummary();

    // Memory recommendations
    if (summary.system.memory.current) {
      const memUsage = summary.system.memory.current.heapUsed / summary.system.memory.current.heapTotal;
      if (memUsage > 0.7) {
        recommendations.push({
          type: 'memory',
          priority: 'high',
          message: 'Consider enabling garbage collection or increasing memory limits',
          action: 'Enable NODE_OPTIONS="--max-old-space-size=4096" or implement document caching'
        });
      }
    }

    // Latency recommendations
    if (summary.performance.latency.average > 500) {
      recommendations.push({
        type: 'latency',
        priority: 'medium',
        message: 'High latency detected, consider optimizing debouncing',
        action: 'Increase DEBOUNCE_DELAY or enable batching for large documents'
      });
    }

    // Connection recommendations
    if (summary.system.connections.active > 50) {
      recommendations.push({
        type: 'connections',
        priority: 'medium',
        message: 'High connection count, consider connection pooling',
        action: 'Implement connection limits per document or load balancing'
      });
    }

    return recommendations;
  }

  /**
   * Destroy the performance monitor
   */
  destroy() {
    this.metrics.documents.clear();
    this.metrics.connections.clear();
    this.alerts = [];
    this.removeAllListeners();
    this.logger.info('PerformanceMonitor destroyed');
  }
}

module.exports = PerformanceMonitor;
