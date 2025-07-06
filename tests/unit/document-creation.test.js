/**
 * Document Creation Logic Tests
 * Tests the core logic of document creation without ES module complications
 */

describe('Document Creation Logic', () => {
  let docs, documentLocks;

  beforeEach(() => {
    // Create fresh maps for each test
    docs = new Map();
    documentLocks = new Map();
  });

  // Simulate the core logic of getYDoc without ES modules
  const simulateGetYDoc = async (docname) => {
    // Check if document already exists
    let doc = docs.get(docname);
    if (doc) {
      return doc;
    }

    // Check if another thread is already creating this document
    let lockPromise = documentLocks.get(docname);
    if (lockPromise) {
      // Wait for the other thread to finish creating the document
      await lockPromise;
      // Document should now exist, return it
      doc = docs.get(docname);
      if (doc) {
        return doc;
      }
    }

    // Create a promise for this document creation to prevent race conditions
    const createDocumentPromise = (async () => {
      try {
        // Double-check that document wasn't created while we were waiting
        let existingDoc = docs.get(docname);
        if (existingDoc) {
          return existingDoc;
        }

        // Simulate document creation delay
        await new Promise(resolve => setTimeout(resolve, 10));

        // Create new document (simplified)
        const newDoc = { name: docname, id: Math.random() };
        
        // Store the document
        docs.set(docname, newDoc);
        
        return newDoc;
      } finally {
        // Always clean up the lock
        documentLocks.delete(docname);
      }
    })();

    // Store the creation promise to prevent other threads from creating the same document
    documentLocks.set(docname, createDocumentPromise);

    // Wait for document creation to complete
    return await createDocumentPromise;
  };

  test('should handle concurrent document creation without race conditions', async () => {
    const docName = 'test-concurrent-doc';
    const numConcurrentRequests = 10;

    // Create multiple concurrent requests for the same document
    const promises = Array.from({ length: numConcurrentRequests }, () => 
      simulateGetYDoc(docName)
    );

    // Wait for all requests to complete
    const results = await Promise.all(promises);

    // All requests should return the same document instance
    const firstDoc = results[0];
    results.forEach((doc, index) => {
      expect(doc).toBe(firstDoc);
      expect(doc.name).toBe(docName);
    });

    // Only one document should exist in the global storage
    expect(docs.size).toBe(1);
    expect(docs.get(docName)).toBe(firstDoc);
    
    // No locks should remain
    expect(documentLocks.size).toBe(0);
  });

  test('should handle sequential document creation correctly', async () => {
    const docName1 = 'test-doc-1';
    const docName2 = 'test-doc-2';

    const doc1 = await simulateGetYDoc(docName1);
    const doc2 = await simulateGetYDoc(docName2);

    expect(doc1).not.toBe(doc2);
    expect(doc1.name).toBe(docName1);
    expect(doc2.name).toBe(docName2);
    expect(docs.size).toBe(2);
    expect(documentLocks.size).toBe(0);
  });

  test('should return existing document when requested again', async () => {
    const docName = 'test-existing-doc';

    const doc1 = await simulateGetYDoc(docName);
    const doc2 = await simulateGetYDoc(docName);

    expect(doc1).toBe(doc2);
    expect(docs.size).toBe(1);
    expect(documentLocks.size).toBe(0);
  });

  test('should handle mixed concurrent and sequential requests', async () => {
    const docName = 'test-mixed-doc';

    // First batch of concurrent requests
    const batch1 = await Promise.all([
      simulateGetYDoc(docName),
      simulateGetYDoc(docName),
      simulateGetYDoc(docName)
    ]);

    // Sequential request
    const sequentialDoc = await simulateGetYDoc(docName);

    // Second batch of concurrent requests
    const batch2 = await Promise.all([
      simulateGetYDoc(docName),
      simulateGetYDoc(docName)
    ]);

    // All should be the same document
    const allDocs = [...batch1, sequentialDoc, ...batch2];
    const firstDoc = allDocs[0];
    
    allDocs.forEach(doc => {
      expect(doc).toBe(firstDoc);
    });

    expect(docs.size).toBe(1);
    expect(documentLocks.size).toBe(0);
  });

  test('should clean up locks even if creation fails', async () => {
    const docName = 'test-error-doc';

    // Simulate a creation that fails
    const simulateFailingGetYDoc = async (docname) => {
      let lockPromise = documentLocks.get(docname);
      if (lockPromise) {
        await lockPromise;
        return docs.get(docname);
      }

      const createDocumentPromise = (async () => {
        try {
          await new Promise(resolve => setTimeout(resolve, 10));
          throw new Error('Simulated creation failure');
        } finally {
          documentLocks.delete(docname);
        }
      })();

      documentLocks.set(docname, createDocumentPromise);
      return await createDocumentPromise;
    };

    await expect(simulateFailingGetYDoc(docName)).rejects.toThrow('Simulated creation failure');
    
    // Lock should be cleaned up even after failure
    expect(documentLocks.size).toBe(0);
    expect(docs.size).toBe(0);
  });
});
