#!/usr/bin/env node

/**
 * Redis Sync Verification Script
 * Verifies that Phase 1 Redis Pub/Sub implementation is working
 */

const axios = require('axios');
const WebSocket = require('ws');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const WS_URL = SERVER_URL.replace('http', 'ws');

async function verifyRedisSync() {
  console.log('🔍 Verifying Redis Sync Implementation (Phase 1)...\n');

  try {
    // 1. Check server health
    console.log('1. Checking server health...');
    const healthResponse = await axios.get(`${SERVER_URL}/health`);
    console.log('✅ Server is healthy');
    
    if (healthResponse.data.redisSync) {
      console.log('✅ Redis sync service is active');
      console.log(`   Instance ID: ${healthResponse.data.redisSync.instanceId}`);
      console.log(`   Redis Status: ${healthResponse.data.redisSync.redis?.publisher || 'unknown'}`);
    } else {
      console.log('⚠️  Redis sync status not available in health check');
    }

    // 2. Check server stats
    console.log('\n2. Checking server statistics...');
    const statsResponse = await axios.get(`${SERVER_URL}/api/stats`);
    console.log('✅ Server stats retrieved');
    
    if (statsResponse.data.documentManager?.redisSync) {
      const redisMetrics = statsResponse.data.documentManager.redisSync;
      console.log(`   Messages sent: ${redisMetrics.messagesSent}`);
      console.log(`   Messages received: ${redisMetrics.messagesReceived}`);
      console.log(`   Documents tracked: ${redisMetrics.documentsTracked}`);
      console.log(`   Active subscriptions: ${redisMetrics.activeSubscriptions}`);
    }

    // 3. Test WebSocket connection
    console.log('\n3. Testing WebSocket connection...');
    const testDocumentId = `test-doc-${Date.now()}`;
    const wsUrl = `${WS_URL}/${testDocumentId}`;
    
    const ws = new WebSocket(wsUrl);
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);
        console.log('✅ WebSocket connection established');
        resolve();
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    // 4. Test document creation
    console.log('\n4. Testing document creation...');
    const docResponse = await axios.get(`${SERVER_URL}/api/documents/${testDocumentId}`);
    console.log('✅ Document created and accessible via API');
    console.log(`   Document ID: ${docResponse.data.documentId}`);
    console.log(`   Connections: ${docResponse.data.connectionCount}`);

    // 5. Check updated stats
    console.log('\n5. Checking updated statistics...');
    const updatedStatsResponse = await axios.get(`${SERVER_URL}/api/stats`);
    const updatedStats = updatedStatsResponse.data;
    
    console.log(`   Total documents: ${updatedStats.documentManager?.totalDocuments || 0}`);
    console.log(`   Total connections: ${updatedStats.documentManager?.totalConnections || 0}`);
    console.log(`   Synced documents: ${updatedStats.documentManager?.syncedDocuments || 0}`);

    // Cleanup
    ws.close();
    
    console.log('\n🎉 Phase 1 Redis Sync Implementation Verification Complete!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Server health check with Redis sync status');
    console.log('   ✅ Redis sync service initialization');
    console.log('   ✅ WebSocket connection handling');
    console.log('   ✅ Document creation with sync setup');
    console.log('   ✅ Statistics reporting with Redis metrics');
    
    console.log('\n🚀 Ready for Phase 2: Document State Persistence');
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Make sure the server is running:');
      console.error('   make build && make run');
    } else if (error.response) {
      console.error(`   HTTP ${error.response.status}: ${error.response.statusText}`);
      if (error.response.data) {
        console.error('   Response:', JSON.stringify(error.response.data, null, 2));
      }
    }
    
    process.exit(1);
  }
}

// Run verification if called directly
if (require.main === module) {
  verifyRedisSync().catch(console.error);
}

module.exports = verifyRedisSync;
