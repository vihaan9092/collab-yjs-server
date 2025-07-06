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
  applyUpdateToDoc: jest.fn()
}));

const { getYDoc, docs, applyUpdateToDoc } = require('../../src/utils/y-websocket-utils');

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

    // Reset mocks
    getYDoc.mockResolvedValue(mockDoc);
    docs.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (documentManager.cleanupInterval) {
      clearInterval(documentManager.cleanupInterval);
    }
  });

  describe('getDocument', () => {
    it('should create and return a new document', async () => {
      const documentId = 'test-doc';
      
      const result = await documentManager.getDocument(documentId);
      
      expect(getYDoc).toHaveBeenCalledWith(documentId, true);
      expect(result).toBe(mockDoc);
      expect(mockLogger.info).toHaveBeenCalledWith('Document created', { documentId });
    });

    it('should update last accessed time for existing document', async () => {
      const documentId = 'test-doc';
      
      // First call
      await documentManager.getDocument(documentId);
      const firstStats = documentManager.documentStats.get(documentId);
      const firstAccessTime = firstStats.lastAccessed;
      
      // Wait a bit and call again
      await new Promise(resolve => setTimeout(resolve, 10));
      await documentManager.getDocument(documentId);
      
      const secondStats = documentManager.documentStats.get(documentId);
      expect(secondStats.lastAccessed.getTime()).toBeGreaterThan(firstAccessTime.getTime());
    });

    it('should handle errors gracefully', async () => {
      const documentId = 'error-doc';
      const error = new Error('Test error');
      getYDoc.mockRejectedValueOnce(error);
      
      await expect(documentManager.getDocument(documentId)).rejects.toThrow('Test error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get document', error, { documentId });
    });
  });

  describe('applyUpdate', () => {
    it('should apply update to document successfully', async () => {
      const documentId = 'test-doc';
      const update = new Uint8Array([1, 2, 3]);
      const origin = 'test-origin';
      
      // Setup document first
      await documentManager.getDocument(documentId);
      
      const result = documentManager.applyUpdate(documentId, update, origin);
      
      expect(applyUpdateToDoc).toHaveBeenCalledWith(mockDoc, update, origin);
      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('Update applied to document', {
        documentId,
        updateSize: update.length,
        origin
      });
    });

    it('should update statistics when applying update', async () => {
      const documentId = 'test-doc';
      const update = new Uint8Array([1, 2, 3]);
      
      // Setup document first
      await documentManager.getDocument(documentId);
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
    it('should return document statistics', async () => {
      const documentId = 'test-doc';
      
      // Create document to initialize stats
      await documentManager.getDocument(documentId);
      
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
    it('should update connection count for existing document', async () => {
      const documentId = 'test-doc';
      
      // Create document first
      await documentManager.getDocument(documentId);
      
      documentManager.updateConnectionCount(documentId, 5);
      
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
