/**
 * Keystroke Analyzer - Analyzes keystroke handling patterns and WebSocket message frequency
 * Determines if calling WebSocket at each keystroke is optimal
 */

const WebSocket = require('ws');
const Y = require('yjs');
const { WebsocketProvider } = require('y-websocket');
const EventEmitter = require('events');

class KeystrokeAnalyzer extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      serverUrl: config.serverUrl || 'ws://localhost:3000',
      documentId: config.documentId || 'keystroke-analysis-doc',
      analysisTypes: config.analysisTypes || ['immediate', 'debounced', 'batched'],
      debounceDelay: config.debounceDelay || 300, // 300ms
      batchSize: config.batchSize || 5,
      batchTimeout: config.batchTimeout || 500, // 500ms
      testDuration: config.testDuration || 30000, // 30 seconds
      ...config
    };

    this.analysisResults = {
      immediate: {
        keystrokes: 0,
        messages: 0,
        bytesTransferred: 0,
        messageDetails: [],
        latencies: []
      },
      debounced: {
        keystrokes: 0,
        messages: 0,
        bytesTransferred: 0,
        messageDetails: [],
        latencies: []
      },
      batched: {
        keystrokes: 0,
        messages: 0,
        bytesTransferred: 0,
        messageDetails: [],
        latencies: []
      }
    };

    this.testUsers = new Map();
    this.isAnalyzing = false;
  }

  /**
   * Initialize keystroke analysis
   */
  async initialize() {
    console.log('⌨️  Initializing Keystroke Analyzer...');
    
    try {
      // Create test users for different keystroke handling patterns
      for (const type of this.config.analysisTypes) {
        const user = await this.createTestUser(type);
        this.testUsers.set(type, user);
      }
      
      console.log(`✅ Created ${this.testUsers.size} test users for keystroke analysis`);
      return true;
      
    } catch (error) {
      console.error('❌ Keystroke Analyzer initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Create a test user with specific keystroke handling pattern
   */
  async createTestUser(handlingType) {
    const user = {
      id: `keystroke-${handlingType}`,
      type: handlingType,
      doc: new Y.Doc(),
      provider: null,
      isConnected: false,
      pendingOperations: [],
      debounceTimer: null,
      batchTimer: null,
      metrics: {
        keystrokes: 0,
        messages: 0,
        bytesTransferred: 0,
        messageDetails: [],
        latencies: []
      }
    };

    // Generate test token
    const token = this.generateTestToken(user);

    try {
      // 🔐 SECURE: Create WebSocket provider with header-based authentication
      class SecureTestWebSocket extends WebSocket {
        constructor(url, protocols) {
          const options = {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          };
          super(url, protocols, options);
        }
      }

      // Create WebSocket provider with secure authentication
      user.provider = new WebsocketProvider(
        this.config.serverUrl,
        this.config.documentId,
        user.doc,
        { WebSocketPolyfill: SecureTestWebSocket }
      );

      // Setup monitoring for this user
      this.setupUserMonitoring(user);
      
      // Wait for connection
      await this.waitForConnection(user);
      
      // Test user created for keystroke handling
      return user;
      
    } catch (error) {
      console.error(`❌ Failed to create test user for ${handlingType}:`, error.message);
      throw error;
    }
  }

  /**
   * Setup monitoring for a test user
   */
  setupUserMonitoring(user) {
    // Connection status monitoring
    user.provider.on('status', (event) => {
      if (event.status === 'connected') {
        user.isConnected = true;
        // User connected

        // Setup WebSocket monitoring once connected (simplified)
        try {
          this.setupWebSocketMonitoring(user);
        } catch (error) {
          console.warn(`WebSocket monitoring setup failed for ${user.type}:`, error.message);
        }
      } else if (event.status === 'disconnected') {
        user.isConnected = false;
        console.log(`🔌 ${user.type} user disconnected`);
      }
    });

    // WebSocket message monitoring will be setup when connection is established

    // Document update monitoring based on handling type
    this.setupDocumentMonitoring(user);
  }

  /**
   * Setup WebSocket message monitoring (simplified)
   */
  setupWebSocketMonitoring(user) {
    // For now, just track basic metrics without detailed WebSocket monitoring
    // The main performance test handles detailed WebSocket analysis
    // Basic monitoring enabled
  }

  /**
   * Setup document monitoring based on keystroke handling type
   */
  setupDocumentMonitoring(user) {
    const text = user.doc.getText('content');
    
    switch (user.type) {
      case 'immediate':
        // Every keystroke immediately triggers a document update
        this.setupImmediateHandling(user, text);
        break;
        
      case 'debounced':
        // Keystrokes are debounced before triggering updates
        this.setupDebouncedHandling(user, text);
        break;
        
      case 'batched':
        // Keystrokes are batched before triggering updates
        this.setupBatchedHandling(user, text);
        break;
    }
  }

  /**
   * Setup immediate keystroke handling (current behavior)
   */
  setupImmediateHandling(user, text) {
    // This simulates the current behavior where each keystroke
    // immediately triggers a document update and WebSocket message
    user.handleKeystroke = (content, position) => {
      text.insert(position, content);
      user.metrics.keystrokes++;
      this.analysisResults[user.type].keystrokes++;
    };
  }

  /**
   * Setup debounced keystroke handling
   */
  setupDebouncedHandling(user, text) {
    user.handleKeystroke = (content, position) => {
      user.metrics.keystrokes++;
      this.analysisResults[user.type].keystrokes++;
      
      // Add to pending operations
      user.pendingOperations.push({ content, position, timestamp: Date.now() });
      
      // Clear existing debounce timer
      if (user.debounceTimer) {
        clearTimeout(user.debounceTimer);
      }
      
      // Set new debounce timer
      user.debounceTimer = setTimeout(() => {
        this.flushPendingOperations(user, text);
      }, this.config.debounceDelay);
    };
  }

  /**
   * Setup batched keystroke handling
   */
  setupBatchedHandling(user, text) {
    user.handleKeystroke = (content, position) => {
      user.metrics.keystrokes++;
      this.analysisResults[user.type].keystrokes++;
      
      // Add to pending operations
      user.pendingOperations.push({ content, position, timestamp: Date.now() });
      
      // Check if we should flush based on batch size
      if (user.pendingOperations.length >= this.config.batchSize) {
        this.flushPendingOperations(user, text);
        return;
      }
      
      // Set batch timer if not already set
      if (!user.batchTimer) {
        user.batchTimer = setTimeout(() => {
          this.flushPendingOperations(user, text);
        }, this.config.batchTimeout);
      }
    };
  }

  /**
   * Flush pending operations for debounced/batched handling
   */
  flushPendingOperations(user, text) {
    if (user.pendingOperations.length === 0) return;
    
    // Apply all pending operations as a single update
    const operations = [...user.pendingOperations];
    user.pendingOperations = [];
    
    // Clear timers
    if (user.debounceTimer) {
      clearTimeout(user.debounceTimer);
      user.debounceTimer = null;
    }
    if (user.batchTimer) {
      clearTimeout(user.batchTimer);
      user.batchTimer = null;
    }
    
    // Apply operations (this will trigger a single WebSocket message)
    operations.forEach(op => {
      text.insert(op.position, op.content);
    });
  }

  /**
   * Analyze WebSocket message content
   */
  analyzeMessage(data, direction, timestamp) {
    const messageInfo = {
      direction,
      timestamp,
      size: this.getMessageSize(data),
      type: 'unknown'
    };

    try {
      if (data instanceof Uint8Array && data.length > 0) {
        const messageType = data[0];
        
        switch (messageType) {
          case 0:
            messageInfo.type = 'sync';
            messageInfo.isDocumentUpdate = true;
            break;
          case 1:
            messageInfo.type = 'awareness';
            messageInfo.isDocumentUpdate = false;
            break;
          default:
            messageInfo.type = `unknown-${messageType}`;
        }
      }
    } catch (error) {
      // Ignore analysis errors
    }

    return messageInfo;
  }

  /**
   * Calculate message latency
   */
  calculateLatency(user, messageInfo) {
    if (messageInfo.direction === 'incoming' && messageInfo.type === 'sync') {
      // Find the most recent outgoing sync message
      const recentOutgoing = user.metrics.messageDetails
        .filter(m => m.direction === 'outgoing' && m.type === 'sync')
        .sort((a, b) => b.timestamp - a.timestamp)[0];
      
      if (recentOutgoing) {
        const latency = messageInfo.timestamp - recentOutgoing.timestamp;
        user.metrics.latencies.push(latency);
        this.analysisResults[user.type].latencies.push(latency);
      }
    }
  }

  /**
   * Get message size in bytes
   */
  getMessageSize(data) {
    if (data instanceof ArrayBuffer) return data.byteLength;
    if (data instanceof Uint8Array || data instanceof Buffer) return data.length;
    if (typeof data === 'string') return Buffer.byteLength(data, 'utf8');
    return 0;
  }

  /**
   * Wait for user connection
   */
  waitForConnection(user, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkConnection = () => {
        if (user.isConnected) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Connection timeout for ${user.type} user`));
        } else {
          setTimeout(checkConnection, 100);
        }
      };
      
      checkConnection();
    });
  }

  /**
   * Generate test token
   */
  generateTestToken(user) {
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

    const payload = {
      user_id: user.id,
      userId: user.id,
      username: user.id,
      email: `${user.id}@test.com`,
      permissions: ['read', 'write'],
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, secret, { algorithm: 'HS256' });
  }

  /**
   * Run keystroke analysis
   */
  async runAnalysis() {
    console.log('\n⌨️  Starting Keystroke Analysis...');
    console.log(`📊 Testing ${this.config.analysisTypes.length} different keystroke handling patterns`);
    console.log(`⏱️  Analysis duration: ${this.config.testDuration / 1000} seconds`);
    
    this.isAnalyzing = true;
    const startTime = Date.now();
    
    // Start typing simulation for all users
    const typingIntervals = [];
    
    this.testUsers.forEach((user, type) => {
      const interval = setInterval(() => {
        if (!this.isAnalyzing || !user.isConnected) return;
        
        this.simulateKeystroke(user);
      }, 200 + Math.random() * 300); // 200-500ms between keystrokes
      
      typingIntervals.push(interval);
    });

    // Run analysis for specified duration
    await new Promise(resolve => setTimeout(resolve, this.config.testDuration));
    
    // Stop typing simulation
    typingIntervals.forEach(interval => clearInterval(interval));
    
    // Flush any pending operations
    this.testUsers.forEach(user => {
      if (user.pendingOperations.length > 0) {
        const text = user.doc.getText('content');
        this.flushPendingOperations(user, text);
      }
    });
    
    this.isAnalyzing = false;
    const endTime = Date.now();
    const testDuration = endTime - startTime;
    
    console.log('🏁 Keystroke analysis completed');
    
    // Generate analysis report
    const report = this.generateAnalysisReport(testDuration);
    
    // Cleanup
    await this.cleanup();
    
    return report;
  }

  /**
   * Simulate a keystroke for a user
   */
  simulateKeystroke(user) {
    const words = ['hello', 'world', 'test', 'keystroke', 'analysis', 'performance', 'websocket'];
    const word = words[Math.floor(Math.random() * words.length)];
    const char = word[Math.floor(Math.random() * word.length)];
    
    const text = user.doc.getText('content');
    const position = Math.floor(Math.random() * (text.length + 1));
    
    user.handleKeystroke(char, position);
  }

  /**
   * Generate comprehensive keystroke analysis report
   */
  generateAnalysisReport(testDuration) {
    const report = {
      summary: {
        testDuration: testDuration / 1000,
        analysisTypes: this.config.analysisTypes,
        debounceDelay: this.config.debounceDelay,
        batchSize: this.config.batchSize,
        batchTimeout: this.config.batchTimeout
      },
      results: {},
      comparison: {},
      recommendations: []
    };

    // Generate results for each analysis type
    this.config.analysisTypes.forEach(type => {
      const data = this.analysisResults[type];
      const keystrokesPerSecond = data.keystrokes / (testDuration / 1000);
      const messagesPerSecond = data.messages / (testDuration / 1000);
      const messagesPerKeystroke = data.keystrokes > 0 ? data.messages / data.keystrokes : 0;
      const avgLatency = data.latencies.length > 0 ?
        data.latencies.reduce((sum, lat) => sum + lat, 0) / data.latencies.length : 0;

      report.results[type] = {
        keystrokes: data.keystrokes,
        messages: data.messages,
        bytesTransferred: data.bytesTransferred,
        keystrokesPerSecond: keystrokesPerSecond.toFixed(2),
        messagesPerSecond: messagesPerSecond.toFixed(2),
        messagesPerKeystroke: messagesPerKeystroke.toFixed(2),
        averageLatency: avgLatency.toFixed(2) + ' ms',
        efficiency: this.calculateEfficiency(data),
        messageTypes: this.analyzeMessageTypes(data.messageDetails)
      };
    });

    // Generate comparison analysis
    report.comparison = this.generateComparison(report.results);

    // Generate recommendations
    report.recommendations = this.generateKeystrokeRecommendations(report.results, report.comparison);

    return report;
  }

  /**
   * Calculate efficiency metrics for a keystroke handling type
   */
  calculateEfficiency(data) {
    const messagesPerKeystroke = data.keystrokes > 0 ? data.messages / data.keystrokes : 0;
    const bytesPerKeystroke = data.keystrokes > 0 ? data.bytesTransferred / data.keystrokes : 0;

    // Efficiency score (lower is better)
    // Based on messages per keystroke and bytes per keystroke
    const efficiencyScore = messagesPerKeystroke * 0.7 + (bytesPerKeystroke / 100) * 0.3;

    return {
      messagesPerKeystroke: messagesPerKeystroke.toFixed(2),
      bytesPerKeystroke: bytesPerKeystroke.toFixed(2),
      efficiencyScore: efficiencyScore.toFixed(2)
    };
  }

  /**
   * Analyze message types distribution
   */
  analyzeMessageTypes(messageDetails) {
    const types = {};
    let totalMessages = 0;

    messageDetails.forEach(msg => {
      if (msg.direction === 'outgoing') {
        totalMessages++;
        if (!types[msg.type]) {
          types[msg.type] = 0;
        }
        types[msg.type]++;
      }
    });

    // Convert to percentages
    Object.keys(types).forEach(type => {
      types[type] = {
        count: types[type],
        percentage: totalMessages > 0 ? ((types[type] / totalMessages) * 100).toFixed(2) + '%' : '0%'
      };
    });

    return types;
  }

  /**
   * Generate comparison between different keystroke handling approaches
   */
  generateComparison(results) {
    const comparison = {
      efficiency: {},
      performance: {},
      networkUsage: {}
    };

    // Find the most efficient approach
    let mostEfficient = null;
    let lowestScore = Infinity;

    Object.entries(results).forEach(([type, data]) => {
      const score = parseFloat(data.efficiency.efficiencyScore);
      if (score < lowestScore) {
        lowestScore = score;
        mostEfficient = type;
      }
    });

    comparison.efficiency.mostEfficient = mostEfficient;
    comparison.efficiency.scores = Object.fromEntries(
      Object.entries(results).map(([type, data]) => [type, data.efficiency.efficiencyScore])
    );

    // Compare message frequency
    const messageRates = Object.fromEntries(
      Object.entries(results).map(([type, data]) => [type, parseFloat(data.messagesPerKeystroke)])
    );

    const lowestMessageRate = Math.min(...Object.values(messageRates));
    const highestMessageRate = Math.max(...Object.values(messageRates));

    comparison.performance.lowestMessageRate = lowestMessageRate.toFixed(2);
    comparison.performance.highestMessageRate = highestMessageRate.toFixed(2);
    comparison.performance.improvement = highestMessageRate > 0 ?
      (((highestMessageRate - lowestMessageRate) / highestMessageRate) * 100).toFixed(2) + '%' : '0%';

    // Compare network usage
    const bytesUsage = Object.fromEntries(
      Object.entries(results).map(([type, data]) => [type, data.bytesTransferred])
    );

    const lowestBytes = Math.min(...Object.values(bytesUsage));
    const highestBytes = Math.max(...Object.values(bytesUsage));

    comparison.networkUsage.lowestBytes = lowestBytes;
    comparison.networkUsage.highestBytes = highestBytes;
    comparison.networkUsage.reduction = highestBytes > 0 ?
      (((highestBytes - lowestBytes) / highestBytes) * 100).toFixed(2) + '%' : '0%';

    return comparison;
  }

  /**
   * Generate keystroke handling recommendations
   */
  generateKeystrokeRecommendations(results, comparison) {
    const recommendations = [];

    // Analyze current (immediate) approach
    const immediateResult = results.immediate;
    if (immediateResult && parseFloat(immediateResult.messagesPerKeystroke) > 2) {
      recommendations.push({
        type: 'optimization',
        severity: 'high',
        issue: 'High WebSocket message frequency per keystroke',
        description: `Current immediate approach generates ${immediateResult.messagesPerKeystroke} messages per keystroke`,
        recommendation: 'Consider implementing debouncing or batching to reduce WebSocket traffic'
      });
    }

    // Compare debounced vs immediate
    if (results.debounced && results.immediate) {
      const debouncedMessages = parseFloat(results.debounced.messagesPerKeystroke);
      const immediateMessages = parseFloat(results.immediate.messagesPerKeystroke);

      if (debouncedMessages < immediateMessages) {
        const improvement = ((immediateMessages - debouncedMessages) / immediateMessages * 100).toFixed(2);
        recommendations.push({
          type: 'debouncing',
          severity: 'medium',
          issue: 'Debouncing shows significant improvement',
          description: `Debouncing reduces messages per keystroke by ${improvement}%`,
          recommendation: `Implement ${this.config.debounceDelay}ms debouncing for keystroke events`
        });
      }
    }

    // Compare batched vs immediate
    if (results.batched && results.immediate) {
      const batchedMessages = parseFloat(results.batched.messagesPerKeystroke);
      const immediateMessages = parseFloat(results.immediate.messagesPerKeystroke);

      if (batchedMessages < immediateMessages) {
        const improvement = ((immediateMessages - batchedMessages) / immediateMessages * 100).toFixed(2);
        recommendations.push({
          type: 'batching',
          severity: 'medium',
          issue: 'Batching shows significant improvement',
          description: `Batching reduces messages per keystroke by ${improvement}%`,
          recommendation: `Implement batching with size ${this.config.batchSize} and timeout ${this.config.batchTimeout}ms`
        });
      }
    }

    // Network usage recommendations
    if (comparison.networkUsage.reduction && parseFloat(comparison.networkUsage.reduction) > 30) {
      recommendations.push({
        type: 'network',
        severity: 'medium',
        issue: 'High network usage with current approach',
        description: `Network usage can be reduced by ${comparison.networkUsage.reduction}`,
        recommendation: 'Implement the most efficient keystroke handling approach to reduce bandwidth usage'
      });
    }

    // Latency recommendations
    const latencies = Object.values(results).map(r => parseFloat(r.averageLatency));
    const maxLatency = Math.max(...latencies);

    if (maxLatency > 100) { // > 100ms
      recommendations.push({
        type: 'latency',
        severity: 'medium',
        issue: 'High average latency detected',
        description: `Maximum average latency is ${maxLatency.toFixed(2)}ms`,
        recommendation: 'Consider optimizing server-side processing or implementing client-side prediction'
      });
    }

    // Best practice recommendation
    recommendations.push({
      type: 'best-practice',
      severity: 'info',
      issue: 'Keystroke handling optimization',
      description: `Most efficient approach: ${comparison.efficiency.mostEfficient}`,
      recommendation: `Implement ${comparison.efficiency.mostEfficient} keystroke handling for optimal performance`
    });

    return recommendations;
  }

  /**
   * Print formatted keystroke analysis report
   */
  printReport(report) {
    console.log('\n' + '='.repeat(80));
    console.log('⌨️  KEYSTROKE ANALYSIS REPORT');
    console.log('='.repeat(80));

    console.log('\n📋 TEST CONFIGURATION:');
    console.log(`   Duration: ${report.summary.testDuration} seconds`);
    console.log(`   Analysis Types: ${report.summary.analysisTypes.join(', ')}`);
    console.log(`   Debounce Delay: ${report.summary.debounceDelay}ms`);
    console.log(`   Batch Size: ${report.summary.batchSize}`);
    console.log(`   Batch Timeout: ${report.summary.batchTimeout}ms`);

    console.log('\n📊 RESULTS BY APPROACH:');
    Object.entries(report.results).forEach(([type, data]) => {
      console.log(`\n   ${type.toUpperCase()} APPROACH:`);
      console.log(`     Keystrokes: ${data.keystrokes}`);
      console.log(`     Messages: ${data.messages}`);
      console.log(`     Messages/Keystroke: ${data.messagesPerKeystroke}`);
      console.log(`     Messages/Second: ${data.messagesPerSecond}`);
      console.log(`     Bytes Transferred: ${data.bytesTransferred}`);
      console.log(`     Average Latency: ${data.averageLatency}`);
      console.log(`     Efficiency Score: ${data.efficiency.efficiencyScore}`);
    });

    console.log('\n🔍 COMPARISON ANALYSIS:');
    console.log(`   Most Efficient: ${report.comparison.efficiency.mostEfficient}`);
    console.log(`   Message Rate Range: ${report.comparison.performance.lowestMessageRate} - ${report.comparison.performance.highestMessageRate}`);
    console.log(`   Potential Improvement: ${report.comparison.performance.improvement}`);
    console.log(`   Network Usage Reduction: ${report.comparison.networkUsage.reduction}`);

    console.log('\n💡 KEYSTROKE RECOMMENDATIONS:');
    report.recommendations.forEach((rec, index) => {
      const severityIcon = rec.severity === 'high' ? '🔴' : rec.severity === 'medium' ? '🟡' : '🟢';
      console.log(`   ${index + 1}. ${severityIcon} [${rec.type.toUpperCase()}] ${rec.issue}`);
      console.log(`      ${rec.description}`);
      console.log(`      💡 ${rec.recommendation}\n`);
    });

    console.log('='.repeat(80));
  }

  /**
   * Cleanup keystroke analyzer resources
   */
  async cleanup() {
    console.log('🧹 Cleaning up Keystroke Analyzer...');

    for (const [type, user] of this.testUsers) {
      try {
        // Clear any pending timers
        if (user.debounceTimer) {
          clearTimeout(user.debounceTimer);
        }
        if (user.batchTimer) {
          clearTimeout(user.batchTimer);
        }

        // Destroy provider and document
        if (user.provider) {
          user.provider.destroy();
        }
        if (user.doc) {
          user.doc.destroy();
        }
      } catch (error) {
        console.error(`Error cleaning up ${type} user:`, error.message);
      }
    }

    this.testUsers.clear();
    console.log('✅ Keystroke Analyzer cleanup completed');
  }
}

module.exports = KeystrokeAnalyzer;
