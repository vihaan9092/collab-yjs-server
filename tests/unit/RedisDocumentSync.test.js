/**
 * RedisDocumentSync Unit Tests
 * Tests for Phase 1: Redis Pub/Sub implementation
 */

const RedisDocumentSync = require('../../src/services/RedisDocumentSync');
const { createMockLogger } = require('../helpers/testUtils');

// Mock ioredis
const mockRedisInstance = {
  on: jest.fn(),
  publish: jest.fn().mockResolvedValue(1),
  subscribe: jest.fn().mockResolvedValue(1),
  unsubscribe: jest.fn().mockResolvedValue(1),
  ping: jest.fn().mockResolvedValue('PONG'),
  quit: jest.fn().mockResolvedValue('OK')
};

jest.mock('ioredis', () => {
  return jest.fn(() => mockRedisInstance);
});

const Redis = require('ioredis');

describe('RedisDocumentSync', () => {
  let redisSync;
  let mockLogger;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = createMockLogger();
    
    redisSync = new RedisDocumentSync(mockLogger, {
      redisUrl: 'redis://localhost:6379',
      keyPrefix: 'test:'
    });
  });

  afterEach(async () => {
    if (redisSync) {
      await redisSync.destroy();
    }
  });

  describe('initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(Redis).toHaveBeenCalledTimes(2); // publisher and subscriber
      expect(redisSync.instanceId).toBeDefined();
      expect(redisSync.keyPrefix).toBe('test:');
    });

    it('should setup event handlers', () => {
      expect(mockRedisInstance.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('message', expect.any(Function));
    });
  });

  describe('broadcastUpdate', () => {
    it('should broadcast document update successfully', async () => {
      const documentId = 'test-doc';
      const update = new Uint8Array([1, 2, 3, 4]);
      const origin = 'test-origin';
      const metadata = { test: 'data' };

      await redisSync.broadcastUpdate(documentId, update, origin, metadata);

      expect(mockRedisInstance.publish).toHaveBeenCalledWith(
        'doc:test-doc:updates',
        expect.stringContaining('"documentId":"test-doc"')
      );

      // Verify message structure
      const publishCall = mockRedisInstance.publish.mock.calls[0];
      const message = JSON.parse(publishCall[1]);
      
      expect(message).toMatchObject({
        documentId,
        update: Array.from(update),
        origin,
        metadata,
        instanceId: redisSync.instanceId
      });
      expect(message.timestamp).toBeDefined();
      expect(message.messageId).toBeDefined();
    });

    it('should handle broadcast errors', async () => {
      const error = new Error('Redis publish failed');
      mockRedisInstance.publish.mockRejectedValueOnce(error);

      const documentId = 'test-doc';
      const update = new Uint8Array([1, 2, 3]);

      await expect(redisSync.broadcastUpdate(documentId, update)).rejects.toThrow('Redis publish failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to broadcast document update',
        error,
        expect.objectContaining({ documentId })
      );
    });
  });

  describe('subscribeToDocument', () => {
    it('should subscribe to document updates', async () => {
      const documentId = 'test-doc';
      const handler = jest.fn();

      await redisSync.subscribeToDocument(documentId, handler);

      expect(mockRedisInstance.subscribe).toHaveBeenCalledWith('doc:test-doc:updates');
      expect(redisSync.subscriptions.has(documentId)).toBe(true);
      expect(redisSync.subscriptions.get(documentId).has(handler)).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Subscribed to document updates',
        expect.objectContaining({ documentId })
      );
    });

    it('should add multiple handlers for same document', async () => {
      const documentId = 'test-doc';
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      await redisSync.subscribeToDocument(documentId, handler1);
      await redisSync.subscribeToDocument(documentId, handler2);

      // Should only subscribe once to Redis
      expect(mockRedisInstance.subscribe).toHaveBeenCalledTimes(1);
      
      // Both handlers should be registered
      const handlers = redisSync.subscriptions.get(documentId);
      expect(handlers.has(handler1)).toBe(true);
      expect(handlers.has(handler2)).toBe(true);
    });
  });

  describe('unsubscribeFromDocument', () => {
    it('should unsubscribe specific handler', async () => {
      const documentId = 'test-doc';
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      await redisSync.subscribeToDocument(documentId, handler1);
      await redisSync.subscribeToDocument(documentId, handler2);
      await redisSync.unsubscribeFromDocument(documentId, handler1);

      const handlers = redisSync.subscriptions.get(documentId);
      expect(handlers.has(handler1)).toBe(false);
      expect(handlers.has(handler2)).toBe(true);
      
      // Should not unsubscribe from Redis yet
      expect(mockRedisInstance.unsubscribe).not.toHaveBeenCalled();
    });

    it('should unsubscribe from Redis when no handlers left', async () => {
      const documentId = 'test-doc';
      const handler = jest.fn();

      await redisSync.subscribeToDocument(documentId, handler);
      await redisSync.unsubscribeFromDocument(documentId, handler);

      expect(mockRedisInstance.unsubscribe).toHaveBeenCalledWith('doc:test-doc:updates');
      expect(redisSync.subscriptions.has(documentId)).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Unsubscribed from document updates',
        expect.objectContaining({ documentId })
      );
    });
  });

  describe('handleIncomingMessage', () => {
    it('should process incoming messages correctly', async () => {
      const documentId = 'test-doc';
      const handler = jest.fn();
      
      await redisSync.subscribeToDocument(documentId, handler);

      const message = {
        documentId,
        update: [1, 2, 3, 4],
        origin: 'remote-origin',
        metadata: { test: 'data' },
        timestamp: Date.now(),
        instanceId: 'different-instance',
        messageId: 'test-message-id'
      };

      redisSync.handleIncomingMessage('doc:test-doc:updates', JSON.stringify(message));

      expect(handler).toHaveBeenCalledWith(
        new Uint8Array([1, 2, 3, 4]),
        'remote-origin',
        { test: 'data' },
        expect.objectContaining({
          timestamp: message.timestamp,
          messageId: 'test-message-id',
          sourceInstance: 'different-instance'
        })
      );
    });

    it('should ignore messages from same instance', async () => {
      const documentId = 'test-doc';
      const handler = jest.fn();
      
      await redisSync.subscribeToDocument(documentId, handler);

      const message = {
        documentId,
        update: [1, 2, 3, 4],
        instanceId: redisSync.instanceId // Same instance
      };

      redisSync.handleIncomingMessage('doc:test-doc:updates', JSON.stringify(message));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when Redis is connected', async () => {
      const health = await redisSync.healthCheck();

      expect(health).toMatchObject({
        status: 'healthy',
        instanceId: redisSync.instanceId,
        redis: {
          publisher: 'connected',
          subscriber: 'connected'
        }
      });
      expect(mockRedisInstance.ping).toHaveBeenCalled();
    });

    it('should return unhealthy status when Redis fails', async () => {
      const error = new Error('Redis connection failed');
      mockRedisInstance.ping.mockRejectedValueOnce(error);

      const health = await redisSync.healthCheck();

      expect(health).toMatchObject({
        status: 'unhealthy',
        instanceId: redisSync.instanceId,
        error: 'Redis connection failed',
        redis: {
          publisher: 'error',
          subscriber: 'error'
        }
      });
    });
  });

  describe('getMetrics', () => {
    it('should return sync metrics', () => {
      const metrics = redisSync.getMetrics();

      expect(metrics).toMatchObject({
        messagesSent: 0,
        messagesReceived: 0,
        documentsTracked: 0,
        activeSubscriptions: 0,
        instanceId: redisSync.instanceId,
        lastActivity: expect.any(Date)
      });
    });
  });

  describe('destroy', () => {
    it('should cleanup resources properly', async () => {
      const documentId = 'test-doc';
      const handler = jest.fn();
      
      await redisSync.subscribeToDocument(documentId, handler);
      await redisSync.destroy();

      expect(mockRedisInstance.unsubscribe).toHaveBeenCalledWith('doc:test-doc:updates');
      expect(mockRedisInstance.quit).toHaveBeenCalled();
      expect(redisSync.subscriptions.size).toBe(0);
      expect(redisSync.documentChannels.size).toBe(0);
    });
  });
});
