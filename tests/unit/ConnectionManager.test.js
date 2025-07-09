/**
 * ConnectionManager Unit Tests
 * Tests for the simplified ConnectionManager
 */

const ConnectionManager = require('../../src/managers/ConnectionManager');
const { createMockLogger } = require('../helpers/testUtils');

// Mock y-websocket-utils docs
jest.mock('../../src/utils/y-websocket-utils', () => ({
  docs: new Map()
}));

const { docs } = require('../../src/utils/y-websocket-utils');

describe('ConnectionManager', () => {
  let connectionManager;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    connectionManager = new ConnectionManager(mockLogger);
    docs.clear();
  });

  afterEach(() => {
    connectionManager.destroy();
    docs.clear();
  });

  describe('getConnectionsByDocument', () => {
    test('should return connections from y-websocket docs', () => {
      // Mock a document with connections
      const mockDoc = {
        conns: new Map()
      };
      const mockWs1 = { id: 'ws1' };
      const mockWs2 = { id: 'ws2' };

      mockDoc.conns.set(mockWs1, new Set());
      mockDoc.conns.set(mockWs2, new Set());
      docs.set('doc1', mockDoc);

      const connections = connectionManager.getConnectionsByDocument('doc1');

      expect(connections).toHaveLength(2);
      expect(connections[0].documentId).toBe('doc1');
      expect(connections[1].documentId).toBe('doc1');
    });

    test('should return empty array for non-existent document', () => {
      const connections = connectionManager.getConnectionsByDocument('non-existent');
      expect(connections).toEqual([]);
    });
  });

  describe('getConnectionCount', () => {
    test('should return total connections across all documents', () => {
      expect(connectionManager.getConnectionCount()).toBe(0);

      // Mock documents with connections
      const mockDoc1 = { conns: new Map() };
      const mockDoc2 = { conns: new Map() };

      mockDoc1.conns.set({ id: 'ws1' }, new Set());
      mockDoc1.conns.set({ id: 'ws2' }, new Set());
      mockDoc2.conns.set({ id: 'ws3' }, new Set());

      docs.set('doc1', mockDoc1);
      docs.set('doc2', mockDoc2);

      expect(connectionManager.getConnectionCount()).toBe(3);
    });
  });

  describe('getConnectionStats', () => {
    test('should return correct statistics', () => {
      // Mock documents with connections
      const mockDoc1 = { conns: new Map() };
      const mockDoc2 = { conns: new Map() };

      mockDoc1.conns.set({ id: 'ws1' }, new Set());
      mockDoc1.conns.set({ id: 'ws2' }, new Set());
      mockDoc2.conns.set({ id: 'ws3' }, new Set());

      docs.set('doc1', mockDoc1);
      docs.set('doc2', mockDoc2);

      const stats = connectionManager.getConnectionStats();

      expect(stats.totalConnections).toBe(3);
      expect(stats.documentsWithConnections).toBe(2);
      expect(stats.connectionsByDocument).toEqual({
        'doc1': 2,
        'doc2': 1
      });
    });

    test('should return empty stats when no documents', () => {
      const stats = connectionManager.getConnectionStats();

      expect(stats.totalConnections).toBe(0);
      expect(stats.documentsWithConnections).toBe(0);
      expect(stats.connectionsByDocument).toEqual({});
    });
  });

  describe('destroy', () => {
    test('should log destruction', () => {
      connectionManager.destroy();
      expect(mockLogger.info).toHaveBeenCalledWith('ConnectionManager destroyed');
    });
  });
});
