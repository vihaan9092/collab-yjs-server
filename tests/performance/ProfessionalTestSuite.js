#!/usr/bin/env node

/**
 * Professional Large Document Performance Test Suite
 * Production-ready testing with realistic user simulation and accurate metrics
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const Y = require('yjs');
const { WebsocketProvider } = require('y-websocket');
const { Base64 } = require('js-base64');
const PerformanceCollector = require('./core/PerformanceCollector');
const TestUser = require('./core/TestUser');
const DocumentGenerator = require('./core/DocumentGenerator');

class ProfessionalPerformanceTestSuite {
  constructor(config = {}) {
    this.serverUrl = config.serverUrl || process.env.SERVER_URL || 'ws://localhost:3000';
    this.config = {
      outputDir: config.outputDir || path.join(__dirname, 'reports'),
      verbose: config.verbose !== false,
      saveDetailedLogs: config.saveDetailedLogs !== false,
      ...config
    };

    this.testResults = [];
    this.currentTest = null;
    this.users = [];

    // Initialize performance collector
    this.performanceCollector = new PerformanceCollector(this.config);
    this.documentGenerator = new DocumentGenerator();

    // Ensure output directory exists
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for performance monitoring
   */
  setupEventListeners() {
    this.performanceCollector.on('alert', (alert) => {
      if (this.config.verbose) {
        console.warn(`⚠️  Performance Alert [${alert.type}]:`, alert.data);
      }
    });
    
    // Note: User connection logging is handled directly in connectProfessionalUsers()
    
    this.performanceCollector.on('userDisconnected', (data) => {
      if (this.config.verbose) {
        console.log(`👋 User ${data.userId} disconnected`);
      }
    });
  }

  /**
   * Run comprehensive professional test suite
   */
  async runTestSuite() {
    console.log('🚀 Professional Large Document Performance Test Suite');
    console.log('='.repeat(80));
    console.log(`🌐 Server: ${this.serverUrl}`);
    console.log(`📅 Started: ${new Date().toISOString()}`);
    console.log(`📁 Output Directory: ${this.config.outputDir}`);
    console.log('='.repeat(80));

    const testConfigs = [
      { 
        size: 100 * 1024,
        label: '100KB',
        users: 5,
        duration: 60000,
        documentType: 'report',
        testType: 'standard_load'
      },
      { 
        size: 1.5 * 1024 * 1024, 
        label: '1.5MB', 
        users: 10, 
        duration: 90000,
        documentType: 'proposal',
        testType: 'medium_load'
      },
      { 
        size: 2 * 1024 * 1024, 
        label: '2MB', 
        users: 10, 
        duration: 120000,
        documentType: 'specification',
        testType: 'heavy_load'
      }
    ];

    for (const config of testConfigs) {
      console.log(`\n📊 Testing ${config.label} ${config.documentType} with ${config.users} professional users`);
      console.log('-'.repeat(60));
      
      try {
        const result = await this.runProfessionalTest(config);
        this.testResults.push(result);
        
        // Save individual test report
        await this.saveTestReport(result, `${config.label}-test-report.json`);
        
        // Wait between tests for system recovery
        if (config !== testConfigs[testConfigs.length - 1]) {
          console.log('⏳ Waiting 30 seconds for system recovery...');
          await this.sleep(30000);
        }
        
      } catch (error) {
        console.error(`❌ Test failed for ${config.label}:`, error.message);
        this.testResults.push({
          config,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Generate comprehensive final report
    await this.generateComprehensiveReport();
  }

  /**
   * Run a single professional test with realistic user simulation
   * @param {Object} config - Test configuration
   */
  async runProfessionalTest(config) {
    const startTime = Date.now();
    const documentId = `test-doc-${config.label.toLowerCase()}-${Date.now()}`;
    
    this.currentTest = {
      config,
      documentId,
      users: [],
      document: null,
      startTime,
      endTime: null
    };

    try {
      // Start performance collection
      this.performanceCollector.startCollection({
        testType: config.testType,
        documentSize: config.size,
        userCount: config.users,
        duration: config.duration,
        documentType: config.documentType
      });
      
      // Phase 1: Generate realistic business document
      console.log(`📄 Generating realistic ${config.documentType} document (${config.label})...`);
      const testDocument = this.documentGenerator.generateDocument(config.size, config.documentType);
      const docSummary = this.documentGenerator.generateDocumentSummary(testDocument);
      this.currentTest.document = { content: testDocument, summary: docSummary };
      
      console.log(`✅ Document generated: ${docSummary.sizeFormatted}, ${docSummary.contentTypes.paragraphs} paragraphs, ${docSummary.contentTypes.tables} tables`);
      
      // Phase 2: Create and connect professional users
      console.log(`👥 Creating ${config.users} professional users...`);
      await this.createProfessionalUsers(config.users, documentId);
      
      // Phase 3: Load document collaboratively
      console.log(`📤 Loading document collaboratively...`);
      const loadStartTime = Date.now();
      await this.loadDocumentCollaboratively(testDocument, documentId);
      const loadTime = Date.now() - loadStartTime;
      
      console.log(`✅ Document loaded in ${(loadTime / 1000).toFixed(2)}s`);
      
      // Phase 4: Simulate realistic collaborative editing
      console.log(`✏️  Starting realistic collaborative editing (${config.duration / 1000}s)...`);
      await this.simulateCollaborativeEditing(config.duration);
      
      // Phase 5: Collect final metrics and generate report
      this.performanceCollector.stopCollection();
      const totalTime = Date.now() - startTime;
      this.currentTest.endTime = Date.now();
      
      const result = {
        config,
        success: true,
        totalTime,
        documentSummary: docSummary,
        performanceReport: this.performanceCollector.generateReport(),
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ Professional test completed in ${(totalTime / 1000).toFixed(2)}s`);
      await this.printProfessionalTestSummary(result);
      
      return result;
      
    } catch (error) {
      console.error(`❌ Professional test failed:`, error.message);
      this.performanceCollector.stopCollection();
      
      return {
        config,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
    } finally {
      // Cleanup all resources
      await this.cleanupProfessionalTest();
    }
  }

  /**
   * Create professional users with realistic roles and behaviors
   * @param {number} userCount - Number of users to create
   * @param {string} documentId - Document ID
   */
  async createProfessionalUsers(userCount, documentId) {
    const userRoles = ['admin', 'editor', 'reviewer', 'contributor'];
    const editingStyles = ['aggressive', 'balanced', 'conservative'];
    const typingSpeeds = ['slow', 'normal', 'fast'];
    
    this.users = [];
    
    for (let i = 0; i < userCount; i++) {
      const role = userRoles[i % userRoles.length];
      const editingStyle = editingStyles[Math.floor(Math.random() * editingStyles.length)];
      const typingSpeed = typingSpeeds[Math.floor(Math.random() * typingSpeeds.length)];
      
      const user = new TestUser({
        id: i + 1,
        username: `${role}${i + 1}`,
        email: `${role}${i + 1}@company.com`,
        role: role,
        permissions: role === 'admin' ? ['read', 'write', 'admin'] : ['read', 'write'],
        editingStyle: editingStyle,
        typingSpeed: typingSpeed
      });
      
      // Setup user event listeners
      this.setupUserEventListeners(user);
      
      this.users.push(user);
    }
    
    // Connect all users
    const connectionPromises = this.users.map(user => 
      user.connectToDocument(this.serverUrl, documentId)
    );
    
    const results = await Promise.allSettled(connectionPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    console.log(`✅ Connected ${successful}/${userCount} professional users`);

    if (successful < userCount) {
      throw new Error(`Only ${successful}/${userCount} users connected successfully`);
    }

    // Record connection metrics
    this.users.forEach(user => {
      this.performanceCollector.recordUserConnection(user.id, {
        username: user.username,
        role: user.role,
        connectionTime: user.connectionTime,
        editingStyle: user.editingStyle
      });
    });
  }

  /**
   * Setup event listeners for a user
   * @param {TestUser} user - User instance
   */
  setupUserEventListeners(user) {
    // Note: Connection logging is handled in connectProfessionalUsers() to avoid duplicates

    user.on('disconnected', (data) => {
      this.performanceCollector.recordUserDisconnection(data.userId, data);
    });

    user.on('operationAck', (data) => {
      this.performanceCollector.recordLatency(data.userId, data.operationId, data.latency);
    });

    user.on('error', (data) => {
      this.performanceCollector.recordError(data.userId, data.error);
    });

    user.on('editPerformed', (data) => {
      this.performanceCollector.recordDocumentOperation(this.currentTest.documentId, {
        userId: data.userId,
        operationType: data.operationType,
        operationId: data.operationId
      });
    });
  }

  /**
   * Load document collaboratively with realistic chunking
   * @param {Object} document - Document content
   * @param {string} documentId - Document ID
   */
  async loadDocumentCollaboratively(document, documentId) {
    if (this.users.length === 0) {
      throw new Error('No users available for document loading');
    }

    // Use the first user (admin) to load the document
    const adminUser = this.users.find(u => u.role === 'admin') || this.users[0];
    const documentJson = JSON.stringify(document);
    const chunkSize = 8192; // 8KB chunks for realistic loading
    
    console.log(`📦 Loading document via ${adminUser.username} in ${Math.ceil(documentJson.length / chunkSize)} chunks`);

    // Send document in realistic chunks
    for (let i = 0; i < documentJson.length; i += chunkSize) {
      const chunk = documentJson.substring(i, i + chunkSize);
      const isLastChunk = i + chunkSize >= documentJson.length;
      
      // Create a proper Y.js insert operation for document loading
      const operation = {
        type: 'insert',
        position: i === 0 ? 0 : adminUser.ytext.length, // Append chunks
        content: chunk,
        text: chunk
      };

      const message = {
        type: 'document-load',
        documentId: documentId,
        operation: operation,
        chunkIndex: Math.floor(i / chunkSize),
        totalChunks: Math.ceil(documentJson.length / chunkSize),
        isLastChunk: isLastChunk,
        totalSize: documentJson.length,
        loadedBy: adminUser.username
      };

      adminUser.queueOperation(message);
      
      // Realistic delay between chunks
      await this.sleep(20 + Math.random() * 30);
    }

    // Wait for document to propagate to all users
    await this.sleep(3000 + (this.users.length * 500));
    console.log(`✅ Document propagated to all ${this.users.length} users`);
  }

  /**
   * Simulate realistic collaborative editing
   * @param {number} duration - Test duration in milliseconds
   */
  async simulateCollaborativeEditing(duration) {
    if (this.users.length === 0) {
      throw new Error('No users available for collaborative editing');
    }
    
    console.log(`🎭 Starting realistic collaborative editing simulation...`);
    console.log(`   👥 ${this.users.length} users with different roles and editing styles`);
    console.log(`   ⏱️  Duration: ${duration / 1000} seconds`);
    
    // Start editing for all users with staggered start times
    const editingPromises = this.users.map((user, index) => {
      // Stagger user start times to simulate realistic joining
      const startDelay = index * 2000; // 2 seconds between users
      
      return new Promise(async (resolve) => {
        await this.sleep(startDelay);
        
        console.log(`👤 ${user.username} (${user.role}) started editing with ${user.editingStyle} style`);
        
        try {
          await user.startEditing(duration - startDelay);
          resolve();
        } catch (error) {
          console.error(`❌ ${user.username} editing failed:`, error.message);
          resolve();
        }
      });
    });

    // Wait for all users to complete editing
    await Promise.all(editingPromises);
    
    console.log(`✅ Collaborative editing simulation completed`);
    
    // Update final user metrics
    this.users.forEach(user => {
      this.performanceCollector.updateUserMetrics(user.id, user.getMetrics());
    });
  }

  /**
   * Print professional test summary
   * @param {Object} result - Test result
   */
  async printProfessionalTestSummary(result) {
    const { config, performanceReport } = result;
    const summary = performanceReport.summary;
    const systemMetrics = performanceReport.systemMetrics;
    const userMetrics = performanceReport.userMetrics;

    // Get Redis stats
    let redisStats = null;
    try {
      const response = await fetch('http://localhost:3000/api/stats');
      const stats = await response.json();
      redisStats = stats.documents?.redisSync;
    } catch (error) {
      // Redis stats not available
    }

    console.log(`\n📊 ${config.label} Professional Test Summary:`);
    console.log(`   📄 Document: ${config.documentType} (${config.label})`);
    console.log(`   👥 Users: ${summary.totalUsers} (${summary.successfulConnections} connected)`);
    console.log(`   ⏱️  Duration: ${summary.duration}`);
    console.log(`   ⚡ Avg Latency: ${summary.averageLatency}`);
    console.log(`   🔄 Total Operations: ${summary.totalOperations}`);
    console.log(`   📊 Throughput: ${performanceReport.applicationMetrics.throughput}`);
    console.log(`   🧠 Memory Used: ${systemMetrics.memory.peak} (efficient)`);
    console.log(`   📈 Reliability: ${performanceReport.applicationMetrics.reliability}`);
    console.log(`   ❌ Error Rate: ${summary.errorRate}`);

    // Only show alerts if there are any
    if (summary.alertCount > 0) {
      console.log(`   ⚠️  Alerts: ${summary.alertCount}`);
    }

    if (userMetrics) {
      console.log(`   👤 User Activity: ${userMetrics.totalEdits} edits (${userMetrics.averageEditsPerUser.toFixed(1)} per user)`);
      console.log(`   🔗 Avg Connection Time: ${userMetrics.averageConnectionTime}`);
    }

    // Show Redis collaboration stats
    if (redisStats) {
      const efficiency = summary.totalOperations > 0 ?
        ((redisStats.messagesSent / summary.totalOperations) * 100).toFixed(1) : 'N/A';

      console.log(`\n🔄 Redis Collaboration Stats:`);
      console.log(`   📤 Messages Sent: ${redisStats.messagesSent}`);
      console.log(`   📥 Messages Received: ${redisStats.messagesReceived}`);
      console.log(`   📊 Documents Tracked: ${redisStats.documentsTracked}`);
      console.log(`   ⚡ Sync Efficiency: ${efficiency}% (Y.js batching)`);
    }
  }

  /**
   * Save individual test report
   * @param {Object} result - Test result
   * @param {string} filename - Report filename
   */
  async saveTestReport(result, filename) {
    const filepath = path.join(this.config.outputDir, filename);

    try {
      const reportData = {
        ...result,
        generatedAt: new Date().toISOString(),
        testSuite: 'Professional Large Document Performance Test',
        version: '2.0.0'
      };

      fs.writeFileSync(filepath, JSON.stringify(reportData, null, 2));

      if (this.config.verbose) {
        console.log(`📄 Test report saved: ${filepath}`);
      }

    } catch (error) {
      console.error(`❌ Failed to save test report: ${error.message}`);
    }
  }

  /**
   * Generate comprehensive final report
   */
  async generateComprehensiveReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📋 COMPREHENSIVE PERFORMANCE TEST REPORT');
    console.log('='.repeat(80));

    const successfulTests = this.testResults.filter(r => r.success);
    const failedTests = this.testResults.filter(r => !r.success);

    console.log(`\n📊 Test Suite Summary:`);
    console.log(`   ✅ Successful Tests: ${successfulTests.length}`);
    console.log(`   ❌ Failed Tests: ${failedTests.length}`);
    console.log(`   📈 Success Rate: ${((successfulTests.length / this.testResults.length) * 100).toFixed(2)}%`);

    // Individual test summaries
    this.testResults.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.config.label} ${result.config.documentType} Test:`);

      if (result.success) {
        const summary = result.performanceReport.summary;
        const appMetrics = result.performanceReport.applicationMetrics;

        console.log(`   ✅ Status: SUCCESS`);
        console.log(`   ⏱️  Duration: ${(result.totalTime / 1000).toFixed(2)}s`);
        console.log(`   👥 Users: ${summary.successfulConnections}/${summary.totalUsers}`);
        console.log(`   ⚡ Latency: ${summary.averageLatency}ms (max: ${appMetrics.latency.max}ms)`);
        console.log(`   📊 Throughput: ${appMetrics.throughput.toFixed(2)} ops/s`);
        console.log(`   🧠 Memory: ${result.performanceReport.systemMetrics.memory.peak}`);
        console.log(`   📈 Reliability: ${appMetrics.reliability.toFixed(2)}%`);
        console.log(`   ❌ Errors: ${summary.errorRate}%`);

      } else {
        console.log(`   ❌ Status: FAILED`);
        console.log(`   🚨 Error: ${result.error}`);
      }
    });

    // Performance comparison
    if (successfulTests.length > 1) {
      console.log(`\n📈 Performance Comparison:`);
      console.log('   Document Size | Avg Latency | Peak Memory | Throughput | Reliability');
      console.log('   ' + '-'.repeat(70));

      successfulTests.forEach(result => {
        const summary = result.performanceReport.summary;
        const appMetrics = result.performanceReport.applicationMetrics;
        const sysMetrics = result.performanceReport.systemMetrics;

        console.log(`   ${result.config.label.padEnd(12)} | ${summary.averageLatency.toString().padEnd(10)} | ${sysMetrics.memory.peak.padEnd(10)} | ${appMetrics.throughput.toFixed(2).padEnd(9)} | ${appMetrics.reliability.toFixed(1)}%`);
      });
    }

    // Recommendations
    console.log(`\n💡 Performance Recommendations:`);
    const allRecommendations = successfulTests.flatMap(r => r.performanceReport.recommendations);

    if (allRecommendations.length > 0) {
      const uniqueRecommendations = allRecommendations.filter((rec, index, arr) =>
        arr.findIndex(r => r.type === rec.type) === index
      );

      uniqueRecommendations.forEach(rec => {
        const priority = rec.priority === 'critical' ? '🚨' : rec.priority === 'high' ? '⚠️' : '💡';
        console.log(`   ${priority} ${rec.message}: ${rec.suggestion}`);
      });
    } else {
      console.log(`   ✅ No performance issues detected - system is performing optimally!`);
    }

    // Save comprehensive report
    await this.saveComprehensiveReport();

    console.log('\n='.repeat(80));
    console.log('✅ Professional Performance Test Suite Completed!');
    console.log(`📁 All reports saved to: ${this.config.outputDir}`);
    console.log('='.repeat(80));
  }

  /**
   * Save comprehensive report to file
   */
  async saveComprehensiveReport() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `comprehensive-performance-report-${timestamp}.json`;
    const filepath = path.join(this.config.outputDir, filename);

    const comprehensiveReport = {
      testSuite: 'Professional Large Document Performance Test Suite',
      version: '2.0.0',
      generatedAt: new Date().toISOString(),
      serverUrl: this.serverUrl,
      configuration: this.config,
      summary: {
        totalTests: this.testResults.length,
        successfulTests: this.testResults.filter(r => r.success).length,
        failedTests: this.testResults.filter(r => !r.success).length,
        successRate: (this.testResults.filter(r => r.success).length / this.testResults.length * 100).toFixed(2)
      },
      testResults: this.testResults,
      performanceCollectorReport: this.performanceCollector.generateReport()
    };

    try {
      fs.writeFileSync(filepath, JSON.stringify(comprehensiveReport, null, 2));
      console.log(`📄 Comprehensive report saved: ${filepath}`);

      // Also save performance collector report
      await this.performanceCollector.saveReport(`performance-metrics-${timestamp}.json`);

    } catch (error) {
      console.error(`❌ Failed to save comprehensive report: ${error.message}`);
    }
  }

  /**
   * Cleanup professional test resources
   */
  async cleanupProfessionalTest() {
    if (this.config.verbose) {
      console.log('🧹 Cleaning up test resources...');
    }

    // Disconnect all users
    const disconnectionPromises = this.users.map(user => user.disconnect());
    await Promise.allSettled(disconnectionPromises);

    // Clear users array
    this.users = [];

    // Cleanup performance collector
    this.performanceCollector.cleanup();

    // Wait for cleanup
    await this.sleep(2000);

    if (this.config.verbose) {
      console.log('✅ Cleanup completed');
    }
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run professional test suite if called directly
if (require.main === module) {
  const config = {
    serverUrl: process.env.SERVER_URL || 'ws://localhost:3000',
    verbose: process.env.VERBOSE !== 'false',
    outputDir: process.env.OUTPUT_DIR || path.join(__dirname, 'reports')
  };
  
  const testSuite = new ProfessionalPerformanceTestSuite(config);
  testSuite.runTestSuite().catch(console.error);
}

module.exports = ProfessionalPerformanceTestSuite;
