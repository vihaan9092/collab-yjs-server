const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');

class PerformanceCollector extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      metricsInterval: config.metricsInterval || 5000, // 5 seconds
      memoryThreshold: config.memoryThreshold || 0.95, // 95% (more realistic for heap usage)
      absoluteMemoryThreshold: config.absoluteMemoryThreshold || 100 * 1024 * 1024, // 100MB absolute limit
      latencyThreshold: config.latencyThreshold || 1000, // 1 second
      errorRateThreshold: config.errorRateThreshold || 0.05, // 5%
      ...config
    };
    
    this.metrics = {
      system: {
        memory: [],
        cpu: [],
        network: []
      },
      application: {
        connections: [],
        latencies: [],
        throughput: [],
        errors: []
      },
      users: new Map(), // userId -> user metrics
      documents: new Map(), // documentId -> document metrics
      testSession: {
        startTime: null,
        endTime: null,
        duration: 0,
        testType: null,
        configuration: {}
      }
    };
    
    this.alerts = [];
    this.isCollecting = false;
    this.collectionInterval = null;
  }

  /**
   * Start performance data collection
   */
  startCollection(testConfig = {}) {
    if (this.isCollecting) {
      throw new Error('Performance collection already in progress');
    }
    
    this.isCollecting = true;
    this.metrics.testSession.startTime = Date.now();
    this.metrics.testSession.testType = testConfig.testType || 'unknown';
    this.metrics.testSession.configuration = testConfig;
    
    // Start periodic system metrics collection
    this.collectionInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, this.config.metricsInterval);
    
    this.emit('collectionStarted', {
      timestamp: this.metrics.testSession.startTime,
      config: testConfig
    });
    
    console.log('📊 Performance collection started');
  }

  /**
   * Stop performance data collection
   */
  stopCollection() {
    if (!this.isCollecting) {
      return;
    }
    
    this.isCollecting = false;
    this.metrics.testSession.endTime = Date.now();
    this.metrics.testSession.duration = this.metrics.testSession.endTime - this.metrics.testSession.startTime;
    
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
    
    this.emit('collectionStopped', {
      timestamp: this.metrics.testSession.endTime,
      duration: this.metrics.testSession.duration
    });
    
    console.log(`📊 Performance collection stopped (Duration: ${(this.metrics.testSession.duration / 1000).toFixed(2)}s)`);
  }

  /**
   * Collect system-level performance metrics
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
      rss: memUsage.rss,
      usagePercent: memUsage.heapUsed / memUsage.heapTotal
    });

    // Show periodic memory updates (every 30 seconds)
    if (!this.lastMemoryDisplay || timestamp - this.lastMemoryDisplay > 30000) {
      const memoryMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const totalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      console.log(`📊 Memory: ${memoryMB}MB / ${totalMB}MB heap`);
      this.lastMemoryDisplay = timestamp;
    }
    
    // CPU metrics (simplified - in production, use more sophisticated CPU monitoring)
    const cpuUsage = process.cpuUsage();
    this.metrics.system.cpu.push({
      timestamp,
      user: cpuUsage.user,
      system: cpuUsage.system,
      total: cpuUsage.user + cpuUsage.system
    });
    
    // Network metrics (calculated from user data)
    this.collectNetworkMetrics(timestamp);
    
    // Check for performance alerts
    this.checkPerformanceAlerts();
  }

  /**
   * Collect network metrics from user activity
   */
  collectNetworkMetrics(timestamp) {
    let totalBytesIn = 0;
    let totalBytesOut = 0;
    let totalMessages = 0;
    let activeConnections = 0;
    
    this.metrics.users.forEach(userMetrics => {
      totalBytesIn += userMetrics.activity.bytesReceived || 0;
      totalBytesOut += userMetrics.activity.bytesSent || 0;
      totalMessages += userMetrics.activity.messagesReceived || 0;
      totalMessages += userMetrics.activity.messagesSent || 0;
      
      if (userMetrics.connection.connected) {
        activeConnections++;
      }
    });
    
    this.metrics.system.network.push({
      timestamp,
      bytesIn: totalBytesIn,
      bytesOut: totalBytesOut,
      totalMessages,
      activeConnections,
      throughput: totalMessages / (this.config.metricsInterval / 1000) // messages per second
    });
  }

  /**
   * Record user connection event
   */
  recordUserConnection(userId, connectionData) {
    this.metrics.application.connections.push({
      timestamp: Date.now(),
      userId,
      event: 'connected',
      connectionTime: connectionData.connectionTime,
      ...connectionData
    });

    // Add user to users collection if not already present
    if (!this.metrics.users.has(userId)) {
      this.metrics.users.set(userId, {
        connection: {
          connected: true,
          connectionTime: connectionData.connectionTime,
          connectedAt: Date.now()
        },
        activity: {
          editsPerformed: 0,
          messagesReceived: 0,
          messagesSent: 0,
          bytesReceived: 0,
          bytesSent: 0
        },
        performance: {
          averageLatency: 0,
          operationsPerformed: 0
        },
        ...connectionData
      });
    }

    this.emit('userConnected', { userId, connectionData });
  }

  /**
   * Record user disconnection event
   */
  recordUserDisconnection(userId, disconnectionData) {
    this.metrics.application.connections.push({
      timestamp: Date.now(),
      userId,
      event: 'disconnected',
      ...disconnectionData
    });
    
    this.emit('userDisconnected', { userId, disconnectionData });
  }

  /**
   * Record operation latency
   */
  recordLatency(userId, operationId, latency) {
    this.metrics.application.latencies.push({
      timestamp: Date.now(),
      userId,
      operationId,
      latency
    });
    
    // Check latency threshold
    if (latency > this.config.latencyThreshold) {
      this.recordAlert('high_latency', {
        userId,
        operationId,
        latency,
        threshold: this.config.latencyThreshold
      });
    }
    
    this.emit('latencyRecorded', { userId, operationId, latency });
  }

  /**
   * Record error event
   */
  recordError(userId, errorData) {
    this.metrics.application.errors.push({
      timestamp: Date.now(),
      userId,
      ...errorData
    });
    
    this.emit('errorRecorded', { userId, errorData });
  }

  /**
   * Update user metrics
   */
  updateUserMetrics(userId, userMetrics) {
    this.metrics.users.set(userId, {
      ...userMetrics,
      lastUpdated: Date.now()
    });
    
    this.emit('userMetricsUpdated', { userId, metrics: userMetrics });
  }

  /**
   * Record document operation
   */
  recordDocumentOperation(documentId, operation) {
    if (!this.metrics.documents.has(documentId)) {
      this.metrics.documents.set(documentId, {
        operations: [],
        size: 0,
        userCount: 0,
        createdAt: Date.now()
      });
    }
    
    const docMetrics = this.metrics.documents.get(documentId);
    docMetrics.operations.push({
      timestamp: Date.now(),
      ...operation
    });
    
    this.emit('documentOperation', { documentId, operation });
  }

  /**
   * Check for performance alerts
   */
  checkPerformanceAlerts() {
    const latestMemory = this.metrics.system.memory[this.metrics.system.memory.length - 1];
    
    // Only show memory alerts for truly high usage (100MB+)
    if (latestMemory && latestMemory.heapUsed > this.config.absoluteMemoryThreshold) {
      const usedMB = Math.round(latestMemory.heapUsed / 1024 / 1024);
      const thresholdMB = Math.round(this.config.absoluteMemoryThreshold / 1024 / 1024);

      console.log(`⚠️  High Memory Usage: ${usedMB}MB (threshold: ${thresholdMB}MB)`);

      this.recordAlert('high_memory_usage', {
        heapUsedMB: usedMB,
        thresholdMB: thresholdMB,
        message: `High memory usage: ${usedMB}MB`
      });
    }
    
    // Check error rate
    const recentErrors = this.getRecentErrors(60000); // Last minute
    const recentOperations = this.getRecentOperations(60000);
    
    if (recentOperations > 0) {
      const errorRate = recentErrors.length / recentOperations;
      if (errorRate > this.config.errorRateThreshold) {
        this.recordAlert('high_error_rate', {
          errorRate,
          threshold: this.config.errorRateThreshold,
          errorCount: recentErrors.length,
          operationCount: recentOperations
        });
      }
    }
  }

  /**
   * Record performance alert
   */
  recordAlert(type, data) {
    const alert = {
      timestamp: Date.now(),
      type,
      severity: this.getAlertSeverity(type),
      data,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    this.alerts.push(alert);
    this.emit('alert', alert);
    
    console.warn(`⚠️  Performance Alert [${type}]:`, data);
  }

  /**
   * Get alert severity level
   */
  getAlertSeverity(type) {
    const severityMap = {
      high_memory_usage: 'warning',
      high_latency: 'warning',
      high_error_rate: 'critical',
      connection_failure: 'error',
      system_overload: 'critical'
    };
    
    return severityMap[type] || 'info';
  }

  /**
   * Get recent errors within time window
   */
  getRecentErrors(timeWindow) {
    const cutoff = Date.now() - timeWindow;
    return this.metrics.application.errors.filter(error => error.timestamp > cutoff);
  }

  /**
   * Get recent operations within time window
   */
  getRecentOperations(timeWindow) {
    const cutoff = Date.now() - timeWindow;
    return this.metrics.application.latencies.filter(op => op.timestamp > cutoff).length;
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport() {
    const report = {
      testSession: this.metrics.testSession,
      summary: this.generateSummary(),
      systemMetrics: this.analyzeSystemMetrics(),
      applicationMetrics: this.analyzeApplicationMetrics(),
      userMetrics: this.analyzeUserMetrics(),
      documentMetrics: this.analyzeDocumentMetrics(),
      alerts: this.analyzeAlerts(),
      recommendations: this.generateRecommendations()
    };
    
    return report;
  }

  /**
   * Generate performance summary
   */
  /**
   * Format duration in human-readable format
   */
  formatDuration(milliseconds) {
    if (milliseconds < 1000) return `${milliseconds}ms`;
    if (milliseconds < 60000) return `${(milliseconds / 1000).toFixed(1)}s`;
    if (milliseconds < 3600000) return `${(milliseconds / 60000).toFixed(1)}m`;
    return `${(milliseconds / 3600000).toFixed(1)}h`;
  }

  /**
   * Format bytes in human-readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  generateSummary() {
    const totalUsers = this.metrics.users.size;

    // Count unique users who connected (avoid double counting)
    const connectedUserIds = new Set(
      this.metrics.application.connections
        .filter(c => c.event === 'connected')
        .map(c => c.userId)
    );
    const successfulConnections = connectedUserIds.size;

    const totalErrors = this.metrics.application.errors.length;
    const totalOperations = this.metrics.application.latencies.length;

    const avgLatency = totalOperations > 0
      ? this.metrics.application.latencies.reduce((sum, op) => sum + op.latency, 0) / totalOperations
      : 0;

    const errorRate = totalOperations > 0 ? totalErrors / totalOperations : 0;

    return {
      duration: this.formatDuration(this.metrics.testSession.duration),
      durationMs: this.metrics.testSession.duration, // Keep raw value for calculations
      totalUsers,
      successfulConnections,
      connectionSuccessRate: totalUsers > 0 ? successfulConnections / totalUsers : 0,
      totalOperations,
      averageLatency: `${Math.round(avgLatency * 100) / 100}ms`,
      averageLatencyMs: Math.round(avgLatency * 100) / 100, // Keep raw value
      totalErrors,
      errorRate: `${Math.round(errorRate * 10000) / 100}%`,
      alertCount: this.alerts.length
    };
  }

  /**
   * Analyze system metrics
   */
  analyzeSystemMetrics() {
    const memoryMetrics = this.metrics.system.memory;
    const networkMetrics = this.metrics.system.network;
    
    if (memoryMetrics.length === 0) return null;
    
    const peakMemory = Math.max(...memoryMetrics.map(m => m.heapUsed));
    const avgMemory = memoryMetrics.reduce((sum, m) => sum + m.heapUsed, 0) / memoryMetrics.length;
    const maxMemoryUsage = Math.max(...memoryMetrics.map(m => m.usagePercent));
    
    const peakThroughput = networkMetrics.length > 0 
      ? Math.max(...networkMetrics.map(n => n.throughput)) 
      : 0;
    
    return {
      memory: {
        peak: this.formatBytes(peakMemory),
        peakBytes: peakMemory, // Keep raw value
        average: this.formatBytes(avgMemory),
        averageBytes: avgMemory, // Keep raw value
        maxUsagePercent: `${(maxMemoryUsage * 100).toFixed(1)}%`
      },
      network: {
        peakThroughput: `${peakThroughput.toFixed(0)} msg/s`,
        totalMessages: networkMetrics.reduce((sum, n) => sum + n.totalMessages, 0),
        totalBytes: this.formatBytes(networkMetrics.reduce((sum, n) => sum + (n.bytes || 0), 0))
      }
    };
  }

  /**
   * Analyze application metrics
   */
  analyzeApplicationMetrics() {
    const latencies = this.metrics.application.latencies.map(l => l.latency);
    
    if (latencies.length === 0) {
      return {
        latency: { min: 0, max: 0, average: 0, p95: 0, p99: 0 },
        throughput: 0,
        reliability: 100
      };
    }
    
    latencies.sort((a, b) => a - b);
    
    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);
    
    const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    const throughputPerSec = latencies.length / (this.metrics.testSession.duration / 1000);
    const reliabilityPercent = ((latencies.length - this.metrics.application.errors.length) / latencies.length * 100);

    return {
      latency: {
        min: `${Math.min(...latencies).toFixed(1)}ms`,
        max: `${Math.max(...latencies).toFixed(1)}ms`,
        average: `${avgLatency.toFixed(1)}ms`,
        p95: `${(latencies[p95Index] || 0).toFixed(1)}ms`,
        p99: `${(latencies[p99Index] || 0).toFixed(1)}ms`,
        // Keep raw values for calculations
        minMs: Math.min(...latencies),
        maxMs: Math.max(...latencies),
        averageMs: avgLatency,
        p95Ms: latencies[p95Index] || 0,
        p99Ms: latencies[p99Index] || 0
      },
      throughput: `${throughputPerSec.toFixed(1)} ops/s`,
      throughputRaw: throughputPerSec,
      reliability: `${reliabilityPercent.toFixed(1)}%`,
      reliabilityRaw: reliabilityPercent
    };
  }

  /**
   * Analyze user metrics
   */
  analyzeUserMetrics() {
    const userMetricsArray = Array.from(this.metrics.users.values());
    
    if (userMetricsArray.length === 0) return null;
    
    const connectionTimes = userMetricsArray.map(u => u.connection.connectionTime).filter(t => t > 0);
    const totalEdits = userMetricsArray.reduce((sum, u) => sum + (u.activity.editsPerformed || 0), 0);
    const activeUsers = userMetricsArray.filter(u => u.connection.connected).length;
    
    const avgConnectionTime = connectionTimes.length > 0
      ? connectionTimes.reduce((sum, t) => sum + t, 0) / connectionTimes.length
      : 0;

    return {
      totalUsers: userMetricsArray.length,
      activeUsers,
      averageConnectionTime: `${avgConnectionTime.toFixed(1)}ms`,
      averageConnectionTimeMs: avgConnectionTime, // Keep raw value
      totalEdits,
      averageEditsPerUser: totalEdits / userMetricsArray.length,
      userRoles: this.getUserRoleDistribution(userMetricsArray)
    };
  }

  /**
   * Analyze document metrics
   */
  analyzeDocumentMetrics() {
    const documents = Array.from(this.metrics.documents.values());
    
    if (documents.length === 0) return null;
    
    return {
      totalDocuments: documents.length,
      totalOperations: documents.reduce((sum, d) => sum + d.operations.length, 0),
      averageOperationsPerDocument: documents.reduce((sum, d) => sum + d.operations.length, 0) / documents.length
    };
  }

  /**
   * Analyze alerts
   */
  analyzeAlerts() {
    const alertsByType = {};
    const alertsBySeverity = {};
    
    this.alerts.forEach(alert => {
      alertsByType[alert.type] = (alertsByType[alert.type] || 0) + 1;
      alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;
    });
    
    return {
      total: this.alerts.length,
      byType: alertsByType,
      bySeverity: alertsBySeverity,
      recent: this.alerts.filter(a => Date.now() - a.timestamp < 300000) // Last 5 minutes
    };
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    const summary = this.generateSummary();
    const systemMetrics = this.analyzeSystemMetrics();
    
    // Latency recommendations
    if (summary.averageLatency > 500) {
      recommendations.push({
        type: 'latency',
        priority: 'high',
        message: 'High average latency detected',
        suggestion: 'Consider enabling debouncing or optimizing message processing'
      });
    }
    
    // Memory recommendations
    if (systemMetrics && parseFloat(systemMetrics.memory.maxUsagePercent) > 80) {
      recommendations.push({
        type: 'memory',
        priority: 'medium',
        message: 'High memory usage detected',
        suggestion: 'Enable garbage collection optimization or increase memory limits'
      });
    }
    
    // Error rate recommendations
    if (summary.errorRate > 5) {
      recommendations.push({
        type: 'reliability',
        priority: 'critical',
        message: 'High error rate detected',
        suggestion: 'Review error logs and implement additional error handling'
      });
    }
    
    // Connection recommendations
    if (summary.connectionSuccessRate < 0.95) {
      recommendations.push({
        type: 'connectivity',
        priority: 'high',
        message: 'Low connection success rate',
        suggestion: 'Check network stability and authentication configuration'
      });
    }
    
    return recommendations;
  }

  /**
   * Get user role distribution
   */
  getUserRoleDistribution(userMetricsArray) {
    const roleCount = {};
    userMetricsArray.forEach(user => {
      const role = user.role || 'unknown';
      roleCount[role] = (roleCount[role] || 0) + 1;
    });
    return roleCount;
  }

  /**
   * Save report to file
   */
  async saveReport(filename = null) {
    const report = this.generateReport();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFilename = `performance-report-${timestamp}.json`;
    const filepath = path.join(__dirname, '..', 'reports', filename || defaultFilename);
    
    // Ensure reports directory exists
    const reportsDir = path.dirname(filepath);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    try {
      fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
      console.log(`📄 Performance report saved: ${filepath}`);
      return filepath;
    } catch (error) {
      console.error('❌ Failed to save performance report:', error.message);
      throw error;
    }
  }

  /**
   * Clean up old metrics to prevent memory leaks
   */
  cleanup(retentionPeriod = 3600000) { // 1 hour default
    const cutoff = Date.now() - retentionPeriod;
    
    // Clean system metrics
    this.metrics.system.memory = this.metrics.system.memory.filter(m => m.timestamp > cutoff);
    this.metrics.system.cpu = this.metrics.system.cpu.filter(c => c.timestamp > cutoff);
    this.metrics.system.network = this.metrics.system.network.filter(n => n.timestamp > cutoff);
    
    // Clean application metrics
    this.metrics.application.connections = this.metrics.application.connections.filter(c => c.timestamp > cutoff);
    this.metrics.application.latencies = this.metrics.application.latencies.filter(l => l.timestamp > cutoff);
    this.metrics.application.errors = this.metrics.application.errors.filter(e => e.timestamp > cutoff);
    
    // Clean alerts
    this.alerts = this.alerts.filter(a => a.timestamp > cutoff);
    
    console.log('🧹 Performance metrics cleaned up');
  }
}

module.exports = PerformanceCollector;
