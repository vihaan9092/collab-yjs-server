/**
 * Redis Monitor - Comprehensive Redis performance monitoring
 * Tracks memory usage, command frequency, connection count, and key operations
 */

const Redis = require('ioredis');
const EventEmitter = require('events');

class RedisMonitor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      redisUrl: config.redisUrl || 'redis://localhost:6379',
      monitoringInterval: config.monitoringInterval || 1000, // 1 second
      trackCommands: config.trackCommands !== false,
      trackMemory: config.trackMemory !== false,
      trackConnections: config.trackConnections !== false,
      trackKeys: config.trackKeys !== false,
      ...config
    };

    this.redis = new Redis(this.config.redisUrl, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.monitorClient = new Redis(this.config.redisUrl, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.metrics = {
      memory: {
        initial: 0,
        current: 0,
        peak: 0,
        history: []
      },
      commands: {
        total: 0,
        perSecond: 0,
        types: {},
        history: []
      },
      connections: {
        current: 0,
        peak: 0,
        history: []
      },
      keys: {
        total: 0,
        byPattern: {},
        history: []
      },
      performance: {
        latency: [],
        throughput: [],
        errorRate: 0
      }
    };

    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.commandMonitor = null;
    this.startTime = null;
  }

  /**
   * Initialize Redis monitoring
   */
  async initialize() {
    console.log('🔴 Initializing Redis Monitor...');
    
    try {
      // Test Redis connection
      await this.redis.ping();
      console.log('✅ Redis connection established');
      
      // Get initial metrics
      await this.captureInitialMetrics();
      
      // Setup command monitoring if enabled
      if (this.config.trackCommands) {
        await this.setupCommandMonitoring();
      }
      
      console.log('✅ Redis Monitor initialized');
      return true;
      
    } catch (error) {
      console.error('❌ Redis Monitor initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Capture initial Redis metrics
   */
  async captureInitialMetrics() {
    try {
      // Get memory info
      if (this.config.trackMemory) {
        const memoryInfo = await this.getMemoryInfo();
        this.metrics.memory.initial = memoryInfo.used_memory;
        this.metrics.memory.current = memoryInfo.used_memory;
      }

      // Get connection info
      if (this.config.trackConnections) {
        const connectionInfo = await this.getConnectionInfo();
        this.metrics.connections.current = connectionInfo.connected_clients;
      }

      // Get key count
      if (this.config.trackKeys) {
        const keyCount = await this.redis.dbsize();
        this.metrics.keys.total = keyCount;
      }

      console.log('📊 Initial Redis metrics captured');
      
    } catch (error) {
      console.error('Error capturing initial metrics:', error.message);
    }
  }

  /**
   * Setup Redis command monitoring
   */
  async setupCommandMonitoring() {
    try {
      this.commandMonitor = await this.monitorClient.monitor();
      
      this.commandMonitor.on('monitor', (time, args, source, database) => {
        if (!this.isMonitoring) return;
        
        const command = args[0]?.toUpperCase();
        if (!command) return;
        
        // Track command statistics
        this.metrics.commands.total++;
        
        if (!this.metrics.commands.types[command]) {
          this.metrics.commands.types[command] = 0;
        }
        this.metrics.commands.types[command]++;
        
        // Track command history with timestamp
        this.metrics.commands.history.push({
          command,
          args: args.slice(1),
          timestamp: time * 1000, // Convert to milliseconds
          source,
          database
        });
        
        // Emit command event for real-time monitoring
        this.emit('command', {
          command,
          args: args.slice(1),
          timestamp: time * 1000,
          source,
          database
        });
      });
      
      console.log('✅ Redis command monitoring enabled');
      
    } catch (error) {
      console.error('Error setting up command monitoring:', error.message);
    }
  }

  /**
   * Start monitoring Redis metrics
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      console.log('⚠️  Redis monitoring is already running');
      return;
    }

    console.log('🚀 Starting Redis monitoring...');
    this.isMonitoring = true;
    this.startTime = Date.now();
    
    // Start periodic metric collection
    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
    }, this.config.monitoringInterval);
    
    console.log(`✅ Redis monitoring started (interval: ${this.config.monitoringInterval}ms)`);
  }

  /**
   * Stop monitoring Redis metrics
   */
  async stopMonitoring() {
    if (!this.isMonitoring) {
      console.log('⚠️  Redis monitoring is not running');
      return;
    }

    console.log('🛑 Stopping Redis monitoring...');
    this.isMonitoring = false;
    
    // Clear monitoring interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    // Collect final metrics
    await this.collectMetrics();
    
    console.log('✅ Redis monitoring stopped');
  }

  /**
   * Collect current Redis metrics
   */
  async collectMetrics() {
    try {
      const timestamp = Date.now();
      
      // Collect memory metrics
      if (this.config.trackMemory) {
        const memoryInfo = await this.getMemoryInfo();
        this.metrics.memory.current = memoryInfo.used_memory;
        this.metrics.memory.peak = Math.max(this.metrics.memory.peak, memoryInfo.used_memory);
        
        this.metrics.memory.history.push({
          timestamp,
          used_memory: memoryInfo.used_memory,
          used_memory_human: memoryInfo.used_memory_human,
          used_memory_rss: memoryInfo.used_memory_rss,
          mem_fragmentation_ratio: memoryInfo.mem_fragmentation_ratio
        });
      }

      // Collect connection metrics
      if (this.config.trackConnections) {
        const connectionInfo = await this.getConnectionInfo();
        this.metrics.connections.current = connectionInfo.connected_clients;
        this.metrics.connections.peak = Math.max(this.metrics.connections.peak, connectionInfo.connected_clients);
        
        this.metrics.connections.history.push({
          timestamp,
          connected_clients: connectionInfo.connected_clients,
          client_recent_max_input_buffer: connectionInfo.client_recent_max_input_buffer,
          client_recent_max_output_buffer: connectionInfo.client_recent_max_output_buffer
        });
      }

      // Collect key metrics
      if (this.config.trackKeys) {
        const keyCount = await this.redis.dbsize();
        this.metrics.keys.total = keyCount;
        
        this.metrics.keys.history.push({
          timestamp,
          total: keyCount
        });
        
        // Track keys by pattern (for collaboration-specific keys)
        await this.trackKeyPatterns();
      }

      // Calculate performance metrics
      this.calculatePerformanceMetrics();
      
    } catch (error) {
      console.error('Error collecting Redis metrics:', error.message);
      this.metrics.performance.errorRate++;
    }
  }

  /**
   * Get Redis memory information
   */
  async getMemoryInfo() {
    const info = await this.redis.info('memory');
    const memoryData = {};
    
    info.split('\r\n').forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (key.startsWith('used_memory') || key.includes('mem_')) {
          memoryData[key] = isNaN(value) ? value : parseInt(value);
        }
      }
    });
    
    return memoryData;
  }

  /**
   * Get Redis connection information
   */
  async getConnectionInfo() {
    const info = await this.redis.info('clients');
    const connectionData = {};
    
    info.split('\r\n').forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (key.includes('client')) {
          connectionData[key] = isNaN(value) ? value : parseInt(value);
        }
      }
    });
    
    return connectionData;
  }

  /**
   * Track keys by specific patterns (collaboration-related)
   */
  async trackKeyPatterns() {
    try {
      const patterns = [
        'collab:*',
        'session:*',
        'user:*',
        'document:*',
        'awareness:*'
      ];
      
      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern);
        this.metrics.keys.byPattern[pattern] = keys.length;
      }
      
    } catch (error) {
      // Keys command might be disabled in production Redis
      console.warn('Could not track key patterns:', error.message);
    }
  }

  /**
   * Calculate performance metrics
   */
  calculatePerformanceMetrics() {
    if (!this.startTime) return;
    
    const currentTime = Date.now();
    const elapsedSeconds = (currentTime - this.startTime) / 1000;
    
    // Calculate commands per second
    this.metrics.commands.perSecond = this.metrics.commands.total / elapsedSeconds;
    
    // Calculate throughput (operations per second)
    this.metrics.performance.throughput.push({
      timestamp: currentTime,
      commandsPerSecond: this.metrics.commands.perSecond,
      memoryUsage: this.metrics.memory.current,
      connections: this.metrics.connections.current
    });
  }

  /**
   * Measure Redis operation latency
   */
  async measureLatency(operation = 'ping') {
    const startTime = process.hrtime.bigint();
    
    try {
      switch (operation) {
        case 'ping':
          await this.redis.ping();
          break;
        case 'get':
          await this.redis.get('test-key');
          break;
        case 'set':
          await this.redis.set('test-key', 'test-value');
          break;
        default:
          await this.redis.ping();
      }
      
      const endTime = process.hrtime.bigint();
      const latency = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      this.metrics.performance.latency.push({
        operation,
        latency,
        timestamp: Date.now()
      });
      
      return latency;
      
    } catch (error) {
      console.error(`Error measuring ${operation} latency:`, error.message);
      return null;
    }
  }

  /**
   * Generate comprehensive Redis performance report
   */
  generateReport() {
    const testDuration = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;

    const report = {
      summary: {
        testDuration: `${testDuration.toFixed(2)} seconds`,
        totalCommands: this.metrics.commands.total,
        commandsPerSecond: this.metrics.commands.perSecond.toFixed(2),
        peakMemoryUsage: `${(this.metrics.memory.peak / 1024 / 1024).toFixed(2)} MB`,
        memoryIncrease: `${((this.metrics.memory.current - this.metrics.memory.initial) / 1024 / 1024).toFixed(2)} MB`,
        peakConnections: this.metrics.connections.peak,
        currentKeys: this.metrics.keys.total
      },
      memory: {
        initial: `${(this.metrics.memory.initial / 1024 / 1024).toFixed(2)} MB`,
        current: `${(this.metrics.memory.current / 1024 / 1024).toFixed(2)} MB`,
        peak: `${(this.metrics.memory.peak / 1024 / 1024).toFixed(2)} MB`,
        increase: `${((this.metrics.memory.current - this.metrics.memory.initial) / 1024 / 1024).toFixed(2)} MB`,
        increasePercentage: this.metrics.memory.initial > 0 ?
          `${(((this.metrics.memory.current - this.metrics.memory.initial) / this.metrics.memory.initial) * 100).toFixed(2)}%` : 'N/A'
      },
      commands: {
        total: this.metrics.commands.total,
        perSecond: this.metrics.commands.perSecond.toFixed(2),
        types: this.metrics.commands.types,
        mostFrequent: this.getMostFrequentCommands()
      },
      connections: {
        current: this.metrics.connections.current,
        peak: this.metrics.connections.peak
      },
      keys: {
        total: this.metrics.keys.total,
        byPattern: this.metrics.keys.byPattern
      },
      performance: {
        averageLatency: this.calculateAverageLatency(),
        errorRate: this.metrics.performance.errorRate,
        throughputTrend: this.analyzeThroughputTrend()
      },
      recommendations: this.generateRedisRecommendations()
    };

    return report;
  }

  /**
   * Get most frequent Redis commands
   */
  getMostFrequentCommands(limit = 10) {
    return Object.entries(this.metrics.commands.types)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([command, count]) => ({
        command,
        count,
        percentage: ((count / this.metrics.commands.total) * 100).toFixed(2) + '%'
      }));
  }

  /**
   * Calculate average latency across all operations
   */
  calculateAverageLatency() {
    if (this.metrics.performance.latency.length === 0) {
      return 'No latency data available';
    }

    const totalLatency = this.metrics.performance.latency.reduce((sum, item) => sum + item.latency, 0);
    const averageLatency = totalLatency / this.metrics.performance.latency.length;

    return `${averageLatency.toFixed(2)} ms`;
  }

  /**
   * Analyze throughput trend
   */
  analyzeThroughputTrend() {
    if (this.metrics.performance.throughput.length < 2) {
      return 'Insufficient data for trend analysis';
    }

    const recent = this.metrics.performance.throughput.slice(-5); // Last 5 measurements
    const early = this.metrics.performance.throughput.slice(0, 5); // First 5 measurements

    const recentAvg = recent.reduce((sum, item) => sum + item.commandsPerSecond, 0) / recent.length;
    const earlyAvg = early.reduce((sum, item) => sum + item.commandsPerSecond, 0) / early.length;

    const trend = recentAvg > earlyAvg ? 'increasing' : recentAvg < earlyAvg ? 'decreasing' : 'stable';
    const change = ((recentAvg - earlyAvg) / earlyAvg * 100).toFixed(2);

    return {
      trend,
      change: `${change}%`,
      recentAverage: recentAvg.toFixed(2),
      earlyAverage: earlyAvg.toFixed(2)
    };
  }

  /**
   * Generate Redis-specific recommendations
   */
  generateRedisRecommendations() {
    const recommendations = [];

    // Memory usage recommendations
    const memoryIncrease = this.metrics.memory.current - this.metrics.memory.initial;
    const memoryIncreasePercent = this.metrics.memory.initial > 0 ?
      (memoryIncrease / this.metrics.memory.initial) * 100 : 0;

    if (memoryIncreasePercent > 50) {
      recommendations.push({
        type: 'memory',
        severity: 'high',
        issue: 'High memory usage increase',
        description: `Redis memory usage increased by ${memoryIncreasePercent.toFixed(2)}% during the test`,
        recommendation: 'Consider implementing key expiration policies and memory optimization strategies'
      });
    }

    // Command frequency recommendations
    if (this.metrics.commands.perSecond > 1000) {
      recommendations.push({
        type: 'performance',
        severity: 'medium',
        issue: 'High command frequency',
        description: `Redis is processing ${this.metrics.commands.perSecond.toFixed(2)} commands per second`,
        recommendation: 'Consider implementing command batching or connection pooling to reduce load'
      });
    }

    // Connection recommendations
    if (this.metrics.connections.peak > 100) {
      recommendations.push({
        type: 'connections',
        severity: 'medium',
        issue: 'High connection count',
        description: `Peak connection count reached ${this.metrics.connections.peak}`,
        recommendation: 'Implement connection pooling to reduce the number of Redis connections'
      });
    }

    // Key pattern recommendations
    const totalPatternKeys = Object.values(this.metrics.keys.byPattern).reduce((sum, count) => sum + count, 0);
    if (totalPatternKeys > 10000) {
      recommendations.push({
        type: 'keys',
        severity: 'medium',
        issue: 'High number of collaboration keys',
        description: `${totalPatternKeys} collaboration-related keys found in Redis`,
        recommendation: 'Implement key cleanup strategies and consider using key expiration'
      });
    }

    // Command type analysis
    const mostFrequent = this.getMostFrequentCommands(3);
    if (mostFrequent.length > 0 && mostFrequent[0].command === 'KEYS') {
      recommendations.push({
        type: 'commands',
        severity: 'high',
        issue: 'Frequent KEYS command usage',
        description: 'KEYS command is being used frequently, which can block Redis',
        recommendation: 'Replace KEYS commands with SCAN for better performance in production'
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        type: 'general',
        severity: 'info',
        issue: 'No critical Redis issues detected',
        description: 'Redis performance appears to be within acceptable limits',
        recommendation: 'Continue monitoring Redis metrics during higher load scenarios'
      });
    }

    return recommendations;
  }

  /**
   * Print formatted Redis report
   */
  printReport(report) {
    console.log('\n' + '='.repeat(80));
    console.log('🔴 REDIS PERFORMANCE REPORT');
    console.log('='.repeat(80));

    console.log('\n📋 SUMMARY:');
    console.log(`   Test Duration: ${report.summary.testDuration}`);
    console.log(`   Total Commands: ${report.summary.totalCommands}`);
    console.log(`   Commands/sec: ${report.summary.commandsPerSecond}`);
    console.log(`   Peak Memory: ${report.summary.peakMemoryUsage}`);
    console.log(`   Memory Increase: ${report.summary.memoryIncrease}`);
    console.log(`   Peak Connections: ${report.summary.peakConnections}`);
    console.log(`   Current Keys: ${report.summary.currentKeys}`);

    console.log('\n💾 MEMORY USAGE:');
    console.log(`   Initial: ${report.memory.initial}`);
    console.log(`   Current: ${report.memory.current}`);
    console.log(`   Peak: ${report.memory.peak}`);
    console.log(`   Increase: ${report.memory.increase} (${report.memory.increasePercentage})`);

    console.log('\n⚡ COMMAND ANALYSIS:');
    console.log(`   Total Commands: ${report.commands.total}`);
    console.log(`   Commands/sec: ${report.commands.perSecond}`);
    console.log('   Most Frequent Commands:');
    report.commands.mostFrequent.forEach((cmd, index) => {
      console.log(`     ${index + 1}. ${cmd.command}: ${cmd.count} (${cmd.percentage})`);
    });

    console.log('\n🔗 CONNECTIONS:');
    console.log(`   Current: ${report.connections.current}`);
    console.log(`   Peak: ${report.connections.peak}`);

    console.log('\n🔑 KEYS:');
    console.log(`   Total: ${report.keys.total}`);
    if (Object.keys(report.keys.byPattern).length > 0) {
      console.log('   By Pattern:');
      Object.entries(report.keys.byPattern).forEach(([pattern, count]) => {
        console.log(`     ${pattern}: ${count}`);
      });
    }

    console.log('\n📊 PERFORMANCE:');
    console.log(`   Average Latency: ${report.performance.averageLatency}`);
    console.log(`   Error Rate: ${report.performance.errorRate}`);
    if (typeof report.performance.throughputTrend === 'object') {
      console.log(`   Throughput Trend: ${report.performance.throughputTrend.trend} (${report.performance.throughputTrend.change})`);
    }

    console.log('\n💡 REDIS RECOMMENDATIONS:');
    report.recommendations.forEach((rec, index) => {
      const severityIcon = rec.severity === 'high' ? '🔴' : rec.severity === 'medium' ? '🟡' : '🟢';
      console.log(`   ${index + 1}. ${severityIcon} [${rec.type.toUpperCase()}] ${rec.issue}`);
      console.log(`      ${rec.description}`);
      console.log(`      💡 ${rec.recommendation}\n`);
    });

    console.log('='.repeat(80));
  }

  /**
   * Cleanup Redis monitoring resources
   */
  async cleanup() {
    console.log('🧹 Cleaning up Redis Monitor...');

    try {
      // Stop monitoring
      await this.stopMonitoring();

      // Close Redis connections
      if (this.redis) {
        await this.redis.quit();
      }

      if (this.monitorClient) {
        await this.monitorClient.quit();
      }

      console.log('✅ Redis Monitor cleanup completed');

    } catch (error) {
      console.error('Error during Redis Monitor cleanup:', error.message);
    }
  }
}

module.exports = RedisMonitor;
