/**
 * ConnectionManager Unit Tests
 * Tests for the improved ConnectionManager with memory leak fixes
 */

const ConnectionManager = require('../../src/managers/ConnectionManager');
const { createMockLogger } = require('../helpers/testUtils');

// Mock WebSocket
class MockWebSocket {
  constructor() {
    this.readyState = 1; // OPEN
    this.close = jest.fn();
    this.send = jest.fn();
  }
}

describe('ConnectionManager', () => {
  let connectionManager;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    connectionManager = new ConnectionManager(mockLogger);
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    connectionManager.destroy();
    jest.useRealTimers();
  });

  describe('addConnection', () => {
    test('should add connection with reverse lookup', () => {
      const connectionId = 'test-conn-1';
      const ws = new MockWebSocket();
      const metadata = { documentId: 'doc1', userId: 'user1' };

      connectionManager.addConnection(connectionId, ws, metadata);

      // Check connection is stored
      const connection = connectionManager.getConnection(connectionId);
      expect(connection).toBeDefined();
      expect(connection.id).toBe(connectionId);
      expect(connection.ws).toBe(ws);
      expect(connection.documentId).toBe('doc1');
      expect(connection.userId).toBe('user1');
      expect(connection.isActive).toBe(true);

      // Check reverse lookup works
      expect(connectionManager.findConnectionIdByWs(ws)).toBe(connectionId);

      // Check document connections tracking (using internal documentConnections map)
      const docConnectionIds = connectionManager.documentConnections.get('doc1');
      expect(docConnectionIds).toBeDefined();
      expect(docConnectionIds.size).toBe(1);
      expect(docConnectionIds.has(connectionId)).toBe(true);
    });

    test('should set up connection timeout', () => {
      const connectionId = 'test-conn-timeout';
      const ws = new MockWebSocket();

      connectionManager.addConnection(connectionId, ws, {});

      // Check timeout is set
      expect(connectionManager.connectionTimeouts.has(connectionId)).toBe(true);
    });
  });

  describe('removeConnection', () => {
    test('should remove connection and clean up all references', () => {
      const connectionId = 'test-conn-remove';
      const ws = new MockWebSocket();
      const metadata = { documentId: 'doc1', userId: 'user1' };

      // Add connection
      connectionManager.addConnection(connectionId, ws, metadata);
      expect(connectionManager.getConnection(connectionId)).toBeDefined();
      expect(connectionManager.findConnectionIdByWs(ws)).toBe(connectionId);

      // Remove connection
      const result = connectionManager.removeConnection(connectionId);
      expect(result).toBe(true);

      // Check all references are cleaned up
      expect(connectionManager.getConnection(connectionId)).toBeNull();
      expect(connectionManager.findConnectionIdByWs(ws)).toBeNull();
      expect(connectionManager.connectionTimeouts.has(connectionId)).toBe(false);
    });

    test('should handle removing non-existent connection', () => {
      const result = connectionManager.removeConnection('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('findConnectionIdByWs - Performance Improvement', () => {
    test('should use O(1) lookup instead of O(n)', () => {
      const connections = [];
      const webSockets = [];

      // Add many connections
      for (let i = 0; i < 1000; i++) {
        const connectionId = `conn-${i}`;
        const ws = new MockWebSocket();
        connectionManager.addConnection(connectionId, ws, {});
        connections.push(connectionId);
        webSockets.push(ws);
      }

      // Test lookup performance - should be instant with O(1)
      const startTime = process.hrtime.bigint();
      const foundId = connectionManager.findConnectionIdByWs(webSockets[999]);
      const endTime = process.hrtime.bigint();

      expect(foundId).toBe('conn-999');
      
      // Should be very fast (less than 1ms even with 1000 connections)
      const durationMs = Number(endTime - startTime) / 1000000;
      expect(durationMs).toBeLessThan(1);
    });
  });

  describe('connection timeout handling', () => {
    test('should timeout inactive connections', () => {
      const connectionId = 'test-timeout';
      const ws = new MockWebSocket();

      connectionManager.addConnection(connectionId, ws, {});
      expect(connectionManager.getConnection(connectionId)).toBeDefined();

      // Fast-forward 30 minutes
      jest.advanceTimersByTime(30 * 60 * 1000);

      // Connection should be removed
      expect(connectionManager.getConnection(connectionId)).toBeNull();
      expect(ws.close).toHaveBeenCalledWith(1000, 'Connection timeout');
    });

    test('should reset timeout on activity', () => {
      const connectionId = 'test-activity';
      const ws = new MockWebSocket();

      connectionManager.addConnection(connectionId, ws, {});

      // Simulate activity after 20 minutes
      jest.advanceTimersByTime(20 * 60 * 1000);
      connectionManager.updateLastActivity(connectionId);

      // Fast-forward another 20 minutes (40 minutes total, but only 20 since last activity)
      jest.advanceTimersByTime(20 * 60 * 1000);

      // Connection should still exist
      expect(connectionManager.getConnection(connectionId)).toBeDefined();
      expect(ws.close).not.toHaveBeenCalled();

      // Fast-forward another 15 minutes (35 minutes since last activity)
      jest.advanceTimersByTime(15 * 60 * 1000);

      // Now connection should be removed
      expect(connectionManager.getConnection(connectionId)).toBeNull();
    });
  });

  describe('cleanupStaleConnections', () => {
    test('should clean up closed WebSocket connections', () => {
      const connectionId = 'test-stale';
      const ws = new MockWebSocket();

      connectionManager.addConnection(connectionId, ws, {});
      
      // Simulate WebSocket being closed
      ws.readyState = 3; // CLOSED

      // Run cleanup
      connectionManager.cleanupStaleConnections();

      // Connection should be removed
      expect(connectionManager.getConnection(connectionId)).toBeNull();
    });

    test('should clean up very old inactive connections', () => {
      const connectionId = 'test-old';
      const ws = new MockWebSocket();

      connectionManager.addConnection(connectionId, ws, {});
      
      // Manually set old last activity time
      const connection = connectionManager.getConnection(connectionId);
      connection.lastActivity = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago

      // Run cleanup
      connectionManager.cleanupStaleConnections();

      // Connection should be removed
      expect(connectionManager.getConnection(connectionId)).toBeNull();
    });
  });

  describe('destroy', () => {
    test('should clean up all resources', () => {
      const connectionId1 = 'test-destroy-1';
      const connectionId2 = 'test-destroy-2';
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      connectionManager.addConnection(connectionId1, ws1, {});
      connectionManager.addConnection(connectionId2, ws2, {});

      expect(connectionManager.getConnectionCount()).toBe(2);

      connectionManager.destroy();

      // All connections should be closed
      expect(ws1.close).toHaveBeenCalledWith(1000, 'Server shutdown');
      expect(ws2.close).toHaveBeenCalledWith(1000, 'Server shutdown');

      // All maps should be cleared
      expect(connectionManager.connections.size).toBe(0);
      expect(connectionManager.wsToConnectionId.size).toBe(0);
      expect(connectionManager.connectionTimeouts.size).toBe(0);
    });
  });
});
