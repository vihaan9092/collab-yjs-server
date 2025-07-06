/**
 * DocumentManager Unit Tests
 * Tests for the DocumentManager class to ensure no regressions
 */

const DocumentManager = require('../../src/managers/DocumentManager');
const { createMockLogger } = require('../helpers/testUtils');

// Mock the y-websocket-utils module
jest.mock('../../src/utils/y-websocket-utils', () => ({
  getYDoc: jest.fn(),
  docs: new Map(),
  applyUpdateToDoc: jest.fn(),
  getDocumentStateSize: jest.fn()
}));

const { getYDoc, docs, applyUpdateToDoc, getDocumentStateSize } = require('../../src/utils/y-websocket-utils');

describe('DocumentManager', () => {
  let documentManager;
  let mockLogger;
  let mockDoc;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockDoc = {
      on: jest.fn(),
      destroy: jest.fn(),
      awareness: {
        getStates: jest.fn().mockReturnValue(new Map())
      },
      conns: new Map()
    };

    documentManager = new DocumentManager(mockLogger, {
      gcEnabled: true,
      cleanupInterval: null // Disable cleanup for tests
    });

    // Reset mocks - getYDoc is synchronous, not async
    getYDoc.mockReturnValue(mockDoc);
    getDocumentStateSize.mockReturnValue(1024); // Mock document size
    docs.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (documentManager.cleanupInterval) {
      clearInterval(documentManager.cleanupInterval);
    }
  });

  describe('getDocument', () => {
    it('should create and return a new document', () => {
      const documentId = 'test-doc';

      const result = documentManager.getDocument(documentId);

      expect(getYDoc).toHaveBeenCalledWith(documentId, true);
      expect(result).toBe(mockDoc);
      expect(mockLogger.info).toHaveBeenCalledWith('Document created', { documentId });
    });

    it('should update last accessed time for existing document', (done) => {
      const documentId = 'test-doc';

      // First call
      documentManager.getDocument(documentId);
      const firstStats = documentManager.documentStats.get(documentId);
      const firstAccessTime = firstStats.lastAccessed;

      // Wait a bit and call again
      setTimeout(() => {
        documentManager.getDocument(documentId);

        const secondStats = documentManager.documentStats.get(documentId);
        expect(secondStats.lastAccessed.getTime()).toBeGreaterThan(firstAccessTime.getTime());
        done();
      }, 10);
    });

    it('should handle errors gracefully', () => {
      const documentId = 'error-doc';
      const error = new Error('Test error');
      getYDoc.mockImplementationOnce(() => {
        throw error;
      });

      expect(() => documentManager.getDocument(documentId)).toThrow('Test error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get document', error, { documentId });
    });
  });

  describe('applyUpdate', () => {
    it('should apply update to document successfully', () => {
      const documentId = 'test-doc';
      const update = new Uint8Array([1, 2, 3]);
      const origin = 'test-origin';

      // Setup document first
      documentManager.getDocument(documentId);

      const result = documentManager.applyUpdate(documentId, update, origin);

      expect(applyUpdateToDoc).toHaveBeenCalledWith(mockDoc, update, origin);
      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('Update applied to document', {
        documentId,
        updateSize: update.length,
        origin
      });
    });

    it('should update statistics when applying update', () => {
      const documentId = 'test-doc';
      const update = new Uint8Array([1, 2, 3]);

      // Setup document first
      documentManager.getDocument(documentId);
      const initialStats = documentManager.documentStats.get(documentId);
      const initialUpdateCount = initialStats.updateCount;

      documentManager.applyUpdate(documentId, update);

      const updatedStats = documentManager.documentStats.get(documentId);
      expect(updatedStats.updateCount).toBe(initialUpdateCount + 1);
    });

    it('should handle errors when applying update', () => {
      const documentId = 'test-doc';
      const update = new Uint8Array([1, 2, 3]);
      const error = new Error('Apply update error');

      applyUpdateToDoc.mockImplementationOnce(() => {
        throw error;
      });

      expect(() => documentManager.applyUpdate(documentId, update)).toThrow('Apply update error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to apply update to document', error, {
        documentId,
        updateSize: update.length
      });
    });
  });

  describe('getDocumentStats', () => {
    it('should return document statistics', () => {
      const documentId = 'test-doc';

      // Mock the docs.get to return our mock document
      docs.set(documentId, mockDoc);

      // Create document to initialize stats
      documentManager.getDocument(documentId);

      const stats = documentManager.getDocumentStats(documentId);

      expect(stats).toMatchObject({
        createdAt: expect.any(Date),
        lastAccessed: expect.any(Date),
        updateCount: 0,
        connectionCount: 0
      });
    });

    it('should return null for non-existent document', () => {
      const stats = documentManager.getDocumentStats('non-existent');
      expect(stats).toBeNull();
    });
  });

  describe('updateConnectionCount', () => {
    it('should update connection count for existing document', () => {
      const documentId = 'test-doc';

      // Mock the docs.get to return our mock document
      docs.set(documentId, mockDoc);

      // Create document first
      documentManager.getDocument(documentId);

      // Mock the document's connection count by adding connections to the conns Map
      mockDoc.conns.set('conn1', new Set());
      mockDoc.conns.set('conn2', new Set());
      mockDoc.conns.set('conn3', new Set());
      mockDoc.conns.set('conn4', new Set());
      mockDoc.conns.set('conn5', new Set());

      const stats = documentManager.getDocumentStats(documentId);
      expect(stats.connectionCount).toBe(5);
    });

    it('should handle non-existent document gracefully', () => {
      expect(() => {
        documentManager.updateConnectionCount('non-existent', 5);
      }).not.toThrow();
    });
  });
});
