function extractDocumentId(req) {
  if (!req || !req.url) {
    return 'default';
  }

  try {
    const urlPath = req.url.split('?')[0];
    const documentId = urlPath.slice(1) || 'default';
    if (!isValidDocumentId(documentId)) {
      return 'default';
    }
    
    return documentId;
  } catch (error) {
    return 'default';
  }
}

function isValidDocumentId(documentId) {
  if (!documentId || typeof documentId !== 'string') {
    return false;
  }
  
  const validPattern = /^[a-zA-Z0-9_-]{1,100}$/;
  return validPattern.test(documentId);
}

function sanitizeDocumentId(documentId) {
  if (!documentId || typeof documentId !== 'string') {
    return 'default';
  }
  
  const sanitized = documentId
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .substring(0, 100);
    
  return sanitized || 'default';
}

function generateDocumentId(prefix = 'doc') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

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
