#!/usr/bin/env node

/**
 * Simulate Second Server Instance
 * This simulates another server instance publishing to Redis
 * to demonstrate "Messages Received" functionality
 */

const Redis = require('ioredis');
const axios = require('axios');

async function simulateSecondInstance() {
  console.log('🚀 Simulating Second Server Instance');
  console.log('📡 This will publish messages that the main server will receive\n');

  const redis = new Redis('redis://localhost:6379', {
    keyPrefix: 'collab:'
  });

  try {
    // 1. Check initial stats
    console.log('1. 📊 Initial server stats:');
    const initialStats = await axios.get('http://localhost:3000/api/stats');
    const initialRedis = initialStats.data.documents.redisSync;
    console.log(`   Messages Sent: ${initialRedis.messagesSent}`);
    console.log(`   Messages Received: ${initialRedis.messagesReceived}`);
    console.log(`   Instance ID: ${initialRedis.instanceId}`);

    // 2. Simulate messages from a "second instance"
    console.log('\n2. 🎭 Simulating messages from "Second Instance"...');
    
    const fakeInstanceId = 'fake-instance-' + Date.now();
    console.log(`   Fake Instance ID: ${fakeInstanceId}`);

    // Publish several messages as if from another server instance
    for (let i = 1; i <= 5; i++) {
      const message = {
        documentId: 'tiptap-demo',
        update: [1, 2, 3, 4, 5, i], // Fake YJS update
        origin: 'simulated-websocket',
        metadata: {
          timestamp: Date.now(),
          size: 20
        },
        timestamp: Date.now(),
        instanceId: fakeInstanceId, // Different instance ID
        messageId: `sim-${Date.now()}-${i}`
      };

      console.log(`   📤 Publishing message ${i}/5...`);
      await redis.publish('doc:tiptap-demo:updates', JSON.stringify(message));
      
      // Wait a bit between messages
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 3. Wait for the main server to process messages
    console.log('\n3. ⏳ Waiting for main server to process messages...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. Check final stats
    console.log('\n4. 📈 Final server stats:');
    const finalStats = await axios.get('http://localhost:3000/api/stats');
    const finalRedis = finalStats.data.documents.redisSync;
    console.log(`   Messages Sent: ${finalRedis.messagesSent}`);
    console.log(`   Messages Received: ${finalRedis.messagesReceived}`);
    console.log(`   Instance ID: ${finalRedis.instanceId}`);

    // 5. Show the difference
    console.log('\n5. 📊 Changes:');
    console.log(`   Messages Sent: ${initialRedis.messagesSent} → ${finalRedis.messagesSent}`);
    console.log(`   Messages Received: ${initialRedis.messagesReceived} → ${finalRedis.messagesReceived} (+${finalRedis.messagesReceived - initialRedis.messagesReceived})`);

    if (finalRedis.messagesReceived > initialRedis.messagesReceived) {
      console.log('\n🎉 SUCCESS! The main server received messages from our simulated instance!');
      console.log('💡 This is how "Messages Received" works in a multi-instance setup.');
    } else {
      console.log('\n⚠️  No messages received. This might be because:');
      console.log('   - The main server filters out messages from unknown instances');
      console.log('   - The Redis sync has additional validation');
      console.log('   - The message format needs to match exactly');
    }

    // 6. Explanation
    console.log('\n6. 📚 How Multi-Instance Redis Sync Works:');
    console.log('   ┌─ Instance A ─┐    ┌─ Redis ─┐    ┌─ Instance B ─┐');
    console.log('   │ User types   │───▶│ Pub/Sub │───▶│ Receives msg │');
    console.log('   │ Sends: +1    │    │ Channel │    │ Received: +1 │');
    console.log('   └──────────────┘    └─────────┘    └──────────────┘');
    console.log('');
    console.log('   In production with multiple instances:');
    console.log('   - Instance A: Messages Sent > 0, Messages Received > 0');
    console.log('   - Instance B: Messages Sent > 0, Messages Received > 0');
    console.log('   - Each instance receives updates from OTHER instances');

    redis.disconnect();

  } catch (error) {
    console.error('❌ Simulation failed:', error.message);
    redis.disconnect();
  }
}

// Run the simulation
if (require.main === module) {
  simulateSecondInstance().catch(console.error);
}

module.exports = simulateSecondInstance;
