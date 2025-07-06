/**
 * Performance Test Suite for WebSocket and Redis Load Testing
 * Tests 20 concurrent users editing a document simultaneously
 */

const WebSocket = require('ws');
const Y = require('yjs');
const { WebsocketProvider } = require('y-websocket');
const Redis = require('ioredis');
const EventEmitter = require('events');

class PerformanceTestSuite extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      serverUrl: config.serverUrl || 'ws://localhost:3000',
      documentId: config.documentId || 'perf-test-doc',
      userCount: config.userCount || 20,
      testDuration: config.testDuration || 60000, // 1 minute
      keystrokeInterval: config.keystrokeInterval || 500, // 500ms between keystrokes
      redisUrl: config.redisUrl || 'redis://localhost:6379',
      ...config
    };

    this.users = [];
    this.metrics = {
      websocket: {
        totalMessages: 0,
        messagesSent: 0,
        messagesReceived: 0,
        connectionErrors: 0,
        averageLatency: 0,
        messageTypes: {},
        bytesTransferred: 0
      },
      redis: {
        commandCount: 0,
        memoryUsage: 0,
        keyCount: 0,
        connectionCount: 0,
        operationLatency: []
      },
      performance: {
        startTime: null,
        endTime: null,
        keystrokesPerSecond: 0,
        messagesPerKeystroke: 0,
        concurrentUsers: 0
      }
    };

    this.redisMonitor = new Redis(this.config.redisUrl);
    this.testActive = false;
  }

  /**
   * Initialize the performance test
   */
  async initialize() {
    console.log('🚀 Initializing Performance Test Suite...');
    console.log(`📊 Configuration:
    - Server URL: ${this.config.serverUrl}
    - Document ID: ${this.config.documentId}
    - User Count: ${this.config.userCount}
    - Test Duration: ${this.config.testDuration}ms
    - Keystroke Interval: ${this.config.keystrokeInterval}ms`);

    // Test Redis connection
    try {
      await this.redisMonitor.ping();
      console.log('✅ Redis connection established');
    } catch (error) {
      console.error('❌ Redis connection failed:', error.message);
      throw error;
    }

    // Setup Redis monitoring
    await this.setupRedisMonitoring();
    
    console.log('✅ Performance Test Suite initialized');
  }

  /**
   * Setup Redis monitoring
   */
  async setupRedisMonitoring() {
    // Monitor Redis commands
    const monitor = new Redis(this.config.redisUrl);
    monitor.monitor((err, monitor) => {
      if (err) {
        console.error('Redis monitor error:', err);
        return;
      }
      
      monitor.on('monitor', (time, args) => {
        if (this.testActive) {
          this.metrics.redis.commandCount++;
          
          // Track command types
          const command = args[0];
          if (!this.metrics.redis.commandTypes) {
            this.metrics.redis.commandTypes = {};
          }
          this.metrics.redis.commandTypes[command] = (this.metrics.redis.commandTypes[command] || 0) + 1;
        }
      });
    });

    // Get initial Redis stats
    const info = await this.redisMonitor.info('memory');
    const memoryMatch = info.match(/used_memory:(\d+)/);
    if (memoryMatch) {
      this.metrics.redis.initialMemory = parseInt(memoryMatch[1]);
    }
  }

  /**
   * Create a simulated user
   */
  async createUser(userId) {
    const user = {
      id: userId,
      username: `user-${userId}`,
      doc: new Y.Doc(),
      provider: null,
      ws: null,
      metrics: {
        messagesSent: 0,
        messagesReceived: 0,
        keystrokes: 0,
        latencies: [],
        errors: 0
      },
      isConnected: false
    };

    // Create WebSocket connection with authentication token
    const token = this.generateTestToken(user);
    const wsUrl = `${this.config.serverUrl}/${this.config.documentId}?token=${token}`;
    
    try {
      // Create WebSocket provider
      user.provider = new WebsocketProvider(
        this.config.serverUrl,
        this.config.documentId,
        user.doc,
        { params: { token } }
      );

      // Setup event listeners
      this.setupUserEventListeners(user);
      
      // Wait for connection
      await this.waitForConnection(user);
      
      console.log(`✅ User ${userId} connected`);
      return user;
      
    } catch (error) {
      console.error(`❌ Failed to create user ${userId}:`, error.message);
      user.metrics.errors++;
      this.metrics.websocket.connectionErrors++;
      return user;
    }
  }

  /**
   * Setup event listeners for a user
   */
  setupUserEventListeners(user) {
    // WebSocket connection events
    user.provider.on('status', (event) => {
      if (event.status === 'connected') {
        user.isConnected = true;
        this.metrics.performance.concurrentUsers++;

        // Setup WebSocket message tracking once connected
        this.setupWebSocketTracking(user);
      } else if (event.status === 'disconnected') {
        user.isConnected = false;
        this.metrics.performance.concurrentUsers--;
      }
    });

    // Document update events
    user.doc.on('update', (update, origin) => {
      // Track document updates
      if (origin === user) {
        // This update originated from this user
        user.metrics.keystrokes++;
      }
    });
  }

  /**
   * Setup WebSocket message tracking for a user (simplified)
   */
  setupWebSocketTracking(user) {
    // Use a simpler approach - track via provider events instead of direct WebSocket access
    let messageCount = 0;

    // Track document updates as a proxy for WebSocket messages
    user.doc.on('update', (update, origin) => {
      messageCount++;
      user.metrics.messagesSent++;
      this.metrics.websocket.messagesSent++;
      this.metrics.websocket.totalMessages++;

      // Estimate message size
      const estimatedSize = update ? update.length : 50;
      this.metrics.websocket.bytesTransferred += estimatedSize;
    });

    console.log(`📊 Simplified WebSocket tracking enabled for user ${user.id}`);
  }

  /**
   * Wait for user connection to be established
   */
  waitForConnection(user, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkConnection = () => {
        if (user.isConnected) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Connection timeout for user ${user.id}`));
        } else {
          setTimeout(checkConnection, 100);
        }
      };
      
      checkConnection();
    });
  }

  /**
   * Generate a test JWT token for authentication
   */
  generateTestToken(user) {
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

    const payload = {
      user_id: user.id,
      userId: user.id,
      username: user.username,
      email: `${user.username}@test.com`,
      permissions: ['read', 'write'],
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, secret, { algorithm: 'HS256' });
  }

  /**
   * Simulate user typing behavior
   */
  async simulateTyping(user) {
    if (!user.isConnected || !this.testActive) return;

    const text = user.doc.getText('content');
    const words = [
      'hello', 'world', 'this', 'is', 'a', 'test', 'of', 'collaborative', 
      'editing', 'with', 'multiple', 'users', 'typing', 'simultaneously',
      'performance', 'testing', 'websocket', 'load', 'redis', 'monitoring'
    ];
    
    const randomWord = words[Math.floor(Math.random() * words.length)];
    const insertPosition = Math.floor(Math.random() * (text.length + 1));
    
    try {
      // Insert text at random position
      text.insert(insertPosition, randomWord + ' ');
      user.metrics.keystrokes++;
      
      // Update cursor position (awareness)
      if (user.provider.awareness) {
        user.provider.awareness.setLocalStateField('cursor', {
          anchor: insertPosition + randomWord.length + 1,
          head: insertPosition + randomWord.length + 1
        });
      }
      
    } catch (error) {
      user.metrics.errors++;
      console.error(`Typing error for user ${user.id}:`, error.message);
    }
  }

  /**
   * Run the performance test
   */
  async runTest() {
    console.log('\n🎯 Starting Performance Test...');
    this.testActive = true;
    this.metrics.performance.startTime = Date.now();

    // Create all users
    console.log(`👥 Creating ${this.config.userCount} users...`);
    for (let i = 1; i <= this.config.userCount; i++) {
      const user = await this.createUser(i);
      this.users.push(user);
      
      // Small delay between connections to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`✅ Created ${this.users.length} users`);
    console.log(`🔗 Connected users: ${this.metrics.performance.concurrentUsers}`);

    // Start typing simulation for all users
    console.log('⌨️  Starting typing simulation...');
    const typingIntervals = this.users.map(user => {
      return setInterval(() => {
        this.simulateTyping(user);
      }, this.config.keystrokeInterval + Math.random() * 200); // Add some randomness
    });

    // Run test for specified duration
    console.log(`⏱️  Running test for ${this.config.testDuration / 1000} seconds...`);
    await new Promise(resolve => setTimeout(resolve, this.config.testDuration));

    // Stop typing simulation
    typingIntervals.forEach(interval => clearInterval(interval));
    
    this.testActive = false;
    this.metrics.performance.endTime = Date.now();

    console.log('🏁 Test completed, collecting final metrics...');
    await this.collectFinalMetrics();
    
    // Cleanup
    await this.cleanup();
    
    return this.generateReport();
  }

  /**
   * Collect final metrics after test completion
   */
  async collectFinalMetrics() {
    // Get final Redis stats
    const info = await this.redisMonitor.info('memory');
    const memoryMatch = info.match(/used_memory:(\d+)/);
    if (memoryMatch) {
      this.metrics.redis.memoryUsage = parseInt(memoryMatch[1]) - (this.metrics.redis.initialMemory || 0);
    }

    // Get Redis key count
    const keyCount = await this.redisMonitor.dbsize();
    this.metrics.redis.keyCount = keyCount;

    // Calculate performance metrics
    const testDuration = this.metrics.performance.endTime - this.metrics.performance.startTime;
    const totalKeystrokes = this.users.reduce((sum, user) => sum + user.metrics.keystrokes, 0);

    this.metrics.performance.keystrokesPerSecond = (totalKeystrokes / testDuration) * 1000;
    this.metrics.performance.messagesPerKeystroke = totalKeystrokes > 0 ?
      this.metrics.websocket.totalMessages / totalKeystrokes : 0;

    // Calculate average latency (if we had latency measurements)
    const allLatencies = this.users.flatMap(user => user.metrics.latencies);
    if (allLatencies.length > 0) {
      this.metrics.websocket.averageLatency = allLatencies.reduce((sum, lat) => sum + lat, 0) / allLatencies.length;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    console.log('🧹 Cleaning up resources...');

    // Disconnect all users
    for (const user of this.users) {
      try {
        if (user.provider) {
          user.provider.destroy();
        }
        if (user.doc) {
          user.doc.destroy();
        }
      } catch (error) {
        console.error(`Error cleaning up user ${user.id}:`, error.message);
      }
    }

    // Close Redis connections
    try {
      await this.redisMonitor.quit();
    } catch (error) {
      console.error('Error closing Redis connection:', error.message);
    }

    console.log('✅ Cleanup completed');
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport() {
    const testDuration = (this.metrics.performance.endTime - this.metrics.performance.startTime) / 1000;
    const totalKeystrokes = this.users.reduce((sum, user) => sum + user.metrics.keystrokes, 0);

    const report = {
      summary: {
        testDuration: `${testDuration.toFixed(2)} seconds`,
        userCount: this.config.userCount,
        concurrentUsers: this.metrics.performance.concurrentUsers,
        totalKeystrokes,
        keystrokesPerSecond: this.metrics.performance.keystrokesPerSecond.toFixed(2)
      },
      websocket: {
        totalMessages: this.metrics.websocket.totalMessages,
        messagesSent: this.metrics.websocket.messagesSent,
        messagesReceived: this.metrics.websocket.messagesReceived,
        messagesPerKeystroke: this.metrics.performance.messagesPerKeystroke.toFixed(2),
        bytesTransferred: `${(this.metrics.websocket.bytesTransferred / 1024).toFixed(2)} KB`,
        connectionErrors: this.metrics.websocket.connectionErrors,
        averageLatency: `${this.metrics.websocket.averageLatency.toFixed(2)} ms`
      },
      redis: {
        commandCount: this.metrics.redis.commandCount,
        commandsPerSecond: (this.metrics.redis.commandCount / testDuration).toFixed(2),
        memoryUsage: `${(this.metrics.redis.memoryUsage / 1024).toFixed(2)} KB`,
        keyCount: this.metrics.redis.keyCount,
        commandTypes: this.metrics.redis.commandTypes || {}
      },
      userMetrics: this.users.map(user => ({
        id: user.id,
        keystrokes: user.metrics.keystrokes,
        messagesSent: user.metrics.messagesSent,
        messagesReceived: user.metrics.messagesReceived,
        errors: user.metrics.errors,
        connected: user.isConnected
      })),
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    const messagesPerKeystroke = parseFloat(this.metrics.performance.messagesPerKeystroke);
    const keystrokesPerSecond = parseFloat(this.metrics.performance.keystrokesPerSecond);

    // WebSocket recommendations
    if (messagesPerKeystroke > 3) {
      recommendations.push({
        type: 'websocket',
        severity: 'high',
        issue: 'High message frequency per keystroke',
        description: `Each keystroke generates ${messagesPerKeystroke.toFixed(2)} WebSocket messages on average`,
        recommendation: 'Implement debouncing or batching for keystroke events to reduce message frequency'
      });
    }

    if (this.metrics.websocket.connectionErrors > 0) {
      recommendations.push({
        type: 'websocket',
        severity: 'medium',
        issue: 'Connection errors detected',
        description: `${this.metrics.websocket.connectionErrors} connection errors occurred during the test`,
        recommendation: 'Implement connection retry logic and better error handling'
      });
    }

    // Redis recommendations
    if (this.metrics.redis.commandCount / (this.metrics.performance.endTime - this.metrics.performance.startTime) * 1000 > 100) {
      recommendations.push({
        type: 'redis',
        severity: 'medium',
        issue: 'High Redis command frequency',
        description: 'Redis is receiving a high number of commands per second',
        recommendation: 'Consider implementing Redis command batching or connection pooling'
      });
    }

    // Performance recommendations
    if (keystrokesPerSecond > 50) {
      recommendations.push({
        type: 'performance',
        severity: 'high',
        issue: 'Very high keystroke frequency',
        description: `${keystrokesPerSecond.toFixed(2)} keystrokes per second across all users`,
        recommendation: 'Implement keystroke throttling or debouncing to prevent server overload'
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        type: 'general',
        severity: 'info',
        issue: 'No critical issues detected',
        description: 'The system performed well under the current load',
        recommendation: 'Consider testing with higher user counts or longer durations'
      });
    }

    return recommendations;
  }

  /**
   * Print formatted report to console
   */
  printReport(report) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 PERFORMANCE TEST REPORT');
    console.log('='.repeat(80));

    console.log('\n📋 TEST SUMMARY:');
    console.log(`   Duration: ${report.summary.testDuration}`);
    console.log(`   Users: ${report.summary.userCount} (${report.summary.concurrentUsers} connected)`);
    console.log(`   Total Keystrokes: ${report.summary.totalKeystrokes}`);
    console.log(`   Keystrokes/sec: ${report.summary.keystrokesPerSecond}`);

    console.log('\n🌐 WEBSOCKET METRICS:');
    console.log(`   Total Messages: ${report.websocket.totalMessages}`);
    console.log(`   Messages Sent: ${report.websocket.messagesSent}`);
    console.log(`   Messages Received: ${report.websocket.messagesReceived}`);
    console.log(`   Messages per Keystroke: ${report.websocket.messagesPerKeystroke}`);
    console.log(`   Data Transferred: ${report.websocket.bytesTransferred}`);
    console.log(`   Connection Errors: ${report.websocket.connectionErrors}`);
    console.log(`   Average Latency: ${report.websocket.averageLatency}`);

    console.log('\n🔴 REDIS METRICS:');
    console.log(`   Total Commands: ${report.redis.commandCount}`);
    console.log(`   Commands/sec: ${report.redis.commandsPerSecond}`);
    console.log(`   Memory Usage: ${report.redis.memoryUsage}`);
    console.log(`   Key Count: ${report.redis.keyCount}`);

    if (Object.keys(report.redis.commandTypes).length > 0) {
      console.log('   Command Types:');
      Object.entries(report.redis.commandTypes).forEach(([cmd, count]) => {
        console.log(`     ${cmd}: ${count}`);
      });
    }

    console.log('\n💡 RECOMMENDATIONS:');
    report.recommendations.forEach((rec, index) => {
      const severityIcon = rec.severity === 'high' ? '🔴' : rec.severity === 'medium' ? '🟡' : '🟢';
      console.log(`   ${index + 1}. ${severityIcon} [${rec.type.toUpperCase()}] ${rec.issue}`);
      console.log(`      ${rec.description}`);
      console.log(`      💡 ${rec.recommendation}\n`);
    });

    console.log('='.repeat(80));
  }
}

module.exports = PerformanceTestSuite;
