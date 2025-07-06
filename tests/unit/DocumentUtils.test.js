/**
 * DocumentUtils Unit Tests
 * Tests for consistent document ID handling
 */

const {
  extractDocumentId,
  isValidDocumentId,
  sanitizeDocumentId,
  generateDocumentId,
  parseDocumentMetadata
} = require('../../src/utils/DocumentUtils');

describe('DocumentUtils', () => {
  describe('extractDocumentId', () => {
    test('should extract document ID from simple URL', () => {
      const req = { url: '/my-document' };
      expect(extractDocumentId(req)).toBe('my-document');
    });

    test('should extract document ID from URL with query params', () => {
      const req = { url: '/test-doc?userId=123&token=abc' };
      expect(extractDocumentId(req)).toBe('test-doc');
    });

    test('should return default for root URL', () => {
      const req = { url: '/' };
      expect(extractDocumentId(req)).toBe('default');
    });

    test('should return default for empty URL', () => {
      const req = { url: '' };
      expect(extractDocumentId(req)).toBe('default');
    });

    test('should return default for invalid request', () => {
      expect(extractDocumentId(null)).toBe('default');
      expect(extractDocumentId({})).toBe('default');
      expect(extractDocumentId({ url: null })).toBe('default');
    });

    test('should handle complex document IDs', () => {
      const req = { url: '/project-123_draft-v2' };
      expect(extractDocumentId(req)).toBe('project-123_draft-v2');
    });

    test('should return default for invalid document ID format', () => {
      const req = { url: '/invalid@document#id' };
      expect(extractDocumentId(req)).toBe('default');
    });
  });

  describe('isValidDocumentId', () => {
    test('should validate correct document IDs', () => {
      expect(isValidDocumentId('valid-doc')).toBe(true);
      expect(isValidDocumentId('doc_123')).toBe(true);
      expect(isValidDocumentId('project-v2_draft')).toBe(true);
      expect(isValidDocumentId('a')).toBe(true);
      expect(isValidDocumentId('123')).toBe(true);
    });

    test('should reject invalid document IDs', () => {
      expect(isValidDocumentId('')).toBe(false);
      expect(isValidDocumentId(null)).toBe(false);
      expect(isValidDocumentId(undefined)).toBe(false);
      expect(isValidDocumentId(123)).toBe(false);
      expect(isValidDocumentId('invalid@doc')).toBe(false);
      expect(isValidDocumentId('doc with spaces')).toBe(false);
      expect(isValidDocumentId('doc#hash')).toBe(false);
    });

    test('should reject too long document IDs', () => {
      const longId = 'a'.repeat(101);
      expect(isValidDocumentId(longId)).toBe(false);
    });
  });

  describe('sanitizeDocumentId', () => {
    test('should keep valid document IDs unchanged', () => {
      expect(sanitizeDocumentId('valid-doc')).toBe('valid-doc');
      expect(sanitizeDocumentId('doc_123')).toBe('doc_123');
    });

    test('should remove invalid characters', () => {
      expect(sanitizeDocumentId('doc@with#invalid')).toBe('docwithinvalid');
      expect(sanitizeDocumentId('doc with spaces')).toBe('docwithspaces');
      expect(sanitizeDocumentId('doc/path\\test')).toBe('docpathtest');
    });

    test('should truncate long IDs', () => {
      const longId = 'a'.repeat(150);
      const sanitized = sanitizeDocumentId(longId);
      expect(sanitized).toHaveLength(100);
      expect(sanitized).toBe('a'.repeat(100));
    });

    test('should return default for invalid input', () => {
      expect(sanitizeDocumentId('')).toBe('default');
      expect(sanitizeDocumentId(null)).toBe('default');
      expect(sanitizeDocumentId(undefined)).toBe('default');
      expect(sanitizeDocumentId(123)).toBe('default');
      expect(sanitizeDocumentId('@@@@')).toBe('default');
    });
  });

  describe('generateDocumentId', () => {
    test('should generate unique document IDs', () => {
      const id1 = generateDocumentId();
      const id2 = generateDocumentId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^doc-\d+-[a-z0-9]+$/);
      expect(id2).toMatch(/^doc-\d+-[a-z0-9]+$/);
    });

    test('should use custom prefix', () => {
      const id = generateDocumentId('test');
      expect(id).toMatch(/^test-\d+-[a-z0-9]+$/);
    });

    test('should generate valid document IDs', () => {
      const id = generateDocumentId();
      expect(isValidDocumentId(id)).toBe(true);
    });
  });

  describe('parseDocumentMetadata', () => {
    test('should parse complete document metadata', () => {
      const req = {
        url: '/test-doc?userId=123&token=abc',
        headers: { host: 'localhost:3000' }
      };

      const metadata = parseDocumentMetadata(req);

      expect(metadata.documentId).toBe('test-doc');
      expect(metadata.originalUrl).toBe('/test-doc?userId=123&token=abc');
      expect(metadata.pathname).toBe('/test-doc');
      expect(metadata.searchParams).toEqual({
        userId: '123',
        token: 'abc'
      });
      expect(metadata.timestamp).toBeDefined();
      expect(new Date(metadata.timestamp)).toBeInstanceOf(Date);
    });

    test('should handle URL without query params', () => {
      const req = {
        url: '/simple-doc',
        headers: { host: 'localhost:3000' }
      };

      const metadata = parseDocumentMetadata(req);

      expect(metadata.documentId).toBe('simple-doc');
      expect(metadata.searchParams).toEqual({});
    });

    test('should handle missing host header', () => {
      const req = {
        url: '/test-doc',
        headers: {}
      };

      const metadata = parseDocumentMetadata(req);

      expect(metadata.documentId).toBe('test-doc');
      expect(metadata.originalUrl).toBe('/test-doc');
    });

    test('should handle edge cases', () => {
      const req = {
        url: '/',
        headers: { host: 'localhost:3000' }
      };

      const metadata = parseDocumentMetadata(req);

      expect(metadata.documentId).toBe('default');
      expect(metadata.pathname).toBe('/');
    });
  });
});
