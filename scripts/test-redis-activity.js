#!/usr/bin/env node

/**
 * Test Redis Activity Script
 * Simulates document updates to visualize Redis pub/sub in action
 */

const WebSocket = require('ws');
const axios = require('axios');

const SERVER_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';

async function testRedisActivity() {
  console.log('🔍 Testing Redis Activity - Visual Demo\n');

  try {
    // 1. Check initial state
    console.log('1. Checking initial Redis state...');
    const initialStats = await axios.get(`${SERVER_URL}/api/stats`);
    console.log('   Initial Redis metrics:', JSON.stringify(initialStats.data.documents.redisSync, null, 2));

    // 2. Create a test document via API
    console.log('\n2. Creating test document...');
    const testDocId = `visual-test-${Date.now()}`;
    const docResponse = await axios.get(`${SERVER_URL}/api/documents/${testDocId}`);
    console.log(`   Document created: ${testDocId}`);

    // 3. Check Redis state after document creation
    console.log('\n3. Checking Redis state after document creation...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for async operations
    const afterCreateStats = await axios.get(`${SERVER_URL}/api/stats`);
    console.log('   Redis metrics after creation:', JSON.stringify(afterCreateStats.data.documents.redisSync, null, 2));

    // 4. Simulate multiple document operations
    console.log('\n4. Simulating document operations...');
    console.log('   (Check Redis MONITOR output in the other terminal)');
    
    for (let i = 0; i < 5; i++) {
      const docId = `test-doc-${i}-${Date.now()}`;
      await axios.get(`${SERVER_URL}/api/documents/${docId}`);
      console.log(`   ✓ Created document: ${docId}`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 5. Check final Redis state
    console.log('\n5. Final Redis state...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    const finalStats = await axios.get(`${SERVER_URL}/api/stats`);
    console.log('   Final Redis metrics:', JSON.stringify(finalStats.data.documents.redisSync, null, 2));

    // 6. Show Redis keys
    console.log('\n6. Checking Redis keys...');
    console.log('   Run this command to see Redis keys:');
    console.log('   docker exec realtime-yjs-redis-dev redis-cli KEYS "collab:*"');

    console.log('\n🎉 Redis activity test complete!');
    console.log('\n📋 What to observe in Redis MONITOR:');
    console.log('   - SUBSCRIBE commands when documents are created');
    console.log('   - PUBLISH commands when updates are broadcast');
    console.log('   - PING commands for health checks');
    console.log('   - Key operations for session management');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.status, error.response.statusText);
    }
  }
}

// Run the test
if (require.main === module) {
  testRedisActivity().catch(console.error);
}

module.exports = testRedisActivity;
