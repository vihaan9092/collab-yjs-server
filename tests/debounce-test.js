#!/usr/bin/env node

/**
 * Debouncing Test Script
 * Tests the debouncing functionality to ensure it works correctly
 */

const PerformanceTestSuite = require('./performance/PerformanceTestSuite');

class DebounceTest {
  constructor() {
    this.config = {
      serverUrl: 'ws://localhost:3000',
      redisUrl: 'redis://localhost:6379',
      userCount: 5,
      testDuration: 20000, // 20 seconds
      keystrokeInterval: 100, // Fast typing - 100ms between keystrokes
    };
  }

  async runDebounceTest() {
    console.log('🧪 Starting Debouncing Test...');
    console.log('='.repeat(60));
    
    // Test 1: With debouncing enabled
    console.log('\n📊 Test 1: WITH DEBOUNCING (should show fewer messages)');
    process.env.DEBOUNCE_ENABLED = 'true';
    process.env.DEBOUNCE_DELAY = '300';
    process.env.DEBOUNCE_MAX_DELAY = '1000';
    
    const testWithDebouncing = await this.runSingleTest('debounced-test-doc');
    
    // Test 2: With debouncing disabled
    console.log('\n📊 Test 2: WITHOUT DEBOUNCING (should show more messages)');
    process.env.DEBOUNCE_ENABLED = 'false';
    
    const testWithoutDebouncing = await this.runSingleTest('immediate-test-doc');
    
    // Compare results
    this.compareResults(testWithDebouncing, testWithoutDebouncing);
  }

  async runSingleTest(documentId) {
    const testSuite = new PerformanceTestSuite({
      ...this.config,
      documentId
    });

    try {
      await testSuite.initialize();
      const results = await testSuite.runTest();
      return results;
    } catch (error) {
      console.error('Test failed:', error.message);
      return null;
    }
  }

  compareResults(debouncedResults, immediateResults) {
    console.log('\n' + '='.repeat(60));
    console.log('📈 DEBOUNCING EFFECTIVENESS ANALYSIS');
    console.log('='.repeat(60));

    if (!debouncedResults || !immediateResults) {
      console.log('❌ Cannot compare results - one or both tests failed');
      return;
    }

    const debouncedMessages = debouncedResults.websocket.totalMessages;
    const immediateMessages = immediateResults.websocket.totalMessages;
    
    const debouncedKeystrokes = debouncedResults.summary.totalKeystrokes;
    const immediateKeystrokes = immediateResults.summary.totalKeystrokes;

    const debouncedRatio = debouncedKeystrokes > 0 ? debouncedMessages / debouncedKeystrokes : 0;
    const immediateRatio = immediateKeystrokes > 0 ? immediateMessages / immediateKeystrokes : 0;

    console.log('\n📊 MESSAGE COMPARISON:');
    console.log(`   With Debouncing:    ${debouncedMessages} messages (${debouncedRatio.toFixed(2)} per keystroke)`);
    console.log(`   Without Debouncing: ${immediateMessages} messages (${immediateRatio.toFixed(2)} per keystroke)`);

    if (immediateMessages > 0) {
      const reduction = ((immediateMessages - debouncedMessages) / immediateMessages * 100);
      console.log(`   Message Reduction:  ${reduction.toFixed(1)}%`);
      
      if (reduction > 30) {
        console.log('   ✅ EXCELLENT: Debouncing is working effectively!');
      } else if (reduction > 10) {
        console.log('   ⚠️  MODERATE: Debouncing is working but could be optimized');
      } else {
        console.log('   ❌ POOR: Debouncing may not be working correctly');
      }
    }

    console.log('\n📊 KEYSTROKE COMPARISON:');
    console.log(`   With Debouncing:    ${debouncedKeystrokes} keystrokes`);
    console.log(`   Without Debouncing: ${immediateKeystrokes} keystrokes`);

    const debouncedBytes = parseInt(debouncedResults.websocket.bytesTransferred.replace(/[^\d]/g, ''));
    const immediateBytes = parseInt(immediateResults.websocket.bytesTransferred.replace(/[^\d]/g, ''));

    console.log('\n📊 BANDWIDTH COMPARISON:');
    console.log(`   With Debouncing:    ${debouncedResults.websocket.bytesTransferred}`);
    console.log(`   Without Debouncing: ${immediateResults.websocket.bytesTransferred}`);

    if (immediateBytes > 0) {
      const bandwidthSaving = ((immediateBytes - debouncedBytes) / immediateBytes * 100);
      console.log(`   Bandwidth Saved:    ${bandwidthSaving.toFixed(1)}%`);
    }

    console.log('\n💡 RECOMMENDATIONS:');
    
    if (debouncedRatio < 2) {
      console.log('   ✅ Current debouncing settings are optimal for this workload');
    } else if (debouncedRatio < 5) {
      console.log('   ⚠️  Consider increasing DEBOUNCE_DELAY to reduce message frequency');
    } else {
      console.log('   ❌ Debouncing may not be working - check configuration');
    }

    if (immediateRatio > 10) {
      console.log('   🚨 Without debouncing, message frequency is very high - debouncing is essential');
    }

    console.log('\n🔧 CONFIGURATION SUGGESTIONS:');
    
    if (debouncedRatio > 3) {
      console.log('   • Increase DEBOUNCE_DELAY to 500ms for better batching');
    }
    
    if (immediateRatio > 15) {
      console.log('   • Consider implementing client-side prediction to reduce server load');
    }

    console.log('\n' + '='.repeat(60));
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  const test = new DebounceTest();
  
  test.runDebounceTest()
    .then(() => {
      console.log('\n🎉 Debouncing test completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Debouncing test failed:', error.message);
      process.exit(1);
    });
}

module.exports = DebounceTest;
