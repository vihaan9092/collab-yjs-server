#!/usr/bin/env node

/**
 * Simulate Redis Pub/Sub Activity
 * Directly triggers Redis sync to show visual activity
 */

const Redis = require('ioredis');

async function simulateRedisPubSub() {
  console.log('🎬 Simulating Redis Pub/Sub Activity');
  console.log('👀 Watch your Redis Dashboard for live updates!\n');

  const redis = new Redis('redis://localhost:6379', {
    keyPrefix: 'collab:'
  });

  try {
    // 1. Simulate document creation and subscription
    console.log('1. 📝 Simulating document creation...');
    
    const testDocs = [
      'visual-demo-doc-1',
      'visual-demo-doc-2', 
      'visual-demo-doc-3'
    ];

    for (const docId of testDocs) {
      console.log(`   Creating subscription for: ${docId}`);
      
      // Subscribe to document updates (this will show in Redis)
      const subscriber = redis.duplicate();
      await subscriber.subscribe(`doc:${docId}:updates`);
      
      console.log(`   ✅ Subscribed to doc:${docId}:updates`);
      
      // Simulate document update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log(`   📤 Publishing update for: ${docId}`);
      await redis.publish(`doc:${docId}:updates`, JSON.stringify({
        documentId: docId,
        update: [1, 2, 3, 4, 5],
        timestamp: Date.now(),
        instanceId: 'demo-instance',
        messageId: `msg-${Date.now()}`
      }));
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Cleanup
      await subscriber.unsubscribe(`doc:${docId}:updates`);
      subscriber.disconnect();
      
      console.log(`   🧹 Cleaned up subscription for: ${docId}\n`);
    }

    // 2. Simulate user session activity
    console.log('2. 👤 Simulating user session activity...');
    
    for (let i = 1; i <= 3; i++) {
      const sessionId = `demo-session-${i}`;
      const sessionData = {
        userId: i,
        username: `demo-user-${i}`,
        documentId: `demo-doc-${i}`,
        connectedAt: new Date().toISOString()
      };
      
      console.log(`   💾 Storing session: ${sessionId}`);
      await redis.setex(`session:${sessionId}`, 900, JSON.stringify(sessionData));
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 3. Show current Redis state
    console.log('\n3. 📊 Current Redis state:');
    
    const keys = await redis.keys('*');
    console.log(`   Total keys in Redis: ${keys.length}`);
    
    const collabKeys = await redis.keys('collab:*');
    console.log(`   Collab keys: ${collabKeys.length}`);
    
    if (collabKeys.length > 0) {
      console.log('   Collab keys found:');
      collabKeys.forEach(key => console.log(`     - ${key}`));
    }

    // 4. Simulate real-time activity
    console.log('\n4. 🔄 Simulating real-time activity...');
    console.log('   (Watch your dashboard for 30 seconds)');
    
    const activityInterval = setInterval(async () => {
      const docId = `live-demo-${Date.now()}`;
      
      // Create subscription
      const subscriber = redis.duplicate();
      await subscriber.subscribe(`doc:${docId}:updates`);
      
      // Publish update
      await redis.publish(`doc:${docId}:updates`, JSON.stringify({
        documentId: docId,
        update: [Math.random() * 100],
        timestamp: Date.now(),
        instanceId: 'live-demo',
        messageId: `live-${Date.now()}`
      }));
      
      // Cleanup after short delay
      setTimeout(async () => {
        await subscriber.unsubscribe(`doc:${docId}:updates`);
        subscriber.disconnect();
      }, 1000);
      
      console.log(`   ⚡ Activity burst: ${docId}`);
      
    }, 3000);

    // Stop after 30 seconds
    setTimeout(() => {
      clearInterval(activityInterval);
      console.log('\n🎉 Simulation complete!');
      console.log('💡 Check your Redis Dashboard and MONITOR terminal!');
      redis.disconnect();
      process.exit(0);
    }, 30000);

    console.log('   Running for 30 seconds... (Ctrl+C to stop early)');

  } catch (error) {
    console.error('❌ Simulation failed:', error.message);
    redis.disconnect();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Simulation stopped by user');
  process.exit(0);
});

// Run simulation
if (require.main === module) {
  simulateRedisPubSub().catch(console.error);
}

module.exports = simulateRedisPubSub;
