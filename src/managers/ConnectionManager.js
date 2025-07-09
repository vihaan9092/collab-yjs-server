const { docs } = require('../utils/y-websocket-utils');

class ConnectionManager {
  constructor(logger) {
    this.logger = logger;
  }

  getConnectionsByDocument(documentId) {
    const doc = docs.get(documentId);
    if (!doc) return [];

    const connections = [];
    doc.conns.forEach((_, ws) => {
      connections.push({
        id: `ws-${Date.now()}-${Math.random()}`,
        ws: ws,
        documentId: documentId,
        joinedAt: new Date(),
        lastActivity: new Date()
      });
    });

    return connections;
  }

  getConnectionCount() {
    let totalConnections = 0;
    docs.forEach(doc => {
      totalConnections += doc.conns.size;
    });
    return totalConnections;
  }

  destroy() {
    this.logger.info('ConnectionManager destroyed');
  }

  getConnectionStats() {
    const stats = {
      totalConnections: this.getConnectionCount(),
      documentsWithConnections: docs.size,
      connectionsByDocument: {}
    };

    docs.forEach((doc, documentId) => {
      stats.connectionsByDocument[documentId] = doc.conns.size;
    });

    return stats;
  }
}

module.exports = ConnectionManager;
