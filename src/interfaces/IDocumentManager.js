class IDocumentManager {
  getDocument(documentId) {
    throw new Error('Method getDocument must be implemented');
  }

  hasDocument(documentId) {
    throw new Error('Method hasDocument must be implemented');
  }

  removeDocument(documentId) {
    throw new Error('Method removeDocument must be implemented');
  }

  getDocumentStats(documentId) {
    throw new Error('Method getDocumentStats must be implemented');
  }

  getAllDocumentIds() {
    throw new Error('Method getAllDocumentIds must be implemented');
  }

  cleanup() {
    throw new Error('Method cleanup must be implemented');
  }


}

module.exports = IDocumentManager;
