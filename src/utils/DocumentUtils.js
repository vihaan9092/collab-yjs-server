/**
 * Document Utilities
 * Provides consistent document ID handling across the application
 */

/**
 * Extract document ID from WebSocket request URL
 * @param {Object} req - HTTP request object
 * @returns {string} Document ID
 */
function extractDocumentId(req) {
  if (!req || !req.url) {
    return 'default';
  }

  try {
    // Remove query parameters and leading slash
    const urlPath = req.url.split('?')[0];
    const documentId = urlPath.slice(1) || 'default';
    
    // Validate document ID format
    if (!isValidDocumentId(documentId)) {
      return 'default';
    }
    
    return documentId;
  } catch (error) {
    return 'default';
  }
}

/**
 * Validate document ID format
 * @param {string} documentId - Document ID to validate
 * @returns {boolean} True if valid
 */
function isValidDocumentId(documentId) {
  if (!documentId || typeof documentId !== 'string') {
    return false;
  }
  
  // Document ID should be alphanumeric with hyphens and underscores
  // Length between 1 and 100 characters
  const validPattern = /^[a-zA-Z0-9_-]{1,100}$/;
  return validPattern.test(documentId);
}

/**
 * Sanitize document ID to ensure it's safe
 * @param {string} documentId - Document ID to sanitize
 * @returns {string} Sanitized document ID
 */
function sanitizeDocumentId(documentId) {
  if (!documentId || typeof documentId !== 'string') {
    return 'default';
  }
  
  // Remove invalid characters and limit length
  const sanitized = documentId
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .substring(0, 100);
    
  return sanitized || 'default';
}

/**
 * Generate a unique document ID
 * @param {string} prefix - Optional prefix for the document ID
 * @returns {string} Unique document ID
 */
function generateDocumentId(prefix = 'doc') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Parse document metadata from URL
 * @param {Object} req - HTTP request object
 * @returns {Object} Document metadata
 */
function parseDocumentMetadata(req) {
  const documentId = extractDocumentId(req);
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  
  return {
    documentId,
    originalUrl: req.url,
    pathname: url.pathname,
    searchParams: Object.fromEntries(url.searchParams),
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  extractDocumentId,
  isValidDocumentId,
  sanitizeDocumentId,
  generateDocumentId,
  parseDocumentMetadata
};
