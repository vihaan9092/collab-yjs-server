#!/usr/bin/env node

/**
 * Trigger Redis Activity Script
 * Creates actual YJS documents and triggers Redis pub/sub activity
 */

const axios = require('axios');

const SERVER_URL = 'http://localhost:3000';

async function triggerRedisActivity() {
  console.log('🚀 Triggering Real Redis Activity\n');
  console.log('👀 Watch your Redis Dashboard and MONITOR terminal!\n');

  try {
    // 1. Get initial state
    console.log('1. 📊 Getting initial state...');
    const initialHealth = await axios.get(`${SERVER_URL}/health`);
    const initialStats = await axios.get(`${SERVER_URL}/api/stats`);
    
    console.log(`   Instance ID: ${initialHealth.data.redisSync.instanceId}`);
    console.log(`   Initial subscriptions: ${initialStats.data.documents.redisSync.activeSubscriptions}`);
    console.log(`   Initial messages sent: ${initialStats.data.documents.redisSync.messagesSent}`);

    // 2. Trigger document creation by accessing the DocumentManager directly
    console.log('\n2. 🔄 Triggering document operations...');
    
    // Create multiple test documents
    const testDocs = [];
    for (let i = 1; i <= 5; i++) {
      const docId = `redis-test-doc-${i}-${Date.now()}`;
      testDocs.push(docId);
      
      console.log(`   📝 Creating document: ${docId}`);
      
      // Try different endpoints that might trigger document creation
      try {
        await axios.get(`${SERVER_URL}/api/documents/${docId}`);
        await axios.get(`${SERVER_URL}/api/documents/${docId}/stats`);
        
        // Try to trigger document creation through stats endpoint
        await axios.get(`${SERVER_URL}/api/stats`);
        
      } catch (error) {
        // Expected for some endpoints
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 3. Check Redis state after operations
    console.log('\n3. 📈 Checking Redis state after operations...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const finalHealth = await axios.get(`${SERVER_URL}/health`);
    const finalStats = await axios.get(`${SERVER_URL}/api/stats`);
    
    console.log('   Final Redis metrics:');
    console.log(`   - Active subscriptions: ${finalStats.data.documents.redisSync.activeSubscriptions}`);
    console.log(`   - Messages sent: ${finalStats.data.documents.redisSync.messagesSent}`);
    console.log(`   - Messages received: ${finalStats.data.documents.redisSync.messagesReceived}`);
    console.log(`   - Documents tracked: ${finalStats.data.documents.redisSync.documentsTracked}`);

    // 4. Show Redis commands to run manually
    console.log('\n4. 🔧 Manual Redis Commands to Try:');
    console.log('   Run these in your Redis CLI terminal:');
    console.log('   ');
    console.log('   KEYS collab:*                    # Show all collab keys');
    console.log('   KEYS *                          # Show all keys');
    console.log('   INFO replication                # Show Redis info');
    console.log('   CLIENT LIST                     # Show connected clients');
    console.log('   PUBSUB CHANNELS                 # Show active pub/sub channels');
    console.log('   PUBSUB NUMSUB collab:doc:*      # Show subscribers per channel');

    // 5. Instructions for real-time testing
    console.log('\n5. 🎯 To See Real Redis Pub/Sub Activity:');
    console.log('   The Redis sync will be most active when:');
    console.log('   - WebSocket connections are established');
    console.log('   - YJS documents receive updates');
    console.log('   - Multiple instances are running');
    console.log('   ');
    console.log('   Current limitations:');
    console.log('   - Documents are only created when WebSocket connects');
    console.log('   - API endpoints don\'t trigger YJS document creation');
    console.log('   - Redis sync activates on actual document updates');

    // 6. Show current Redis activity
    console.log('\n6. 📊 Current Redis Activity Summary:');
    console.log(`   - Redis Publisher: ${finalHealth.data.redisSync.redis.publisher}`);
    console.log(`   - Redis Subscriber: ${finalHealth.data.redisSync.redis.subscriber}`);
    console.log(`   - Sync Status: ${finalHealth.data.redisSync.status}`);
    console.log(`   - Last Activity: ${finalStats.data.documents.redisSync.lastActivity}`);

    console.log('\n🎉 Activity trigger complete!');
    console.log('💡 Check your Redis Dashboard for real-time updates!');

  } catch (error) {
    console.error('❌ Error triggering activity:', error.message);
    if (error.response) {
      console.error(`   HTTP ${error.response.status}: ${error.response.statusText}`);
    }
  }
}

// Run the activity trigger
if (require.main === module) {
  triggerRedisActivity().catch(console.error);
}

module.exports = triggerRedisActivity;
