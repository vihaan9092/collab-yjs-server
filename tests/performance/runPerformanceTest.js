#!/usr/bin/env node

/**
 * Performance Test Runner
 * Comprehensive performance testing for WebSocket and Redis load with 20 concurrent users
 */

const PerformanceTestSuite = require('./PerformanceTestSuite');
const WebSocketLoadTester = require('./WebSocketLoadTester');
const RedisMonitor = require('./RedisMonitor');
const KeystrokeAnalyzer = require('./KeystrokeAnalyzer');

class PerformanceTestRunner {
  constructor(config = {}) {
    this.config = {
      serverUrl: config.serverUrl || 'ws://localhost:3000',
      redisUrl: config.redisUrl || 'redis://localhost:6379',
      userCount: config.userCount || 20,
      testDuration: config.testDuration || 60000, // 1 minute
      keystrokeInterval: config.keystrokeInterval || 500, // 500ms
      runKeystrokeAnalysis: config.runKeystrokeAnalysis !== false,
      runLoadTest: config.runLoadTest === true, // Disabled by default due to WebSocket monitoring issues
      runRedisMonitoring: config.runRedisMonitoring !== false,
      ...config
    };

    this.results = {
      performanceTest: null,
      loadTest: null,
      redisMonitoring: null,
      keystrokeAnalysis: null,
      summary: null
    };
  }

  /**
   * Run comprehensive performance testing
   */
  async runTests() {
    console.log('🚀 Starting Comprehensive Performance Testing Suite');
    console.log('='.repeat(80));

    // Check debouncing configuration
    const debounceEnabled = process.env.DEBOUNCE_ENABLED !== 'false';
    const debounceDelay = parseInt(process.env.DEBOUNCE_DELAY) || 300;
    const debounceMaxDelay = parseInt(process.env.DEBOUNCE_MAX_DELAY) || 1000;

    console.log(`📊 Configuration:
    - Server URL: ${this.config.serverUrl}
    - Redis URL: ${this.config.redisUrl}
    - User Count: ${this.config.userCount}
    - Test Duration: ${this.config.testDuration / 1000} seconds
    - Keystroke Interval: ${this.config.keystrokeInterval}ms
    - Debouncing: ${debounceEnabled ? `ENABLED (${debounceDelay}ms delay, ${debounceMaxDelay}ms max)` : 'DISABLED'}`);
    console.log('='.repeat(80));

    const startTime = Date.now();

    try {
      // 1. Run Keystroke Analysis (if enabled)
      if (this.config.runKeystrokeAnalysis) {
        console.log('\n🔍 Phase 1: Keystroke Pattern Analysis');
        await this.runKeystrokeAnalysis();
      }

      // 2. Run Redis Monitoring Setup
      let redisMonitor = null;
      if (this.config.runRedisMonitoring) {
        console.log('\n🔴 Phase 2: Setting up Redis Monitoring');
        redisMonitor = await this.setupRedisMonitoring();
      }

      // 3. Run Main Performance Test
      console.log('\n📊 Phase 3: Main Performance Test');
      await this.runMainPerformanceTest();

      // 4. Run WebSocket Load Test (if enabled)
      if (this.config.runLoadTest) {
        console.log('\n🌐 Phase 4: WebSocket Load Testing');
        await this.runWebSocketLoadTest();
      }

      // 5. Collect Redis Results
      if (redisMonitor) {
        console.log('\n🔴 Phase 5: Collecting Redis Results');
        await this.collectRedisResults(redisMonitor);
      }

      // 6. Generate Comprehensive Report
      console.log('\n📋 Phase 6: Generating Comprehensive Report');
      this.generateComprehensiveReport();

      const endTime = Date.now();
      const totalDuration = (endTime - startTime) / 1000;

      console.log(`\n✅ All performance tests completed in ${totalDuration.toFixed(2)} seconds`);
      
      return this.results;

    } catch (error) {
      console.error('❌ Performance testing failed:', error.message);
      console.error(error.stack);
      throw error;
    }
  }

  /**
   * Run keystroke analysis
   */
  async runKeystrokeAnalysis() {
    try {
      const analyzer = new KeystrokeAnalyzer({
        serverUrl: this.config.serverUrl,
        testDuration: 30000, // 30 seconds for keystroke analysis
        analysisTypes: ['immediate', 'debounced', 'batched']
      });

      await analyzer.initialize();
      const results = await analyzer.runAnalysis();
      
      this.results.keystrokeAnalysis = results;
      analyzer.printReport(results);

      console.log('✅ Keystroke analysis completed');

    } catch (error) {
      console.error('❌ Keystroke analysis failed:', error.message);
      this.results.keystrokeAnalysis = { error: error.message };
    }
  }

  /**
   * Setup Redis monitoring
   */
  async setupRedisMonitoring() {
    try {
      const monitor = new RedisMonitor({
        redisUrl: this.config.redisUrl,
        monitoringInterval: 1000,
        trackCommands: true,
        trackMemory: true,
        trackConnections: true,
        trackKeys: true
      });

      await monitor.initialize();
      await monitor.startMonitoring();

      console.log('✅ Redis monitoring started');
      return monitor;

    } catch (error) {
      console.error('❌ Redis monitoring setup failed:', error.message);
      return null;
    }
  }

  /**
   * Run main performance test
   */
  async runMainPerformanceTest() {
    try {
      const testSuite = new PerformanceTestSuite({
        serverUrl: this.config.serverUrl,
        redisUrl: this.config.redisUrl,
        userCount: this.config.userCount,
        testDuration: this.config.testDuration,
        keystrokeInterval: this.config.keystrokeInterval,
        documentId: 'main-perf-test-doc'
      });

      await testSuite.initialize();
      const results = await testSuite.runTest();
      
      this.results.performanceTest = results;
      testSuite.printReport(results);

      console.log('✅ Main performance test completed');

    } catch (error) {
      console.error('❌ Main performance test failed:', error.message);
      this.results.performanceTest = { error: error.message };
    }
  }

  /**
   * Run WebSocket load test
   */
  async runWebSocketLoadTest() {
    try {
      const loadTester = new WebSocketLoadTester({
        serverUrl: this.config.serverUrl,
        userCount: this.config.userCount,
        documentId: 'load-test-doc',
        messageTrackingEnabled: true
      });

      const results = await loadTester.runLoadTest(this.config.testDuration);
      
      this.results.loadTest = results;
      
      // Print load test specific results
      console.log('\n🌐 WebSocket Load Test Results:');
      console.log(`   Connection Success Rate: ${results.summary.connectionSuccessRate}`);
      console.log(`   Keystroke to Message Ratio: ${results.activity.keystrokeToMessageRatio}`);
      console.log(`   Total Bytes Transferred: ${(results.websocket.totalBytesTransferred / 1024).toFixed(2)} KB`);

      console.log('✅ WebSocket load test completed');

    } catch (error) {
      console.error('❌ WebSocket load test failed:', error.message);
      this.results.loadTest = { error: error.message };
    }
  }

  /**
   * Collect Redis monitoring results
   */
  async collectRedisResults(redisMonitor) {
    try {
      await redisMonitor.stopMonitoring();
      const results = redisMonitor.generateReport();
      
      this.results.redisMonitoring = results;
      redisMonitor.printReport(results);

      await redisMonitor.cleanup();
      console.log('✅ Redis monitoring results collected');

    } catch (error) {
      console.error('❌ Redis monitoring collection failed:', error.message);
      this.results.redisMonitoring = { error: error.message };
    }
  }

  /**
   * Generate comprehensive performance report
   */
  generateComprehensiveReport() {
    const summary = {
      testConfiguration: {
        userCount: this.config.userCount,
        testDuration: this.config.testDuration / 1000,
        keystrokeInterval: this.config.keystrokeInterval
      },
      keyFindings: [],
      criticalIssues: [],
      recommendations: [],
      overallScore: 'N/A'
    };

    // Analyze keystroke patterns
    if (this.results.keystrokeAnalysis && !this.results.keystrokeAnalysis.error) {
      const keystrokeData = this.results.keystrokeAnalysis;
      
      if (keystrokeData.results.immediate) {
        const immediateRatio = parseFloat(keystrokeData.results.immediate.messagesPerKeystroke);
        
        summary.keyFindings.push(
          `Current keystroke handling generates ${immediateRatio} WebSocket messages per keystroke`
        );

        if (immediateRatio > 3) {
          summary.criticalIssues.push('High WebSocket message frequency per keystroke');
        }
      }

      // Add keystroke recommendations
      keystrokeData.recommendations.forEach(rec => {
        if (rec.severity === 'high' || rec.severity === 'medium') {
          summary.recommendations.push(`[KEYSTROKE] ${rec.recommendation}`);
        }
      });
    }

    // Analyze main performance test
    if (this.results.performanceTest && !this.results.performanceTest.error) {
      const perfData = this.results.performanceTest;
      
      summary.keyFindings.push(
        `${perfData.summary.concurrentUsers}/${perfData.summary.userCount} users successfully connected`
      );
      
      summary.keyFindings.push(
        `WebSocket traffic: ${perfData.websocket.totalMessages} messages, ${perfData.websocket.bytesTransferred}`
      );

      // Add performance recommendations
      perfData.recommendations.forEach(rec => {
        if (rec.severity === 'high' || rec.severity === 'medium') {
          summary.recommendations.push(`[PERFORMANCE] ${rec.recommendation}`);
        }
      });
    }

    // Analyze Redis monitoring
    if (this.results.redisMonitoring && !this.results.redisMonitoring.error) {
      const redisData = this.results.redisMonitoring;
      
      summary.keyFindings.push(
        `Redis: ${redisData.summary.totalCommands} commands, ${redisData.summary.commandsPerSecond} cmd/sec`
      );
      
      summary.keyFindings.push(
        `Redis memory increase: ${redisData.memory.increase}`
      );

      // Add Redis recommendations
      redisData.recommendations.forEach(rec => {
        if (rec.severity === 'high' || rec.severity === 'medium') {
          summary.recommendations.push(`[REDIS] ${rec.recommendation}`);
        }
      });
    }

    // Calculate overall performance score
    summary.overallScore = this.calculateOverallScore();

    this.results.summary = summary;

    // Print comprehensive summary
    this.printComprehensiveSummary(summary);
  }

  /**
   * Calculate overall performance score
   */
  calculateOverallScore() {
    let score = 100;
    let factors = [];

    // Keystroke efficiency factor
    if (this.results.keystrokeAnalysis && this.results.keystrokeAnalysis.results) {
      const immediate = this.results.keystrokeAnalysis.results.immediate;
      if (immediate) {
        const ratio = parseFloat(immediate.messagesPerKeystroke);
        if (ratio > 4) {
          score -= 20;
          factors.push('High keystroke message ratio');
        } else if (ratio > 2) {
          score -= 10;
          factors.push('Moderate keystroke message ratio');
        }
      }
    }

    // Connection success factor
    if (this.results.performanceTest && this.results.performanceTest.summary) {
      const successRate = parseFloat(this.results.performanceTest.summary.concurrentUsers) / 
                          parseFloat(this.results.performanceTest.summary.userCount);
      if (successRate < 0.8) {
        score -= 25;
        factors.push('Low connection success rate');
      } else if (successRate < 0.9) {
        score -= 10;
        factors.push('Moderate connection success rate');
      }
    }

    // Redis performance factor
    if (this.results.redisMonitoring && this.results.redisMonitoring.summary) {
      const cmdPerSec = parseFloat(this.results.redisMonitoring.summary.commandsPerSecond);
      if (cmdPerSec > 1000) {
        score -= 15;
        factors.push('High Redis command frequency');
      }
    }

    return {
      score: Math.max(0, score),
      factors,
      grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F'
    };
  }

  /**
   * Print comprehensive summary report
   */
  printComprehensiveSummary(summary) {
    console.log('\n' + '='.repeat(100));
    console.log('🎯 COMPREHENSIVE PERFORMANCE TEST SUMMARY');
    console.log('='.repeat(100));

    console.log('\n📋 TEST CONFIGURATION:');
    console.log(`   Users: ${summary.testConfiguration.userCount}`);
    console.log(`   Duration: ${summary.testConfiguration.testDuration} seconds`);
    console.log(`   Keystroke Interval: ${summary.testConfiguration.keystrokeInterval}ms`);

    console.log('\n🔍 KEY FINDINGS:');
    summary.keyFindings.forEach((finding, index) => {
      console.log(`   ${index + 1}. ${finding}`);
    });

    if (summary.criticalIssues.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES:');
      summary.criticalIssues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ❌ ${issue}`);
      });
    }

    console.log('\n💡 TOP RECOMMENDATIONS:');
    summary.recommendations.slice(0, 10).forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });

    console.log('\n📊 OVERALL PERFORMANCE SCORE:');
    console.log(`   Score: ${summary.overallScore.score}/100 (Grade: ${summary.overallScore.grade})`);
    if (summary.overallScore.factors.length > 0) {
      console.log('   Factors affecting score:');
      summary.overallScore.factors.forEach(factor => {
        console.log(`     • ${factor}`);
      });
    }

    console.log('\n📊 PERFORMANCE ANALYSIS:');
    console.log('='.repeat(50));

    // WebSocket Load Analysis
    if (this.results.performanceTest) {
      const wsData = this.results.performanceTest.websocket;
      console.log('\n🌐 WEBSOCKET METRICS:');
      console.log(`   • Total Messages: ${wsData.totalMessages}`);
      console.log(`   • Messages per Keystroke: ${wsData.messagesPerKeystroke}`);
      console.log(`   • Data Transferred: ${wsData.bytesTransferred}`);
      console.log(`   • Connection Errors: ${wsData.connectionErrors}`);
    }

    // Redis Load Analysis
    if (this.results.redisMonitoring) {
      const redisData = this.results.redisMonitoring;
      console.log('\n🔴 REDIS METRICS:');
      console.log(`   • Commands Executed: ${redisData.summary.totalCommands}`);
      console.log(`   • Commands per Second: ${redisData.summary.commandsPerSecond}`);
      console.log(`   • Memory Usage Increase: ${redisData.memory.increase}`);
      console.log(`   • Peak Connections: ${redisData.summary.peakConnections}`);
    }

    // Keystroke Analysis
    if (this.results.keystrokeAnalysis && this.results.keystrokeAnalysis.results) {
      const keystrokeData = this.results.keystrokeAnalysis;
      console.log('\n⌨️  KEYSTROKE ANALYSIS:');

      if (keystrokeData.results.immediate) {
        const immediate = keystrokeData.results.immediate;
        console.log(`   • Current Approach: ${immediate.messagesPerKeystroke} messages per keystroke`);
        console.log(`   • Efficiency Score: ${immediate.efficiency.efficiencyScore}`);
      }

      if (keystrokeData.comparison) {
        console.log(`   • Recommended Approach: ${keystrokeData.comparison.efficiency.mostEfficient}`);
        if (keystrokeData.comparison.performance.improvement !== '0%') {
          console.log(`   • Potential Improvement: ${keystrokeData.comparison.performance.improvement}`);
        }
      }
    }

    // Performance Recommendations with debouncing context
    let ratio = 0;
    if (this.results.keystrokeAnalysis && this.results.keystrokeAnalysis.results && this.results.keystrokeAnalysis.results.immediate) {
      ratio = parseFloat(this.results.keystrokeAnalysis.results.immediate.messagesPerKeystroke);
    } else if (this.results.performanceTest && this.results.performanceTest.websocket) {
      ratio = parseFloat(this.results.performanceTest.websocket.messagesPerKeystroke);
    }

    const debounceEnabled = process.env.DEBOUNCE_ENABLED !== 'false';

    if (ratio > 50) {
      console.log('\n🚨 CRITICAL PERFORMANCE ISSUE:');
      console.log(`   • Extremely high message frequency: ${ratio} messages per keystroke`);
      console.log('   • This indicates system overload or feedback loops');
      console.log('   • Server-side debouncing may not be functioning properly');
      if (!debounceEnabled) {
        console.log('   • DEBOUNCE_ENABLED=false - this explains the high message count');
      }
    } else if (ratio > 20) {
      console.log('\n⚠️  HIGH MESSAGE FREQUENCY:');
      console.log(`   • High message frequency: ${ratio} messages per keystroke`);
      console.log('   • This may indicate server stress or debouncing issues');
      if (debounceEnabled) {
        console.log('   • Server debouncing is enabled but may be overwhelmed');
      } else {
        console.log('   • Consider enabling debouncing: DEBOUNCE_ENABLED=true');
      }
    } else if (ratio > 5) {
      console.log('\n⚠️  OPTIMIZATION RECOMMENDATIONS:');
      console.log('   • Consider implementing debouncing for keystroke events');
      console.log('   • Batch multiple keystrokes before sending WebSocket messages');
      console.log('   • Current message frequency may impact server performance at scale');
    } else if (ratio > 2) {
      console.log('\n💡 OPTIMIZATION SUGGESTIONS:');
      console.log('   • Consider debouncing for improved efficiency');
      console.log('   • Current performance is acceptable but can be optimized');
    } else if (ratio > 0) {
      console.log('\n✅ PERFORMANCE STATUS:');
      console.log('   • Current keystroke handling is within acceptable limits');
    }

    // Add note about message counting methodology
    if (ratio > 10) {
      console.log('\n📝 NOTE:');
      console.log('   • Message counts reflect client-side Y.js operations');
      console.log('   • Server-side debouncing reduces actual network traffic');
      console.log('   • High ratios may indicate Y.js document synchronization overhead');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ PERFORMANCE TEST COMPLETED');
    console.log('='.repeat(80));
  }
}

// CLI execution
if (require.main === module) {
  const config = {
    serverUrl: process.env.SERVER_URL || 'ws://localhost:3000',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    userCount: parseInt(process.env.USER_COUNT) || 20,
    testDuration: parseInt(process.env.TEST_DURATION) || 60000,
    keystrokeInterval: parseInt(process.env.KEYSTROKE_INTERVAL) || 500
  };

  const runner = new PerformanceTestRunner(config);

  runner.runTests()
    .then(results => {
      console.log('\n✅ Performance testing completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Performance testing failed:', error.message);
      process.exit(1);
    });
}

module.exports = PerformanceTestRunner;
