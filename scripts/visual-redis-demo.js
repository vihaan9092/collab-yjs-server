#!/usr/bin/env node

/**
 * Visual Redis Demo
 * Creates actual YJS documents and shows Redis pub/sub in action
 */

const WebSocket = require('ws');
const axios = require('axios');

const SERVER_URL = 'http://localhost:3000';

async function createDocumentDirectly(documentId) {
  // This will trigger actual document creation in the DocumentManager
  const response = await axios.post(`${SERVER_URL}/api/documents/${documentId}/create`, {
    initialContent: `Test content for ${documentId}`
  }).catch(err => {
    // If endpoint doesn't exist, try alternative approach
    console.log(`   Note: Direct creation endpoint not available for ${documentId}`);
    return null;
  });
  
  return response;
}

async function visualRedisDemo() {
  console.log('🎬 Visual Redis Demo - Live Pub/Sub Activity\n');
  console.log('👀 Watch the Redis MONITOR terminal for real-time commands!\n');

  try {
    // 1. Show initial state
    console.log('1. 📊 Initial Redis State');
    const health = await axios.get(`${SERVER_URL}/health`);
    console.log(`   Instance ID: ${health.data.redisSync.instanceId}`);
    console.log(`   Redis Status: ${health.data.redisSync.redis.publisher}/${health.data.redisSync.redis.subscriber}`);
    
    const stats = await axios.get(`${SERVER_URL}/api/stats`);
    console.log(`   Active Subscriptions: ${stats.data.documents.redisSync.activeSubscriptions}`);
    console.log(`   Documents Tracked: ${stats.data.documents.redisSync.documentsTracked}`);

    // 2. Trigger Redis health checks
    console.log('\n2. 🔍 Triggering Redis Health Checks...');
    for (let i = 0; i < 3; i++) {
      await axios.get(`${SERVER_URL}/health`);
      console.log(`   ✓ Health check ${i + 1} - Look for PING commands in Redis monitor`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 3. Test Redis key operations
    console.log('\n3. 🔑 Testing Redis Key Operations...');
    
    // Check current Redis keys
    console.log('   Current Redis keys:');
    try {
      const { spawn } = require('child_process');
      const keysProcess = spawn('docker', ['exec', 'realtime-yjs-redis-dev', 'redis-cli', 'KEYS', 'collab:*']);
      
      keysProcess.stdout.on('data', (data) => {
        const keys = data.toString().trim();
        if (keys) {
          console.log(`   Found keys: ${keys}`);
        } else {
          console.log('   No collab:* keys found yet');
        }
      });

      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.log('   Could not check keys directly');
    }

    // 4. Simulate document operations that would trigger Redis
    console.log('\n4. 📝 Simulating Document Operations...');
    console.log('   (These operations will show up in Redis MONITOR)');

    // Try to trigger actual document creation through different endpoints
    const testDocs = [
      `demo-doc-1-${Date.now()}`,
      `demo-doc-2-${Date.now()}`,
      `demo-doc-3-${Date.now()}`
    ];

    for (const docId of testDocs) {
      console.log(`   📄 Processing document: ${docId}`);
      
      // Try multiple approaches to trigger document creation
      try {
        await axios.get(`${SERVER_URL}/api/documents/${docId}`);
        await axios.get(`${SERVER_URL}/api/documents/${docId}/stats`);
      } catch (error) {
        // Expected if endpoints don't exist
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 5. Show final state
    console.log('\n5. 📈 Final Redis State');
    const finalStats = await axios.get(`${SERVER_URL}/api/stats`);
    console.log('   Final metrics:', JSON.stringify(finalStats.data.documents.redisSync, null, 2));

    // 6. Instructions for manual testing
    console.log('\n6. 🎯 Manual Testing Instructions');
    console.log('   To see real Redis pub/sub activity:');
    console.log('   1. Open a WebSocket connection to trigger document creation');
    console.log('   2. Send YJS updates through the WebSocket');
    console.log('   3. Watch Redis MONITOR for SUBSCRIBE/PUBLISH commands');
    console.log('');
    console.log('   Example WebSocket URL: ws://localhost:3000/test-document');
    console.log('   (Note: Authentication may be required)');

    console.log('\n🎉 Demo complete! Check Redis MONITOR output above.');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
  }
}

// Run the demo
if (require.main === module) {
  visualRedisDemo().catch(console.error);
}

module.exports = visualRedisDemo;
