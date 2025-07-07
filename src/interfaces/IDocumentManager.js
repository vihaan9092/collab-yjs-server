/**
 * Interface for Document Management
 * Follows Interface Segregation Principle - defines only document-related methods
 */
class IDocumentManager {
  /**
   * Get or create a YJS document
   * @param {string} documentId - Document identifier
   * @returns {Object} YJS document instance
   */
  getDocument(documentId) {
    throw new Error('Method getDocument must be implemented');
  }

  /**
   * Check if document exists
   * @param {string} documentId - Document identifier
   * @returns {boolean} True if document exists
   */
  hasDocument(documentId) {
    throw new Error('Method hasDocument must be implemented');
  }

  /**
   * Remove a document from memory
   * @param {string} documentId - Document identifier
   */
  removeDocument(documentId) {
    throw new Error('Method removeDocument must be implemented');
  }

  /**
   * Get document statistics
   * @param {string} documentId - Document identifier
   * @returns {Object} Document statistics
   */
  getDocumentStats(documentId) {
    throw new Error('Method getDocumentStats must be implemented');
  }

  /**
   * Get all document IDs
   * @returns {Array} Array of document IDs
   */
  getAllDocumentIds() {
    throw new Error('Method getAllDocumentIds must be implemented');
  }

  /**
   * Clean up unused documents
   */
  cleanup() {
    throw new Error('Method cleanup must be implemented');
  }


}

module.exports = IDocumentManager;
