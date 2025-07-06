/**
 * WebSocket Load Tester - Specialized testing for WebSocket connections
 * Simulates realistic user behavior patterns
 */

const WebSocket = require('ws');
const Y = require('yjs');
const { WebsocketProvider } = require('y-websocket');
const EventEmitter = require('events');

class WebSocketLoadTester extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      serverUrl: config.serverUrl || 'ws://localhost:3000',
      documentId: config.documentId || 'load-test-doc',
      userCount: config.userCount || 20,
      testPatterns: config.testPatterns || ['typing', 'cursor', 'selection'],
      messageTrackingEnabled: config.messageTrackingEnabled !== false,
      ...config
    };

    this.connections = new Map();
    this.messageStats = {
      sync: 0,
      awareness: 0,
      total: 0,
      bytesTransferred: 0,
      messageFrequency: [],
      latencyMeasurements: []
    };

    this.testPatterns = {
      typing: this.createTypingPattern.bind(this),
      cursor: this.createCursorPattern.bind(this),
      selection: this.createSelectionPattern.bind(this),
      formatting: this.createFormattingPattern.bind(this),
      deletion: this.createDeletionPattern.bind(this)
    };
  }

  /**
   * Create a realistic typing pattern
   */
  createTypingPattern(user, intensity = 'normal') {
    const intervals = {
      slow: { min: 800, max: 1500 },
      normal: { min: 300, max: 800 },
      fast: { min: 100, max: 300 },
      burst: { min: 50, max: 150 }
    };

    const config = intervals[intensity] || intervals.normal;
    
    return {
      name: 'typing',
      execute: () => this.simulateKeystroke(user),
      interval: () => Math.random() * (config.max - config.min) + config.min,
      weight: 0.6 // 60% of user activity
    };
  }

  /**
   * Create cursor movement pattern
   */
  createCursorPattern(user, intensity = 'normal') {
    const intervals = {
      slow: { min: 2000, max: 5000 },
      normal: { min: 1000, max: 3000 },
      fast: { min: 500, max: 1500 }
    };

    const config = intervals[intensity] || intervals.normal;
    
    return {
      name: 'cursor',
      execute: () => this.simulateCursorMovement(user),
      interval: () => Math.random() * (config.max - config.min) + config.min,
      weight: 0.2 // 20% of user activity
    };
  }

  /**
   * Create text selection pattern
   */
  createSelectionPattern(user, intensity = 'normal') {
    return {
      name: 'selection',
      execute: () => this.simulateTextSelection(user),
      interval: () => Math.random() * 3000 + 2000, // 2-5 seconds
      weight: 0.1 // 10% of user activity
    };
  }

  /**
   * Create formatting pattern
   */
  createFormattingPattern(user) {
    return {
      name: 'formatting',
      execute: () => this.simulateFormatting(user),
      interval: () => Math.random() * 5000 + 3000, // 3-8 seconds
      weight: 0.05 // 5% of user activity
    };
  }

  /**
   * Create deletion pattern
   */
  createDeletionPattern(user) {
    return {
      name: 'deletion',
      execute: () => this.simulateDeletion(user),
      interval: () => Math.random() * 4000 + 2000, // 2-6 seconds
      weight: 0.05 // 5% of user activity
    };
  }

  /**
   * Create a simulated user with realistic behavior
   */
  async createRealisticUser(userId, behaviorProfile = 'normal') {
    const user = {
      id: userId,
      username: `load-test-user-${userId}`,
      doc: new Y.Doc(),
      provider: null,
      behaviorProfile,
      isActive: false,
      patterns: [],
      intervals: [],
      metrics: {
        keystrokes: 0,
        cursorMoves: 0,
        selections: 0,
        messagesSent: 0,
        messagesReceived: 0,
        bytesTransferred: 0,
        connectionTime: null,
        lastActivity: null,
        errors: []
      }
    };

    // Generate authentication token
    const token = this.generateTestToken(user);
    
    try {
      // Create WebSocket provider with enhanced monitoring
      user.provider = new WebsocketProvider(
        this.config.serverUrl,
        this.config.documentId,
        user.doc,
        { params: { token } }
      );

      // Setup comprehensive monitoring
      this.setupUserMonitoring(user);
      
      // Wait for connection
      await this.waitForUserConnection(user);
      
      // Setup behavior patterns based on profile
      this.setupBehaviorPatterns(user, behaviorProfile);
      
      this.connections.set(userId, user);
      console.log(`✅ Realistic user ${userId} created with ${behaviorProfile} profile`);
      
      return user;
      
    } catch (error) {
      console.error(`❌ Failed to create user ${userId}:`, error.message);
      user.metrics.errors.push({
        type: 'connection',
        message: error.message,
        timestamp: Date.now()
      });
      return user;
    }
  }

  /**
   * Setup comprehensive user monitoring
   */
  setupUserMonitoring(user) {
    const startTime = Date.now();
    
    // Connection status monitoring
    user.provider.on('status', (event) => {
      if (event.status === 'connected') {
        user.isActive = true;
        user.metrics.connectionTime = Date.now() - startTime;
        console.log(`🔗 User ${user.id} connected in ${user.metrics.connectionTime}ms`);

        // Setup WebSocket message monitoring once connected
        if (this.config.messageTrackingEnabled) {
          this.setupWebSocketMessageTracking(user);
        }
      } else if (event.status === 'disconnected') {
        user.isActive = false;
        console.log(`🔌 User ${user.id} disconnected`);
      }
    });

    // Document update monitoring
    user.doc.on('update', (update, origin) => {
      user.metrics.lastActivity = Date.now();
      
      // Analyze update type
      this.analyzeDocumentUpdate(user, update, origin);
    });

    // Error monitoring
    user.provider.on('connection-error', (error) => {
      user.metrics.errors.push({
        type: 'websocket',
        message: error.message,
        timestamp: Date.now()
      });
    });
  }

  /**
   * Setup WebSocket message tracking with detailed analysis
   */
  setupWebSocketMessageTracking(user) {
    const setupTracking = () => {
      const ws = user.provider.ws;

      if (ws && ws.readyState === 1) {
        // Override send method for outgoing message tracking
        const originalSend = ws.send.bind(ws);
        ws.send = (data, options, callback) => {
          const timestamp = Date.now();
          const size = this.getMessageSize(data);

          user.metrics.messagesSent++;
          user.metrics.bytesTransferred += size;
          this.messageStats.total++;
          this.messageStats.bytesTransferred += size;

          // Analyze message type
          this.analyzeOutgoingMessage(user, data, timestamp);

          return originalSend(data, options, callback);
        };

        // Track incoming messages
        ws.on('message', (data) => {
          const timestamp = Date.now();
          const size = this.getMessageSize(data);

          user.metrics.messagesReceived++;
          user.metrics.bytesTransferred += size;
          this.messageStats.total++;
          this.messageStats.bytesTransferred += size;

          // Analyze message type and measure latency
          this.analyzeIncomingMessage(user, data, timestamp);
        });

        // Track connection errors
        ws.on('error', (error) => {
          user.metrics.errors.push({
            type: 'websocket-error',
            message: error.message,
            timestamp: Date.now()
          });
        });
      } else {
        // Retry after a short delay
        setTimeout(setupTracking, 100);
      }
    };

    setupTracking();
  }

  /**
   * Analyze outgoing WebSocket messages
   */
  analyzeOutgoingMessage(user, data, timestamp) {
    try {
      if (data instanceof Uint8Array && data.length > 0) {
        const messageType = data[0];
        
        switch (messageType) {
          case 0: // Sync message
            this.messageStats.sync++;
            break;
          case 1: // Awareness message
            this.messageStats.awareness++;
            break;
        }
        
        // Track message frequency
        this.messageStats.messageFrequency.push({
          userId: user.id,
          type: messageType,
          timestamp,
          size: data.length,
          direction: 'outgoing'
        });
      }
    } catch (error) {
      // Ignore analysis errors
    }
  }

  /**
   * Analyze incoming WebSocket messages
   */
  analyzeIncomingMessage(user, data, timestamp) {
    try {
      if (data instanceof Buffer || data instanceof Uint8Array) {
        const messageType = data[0];
        
        // Track message frequency
        this.messageStats.messageFrequency.push({
          userId: user.id,
          type: messageType,
          timestamp,
          size: data.length,
          direction: 'incoming'
        });
      }
    } catch (error) {
      // Ignore analysis errors
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
   * Analyze document updates
   */
  analyzeDocumentUpdate(user, update, origin) {
    // This could be enhanced to analyze the type of update
    // (insertion, deletion, formatting, etc.)
    if (origin === user.doc) {
      // Update originated from this user
      user.metrics.keystrokes++;
    }
  }

  /**
   * Wait for user connection with timeout
   */
  waitForUserConnection(user, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkConnection = () => {
        if (user.isActive) {
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
   * Setup behavior patterns for a user
   */
  setupBehaviorPatterns(user, profile) {
    const profiles = {
      slow: { typing: 'slow', cursor: 'slow', activity: 0.3 },
      normal: { typing: 'normal', cursor: 'normal', activity: 0.6 },
      fast: { typing: 'fast', cursor: 'fast', activity: 0.8 },
      burst: { typing: 'burst', cursor: 'fast', activity: 0.9 }
    };

    const config = profiles[profile] || profiles.normal;
    
    // Create patterns based on profile
    user.patterns = [
      this.createTypingPattern(user, config.typing),
      this.createCursorPattern(user, config.cursor),
      this.createSelectionPattern(user),
      this.createFormattingPattern(user),
      this.createDeletionPattern(user)
    ];

    // Start pattern execution based on activity level
    user.patterns.forEach(pattern => {
      if (Math.random() < config.activity * pattern.weight) {
        this.startPatternExecution(user, pattern);
      }
    });
  }

  /**
   * Start pattern execution for a user
   */
  startPatternExecution(user, pattern) {
    const executePattern = () => {
      if (!user.isActive) return;

      try {
        pattern.execute();

        // Schedule next execution
        const nextInterval = pattern.interval();
        const timeoutId = setTimeout(executePattern, nextInterval);
        user.intervals.push(timeoutId);

      } catch (error) {
        user.metrics.errors.push({
          type: 'pattern-execution',
          pattern: pattern.name,
          message: error.message,
          timestamp: Date.now()
        });
      }
    };

    // Start with initial delay
    const initialDelay = Math.random() * 1000; // 0-1 second
    setTimeout(executePattern, initialDelay);
  }

  /**
   * Simulate realistic keystroke
   */
  simulateKeystroke(user) {
    if (!user.isActive || !user.doc) return;

    const text = user.doc.getText('content');
    const sentences = [
      'The quick brown fox jumps over the lazy dog.',
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      'This is a collaborative editing performance test.',
      'WebSocket connections are being monitored for load testing.',
      'Real-time synchronization requires efficient message handling.',
      'Multiple users are typing simultaneously in this document.',
      'Performance metrics help optimize the collaboration system.',
      'Redis caching improves response times for user sessions.'
    ];

    try {
      const sentence = sentences[Math.floor(Math.random() * sentences.length)];
      const words = sentence.split(' ');
      const word = words[Math.floor(Math.random() * words.length)];

      // Insert at random position or at the end
      const insertPosition = Math.random() < 0.7 ?
        text.length :
        Math.floor(Math.random() * (text.length + 1));

      text.insert(insertPosition, word + ' ');
      user.metrics.keystrokes++;
      user.metrics.lastActivity = Date.now();

    } catch (error) {
      user.metrics.errors.push({
        type: 'keystroke',
        message: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Simulate cursor movement
   */
  simulateCursorMovement(user) {
    if (!user.isActive || !user.provider.awareness) return;

    try {
      const text = user.doc.getText('content');
      const position = Math.floor(Math.random() * (text.length + 1));

      user.provider.awareness.setLocalStateField('cursor', {
        anchor: position,
        head: position
      });

      user.metrics.cursorMoves++;
      user.metrics.lastActivity = Date.now();

    } catch (error) {
      user.metrics.errors.push({
        type: 'cursor',
        message: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Simulate text selection
   */
  simulateTextSelection(user) {
    if (!user.isActive || !user.provider.awareness) return;

    try {
      const text = user.doc.getText('content');
      if (text.length < 10) return;

      const start = Math.floor(Math.random() * (text.length - 10));
      const end = start + Math.floor(Math.random() * 20) + 5;

      user.provider.awareness.setLocalStateField('cursor', {
        anchor: start,
        head: Math.min(end, text.length)
      });

      user.metrics.selections++;
      user.metrics.lastActivity = Date.now();

    } catch (error) {
      user.metrics.errors.push({
        type: 'selection',
        message: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Simulate formatting operations
   */
  simulateFormatting(user) {
    // This would require more complex YJS operations
    // For now, just update awareness to indicate formatting activity
    if (!user.isActive || !user.provider.awareness) return;

    try {
      user.provider.awareness.setLocalStateField('formatting', {
        type: ['bold', 'italic', 'underline'][Math.floor(Math.random() * 3)],
        timestamp: Date.now()
      });

      user.metrics.lastActivity = Date.now();

    } catch (error) {
      user.metrics.errors.push({
        type: 'formatting',
        message: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Simulate deletion operations
   */
  simulateDeletion(user) {
    if (!user.isActive || !user.doc) return;

    try {
      const text = user.doc.getText('content');
      if (text.length < 5) return;

      const deleteLength = Math.floor(Math.random() * 5) + 1;
      const deletePosition = Math.floor(Math.random() * (text.length - deleteLength));

      text.delete(deletePosition, deleteLength);
      user.metrics.lastActivity = Date.now();

    } catch (error) {
      user.metrics.errors.push({
        type: 'deletion',
        message: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Generate test token for authentication
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
   * Run comprehensive WebSocket load test
   */
  async runLoadTest(duration = 60000) {
    console.log('\n🚀 Starting WebSocket Load Test...');
    console.log(`👥 Creating ${this.config.userCount} users with realistic behavior patterns`);

    const startTime = Date.now();

    // Create users with different behavior profiles
    const profiles = ['slow', 'normal', 'fast', 'burst'];
    const users = [];

    for (let i = 1; i <= this.config.userCount; i++) {
      const profile = profiles[i % profiles.length];
      const user = await this.createRealisticUser(i, profile);
      users.push(user);

      // Stagger connections to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`✅ Created ${users.length} users`);
    console.log(`⏱️  Running load test for ${duration / 1000} seconds...`);

    // Run test for specified duration
    await new Promise(resolve => setTimeout(resolve, duration));

    console.log('🏁 Load test completed, analyzing results...');

    // Stop all user activities
    users.forEach(user => {
      user.intervals.forEach(intervalId => clearTimeout(intervalId));
      user.intervals = [];
    });

    const endTime = Date.now();
    const testDuration = endTime - startTime;

    // Generate detailed analysis
    const analysis = this.analyzeLoadTestResults(users, testDuration);

    // Cleanup
    await this.cleanupUsers(users);

    return analysis;
  }

  /**
   * Analyze load test results
   */
  analyzeLoadTestResults(users, testDuration) {
    const activeUsers = users.filter(user => user.isActive);
    const totalKeystrokes = users.reduce((sum, user) => sum + user.metrics.keystrokes, 0);
    const totalMessages = users.reduce((sum, user) => sum + user.metrics.messagesSent + user.metrics.messagesReceived, 0);

    // Calculate message frequency analysis
    const messageFrequencyAnalysis = this.analyzeMessageFrequency();

    // Calculate keystroke to message ratio
    const keystrokeToMessageRatio = totalKeystrokes > 0 ? totalMessages / totalKeystrokes : 0;

    return {
      summary: {
        testDuration: testDuration / 1000,
        totalUsers: users.length,
        activeUsers: activeUsers.length,
        connectionSuccessRate: (activeUsers.length / users.length * 100).toFixed(2) + '%'
      },
      activity: {
        totalKeystrokes,
        keystrokesPerSecond: (totalKeystrokes / (testDuration / 1000)).toFixed(2),
        totalMessages,
        messagesPerSecond: (totalMessages / (testDuration / 1000)).toFixed(2),
        keystrokeToMessageRatio: keystrokeToMessageRatio.toFixed(2)
      },
      websocket: {
        syncMessages: this.messageStats.sync,
        awarenessMessages: this.messageStats.awareness,
        totalBytesTransferred: this.messageStats.bytesTransferred,
        averageMessageSize: this.messageStats.total > 0 ?
          (this.messageStats.bytesTransferred / this.messageStats.total).toFixed(2) : 0
      },
      messageFrequency: messageFrequencyAnalysis,
      userProfiles: this.analyzeUserProfiles(users),
      errors: this.analyzeErrors(users),
      recommendations: this.generateLoadTestRecommendations(keystrokeToMessageRatio, activeUsers.length, users.length)
    };
  }

  /**
   * Analyze message frequency patterns
   */
  analyzeMessageFrequency() {
    if (this.messageStats.messageFrequency.length === 0) {
      return { analysis: 'No message frequency data available' };
    }

    // Group messages by time windows (1-second intervals)
    const timeWindows = {};
    const startTime = Math.min(...this.messageStats.messageFrequency.map(m => m.timestamp));

    this.messageStats.messageFrequency.forEach(msg => {
      const window = Math.floor((msg.timestamp - startTime) / 1000);
      if (!timeWindows[window]) {
        timeWindows[window] = { sync: 0, awareness: 0, total: 0 };
      }

      if (msg.type === 0) timeWindows[window].sync++;
      else if (msg.type === 1) timeWindows[window].awareness++;
      timeWindows[window].total++;
    });

    const windowValues = Object.values(timeWindows);
    const avgMessagesPerSecond = windowValues.reduce((sum, w) => sum + w.total, 0) / windowValues.length;
    const peakMessagesPerSecond = Math.max(...windowValues.map(w => w.total));

    return {
      averageMessagesPerSecond: avgMessagesPerSecond.toFixed(2),
      peakMessagesPerSecond,
      syncToAwarenessRatio: this.messageStats.awareness > 0 ?
        (this.messageStats.sync / this.messageStats.awareness).toFixed(2) : 'N/A'
    };
  }

  /**
   * Analyze user profiles performance
   */
  analyzeUserProfiles(users) {
    const profiles = {};

    users.forEach(user => {
      const profile = user.behaviorProfile;
      if (!profiles[profile]) {
        profiles[profile] = {
          count: 0,
          totalKeystrokes: 0,
          totalMessages: 0,
          errors: 0,
          connectionSuccess: 0
        };
      }

      profiles[profile].count++;
      profiles[profile].totalKeystrokes += user.metrics.keystrokes;
      profiles[profile].totalMessages += user.metrics.messagesSent + user.metrics.messagesReceived;
      profiles[profile].errors += user.metrics.errors.length;
      if (user.isActive) profiles[profile].connectionSuccess++;
    });

    // Calculate averages
    Object.keys(profiles).forEach(profile => {
      const data = profiles[profile];
      data.avgKeystrokesPerUser = (data.totalKeystrokes / data.count).toFixed(2);
      data.avgMessagesPerUser = (data.totalMessages / data.count).toFixed(2);
      data.connectionSuccessRate = ((data.connectionSuccess / data.count) * 100).toFixed(2) + '%';
    });

    return profiles;
  }

  /**
   * Analyze errors across all users
   */
  analyzeErrors(users) {
    const errorTypes = {};
    let totalErrors = 0;

    users.forEach(user => {
      user.metrics.errors.forEach(error => {
        totalErrors++;
        if (!errorTypes[error.type]) {
          errorTypes[error.type] = 0;
        }
        errorTypes[error.type]++;
      });
    });

    return {
      totalErrors,
      errorTypes,
      errorRate: ((totalErrors / users.length) * 100).toFixed(2) + '%'
    };
  }

  /**
   * Generate load test recommendations
   */
  generateLoadTestRecommendations(keystrokeToMessageRatio, activeUsers, totalUsers) {
    const recommendations = [];

    if (keystrokeToMessageRatio > 4) {
      recommendations.push({
        type: 'websocket-optimization',
        severity: 'high',
        issue: 'High message-to-keystroke ratio',
        description: `Each keystroke generates ${keystrokeToMessageRatio} WebSocket messages on average`,
        recommendation: 'Implement message batching or debouncing to reduce WebSocket traffic'
      });
    }

    if (activeUsers / totalUsers < 0.9) {
      recommendations.push({
        type: 'connection-reliability',
        severity: 'medium',
        issue: 'Connection success rate below 90%',
        description: `Only ${((activeUsers / totalUsers) * 100).toFixed(1)}% of users successfully connected`,
        recommendation: 'Improve connection handling and implement retry mechanisms'
      });
    }

    if (this.messageStats.bytesTransferred > 1024 * 1024) { // > 1MB
      recommendations.push({
        type: 'bandwidth-optimization',
        severity: 'medium',
        issue: 'High bandwidth usage',
        description: `${(this.messageStats.bytesTransferred / 1024 / 1024).toFixed(2)}MB transferred during test`,
        recommendation: 'Consider message compression or more efficient serialization'
      });
    }

    return recommendations;
  }

  /**
   * Cleanup all users
   */
  async cleanupUsers(users) {
    console.log('🧹 Cleaning up users...');

    for (const user of users) {
      try {
        // Clear intervals
        user.intervals.forEach(intervalId => clearTimeout(intervalId));

        // Destroy provider and document
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

    this.connections.clear();
    console.log('✅ User cleanup completed');
  }
}

module.exports = WebSocketLoadTester;
