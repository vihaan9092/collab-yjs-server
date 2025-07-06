/**
 * Interface for Connection Management
 * Follows Interface Segregation Principle - defines only connection-related methods
 */
class IConnectionManager {
  /**
   * Add a new connection
   * @param {string} connectionId - Unique connection identifier
   * @param {Object} socket - Socket instance
   * @param {Object} metadata - Connection metadata
   */
  addConnection(connectionId, socket, metadata = {}) {
    throw new Error('Method addConnection must be implemented');
  }

  /**
   * Remove a connection
   * @param {string} connectionId - Connection identifier to remove
   */
  removeConnection(connectionId) {
    throw new Error('Method removeConnection must be implemented');
  }

  /**
   * Get connection by ID
   * @param {string} connectionId - Connection identifier
   * @returns {Object|null} Connection object or null if not found
   */
  getConnection(connectionId) {
    throw new Error('Method getConnection must be implemented');
  }

  /**
   * Get all connections for a document
   * @param {string} documentId - Document identifier
   * @returns {Array} Array of connections
   */
  getConnectionsByDocument(documentId) {
    throw new Error('Method getConnectionsByDocument must be implemented');
  }

  /**
   * Get total number of connections
   * @returns {number} Total connection count
   */
  getConnectionCount() {
    throw new Error('Method getConnectionCount must be implemented');
  }

  /**
   * Broadcast message to connections
   * @param {string} documentId - Document identifier
   * @param {Object} message - Message to broadcast
   * @param {string} excludeConnectionId - Connection ID to exclude from broadcast
   */
  broadcast(documentId, message, excludeConnectionId = null) {
    throw new Error('Method broadcast must be implemented');
  }
}

module.exports = IConnectionManager;
