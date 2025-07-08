const WebSocket = require('ws');
const { setupWSConnection } = require('../utils/y-websocket-utils');
const { extractDocumentId, parseDocumentMetadata } = require('../utils/DocumentUtils');

/**
 * WebSocketHandler
 * Handles WebSocket server setup and connection management
 * Follows Single Responsibility Principle - only handles WebSocket operations
 */
class WebSocketHandler {
  constructor(logger, authenticationHandler) {
    this.logger = logger;
    this.authenticationHandler = authenticationHandler;
    this.wss = null;
  }

  /**
   * Initialize WebSocket server
   * @param {http.Server} httpServer - HTTP server instance
   * @returns {WebSocket.Server} - WebSocket server instance
   */
  initialize(httpServer) {
    try {
      // Create WebSocket server without a server (we'll handle upgrade manually)
      this.wss = new WebSocket.Server({ noServer: true });

      // Handle WebSocket connections
      this.wss.on('connection', async (ws, req) => {
        await this.handleConnection(ws, req);
      });

      // Handle WebSocket upgrade requests
      httpServer.on('upgrade', async (request, socket, head) => {
        await this.handleUpgrade(request, socket, head);
      });

      this.logger.info('WebSocket server initialized', {
        service: 'websocket-handler'
      });
      
      return this.wss;
    } catch (error) {
      this.logger.error('Failed to initialize WebSocket server', error, {
        service: 'websocket-handler'
      });
      throw error;
    }
  }

  /**
   * Handle new WebSocket connection
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} req - HTTP request object
   */
  async handleConnection(ws, req) {
    // Extract document ID and metadata
    const documentId = extractDocumentId(req);
    const documentMetadata = parseDocumentMetadata(req);
    const connectionId = `ws-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    this.logger.info('New WebSocket connection', {
      connectionId,
      documentId,
      origin: req.headers.origin,
      service: 'websocket-handler'
    });

    try {
      // Get user from request (set during upgrade)
      const user = req.user;
      const userId = user ? `user-${user.id}` : 'anonymous';

      // Attach user information to WebSocket connection for permission checks
      ws.user = user;

      this.logger.info('🔗 Authenticated user connected to document', {
        connectionId,
        userId: user?.id,
        username: user?.username,
        email: user?.email,
        documentId,
        userAgent: req.headers['user-agent']?.substring(0, 50) + '...',
        secureConnection: true,
        service: 'websocket-handler'
      });

      // Setup YJS collaborative document connection
      await this.setupYjsConnection(ws, req, {
        connectionId,
        documentId,
        userId,
        user
      });

    } catch (error) {
      this.logger.error('Failed to setup WebSocket connection', error, {
        connectionId,
        documentId,
        url: req.url,
        service: 'websocket-handler'
      });
      ws.close();
    }
  }

  /**
   * Setup YJS connection for collaborative editing
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} req - HTTP request object
   * @param {Object} connectionInfo - Connection information
   */
  async setupYjsConnection(ws, req, connectionInfo) {
    const { connectionId, documentId, userId, user } = connectionInfo;

    this.logger.info('Setting up YJS collaborative document connection', {
      connectionId,
      documentId,
      originalUrl: req.url,
      userId,
      username: user?.username,
      collaborativeFeatures: ['real-time-sync', 'awareness', 'redis-persistence'],
      service: 'websocket-handler',
      userPermissions: user ? user.permissions : []
    });

    this.logger.debug('Calling setupWSConnection', {
      connectionId,
      documentId,
      service: 'websocket-handler'
    });

    await setupWSConnection(ws, req, {
      docName: documentId,
      gc: true
    });

    this.logger.info('YJS collaborative document connection established successfully', {
      connectionId,
      documentId,
      userId,
      username: user?.username,
      features: {
        realTimeSync: true,
        awarenessSharing: true,
        redisPersistence: true,
        secureAuthentication: true
      },
      service: 'websocket-handler'
    });

    this.logger.debug('WebSocket connection details', {
      connectionId,
      documentId,
      userId,
      userAgent: req.headers['user-agent'],
      origin: req.headers.origin,
      service: 'websocket-handler'
    });
  }

  /**
   * Handle WebSocket upgrade request
   * @param {Object} request - HTTP upgrade request
   * @param {net.Socket} socket - Network socket
   * @param {Buffer} head - First packet of upgraded stream
   */
  async handleUpgrade(request, socket, head) {
    try {
      this.logger.info(`WebSocket upgrade request - URL: ${request.url}`, {
        service: 'websocket-handler'
      });

      // Authenticate the upgrade request
      const authResult = await this.authenticationHandler.authenticateWebSocketUpgrade(request);
      
      if (!authResult.success) {
        this.logger.warn('WebSocket connection rejected', {
          error: authResult.error,
          statusCode: authResult.statusCode,
          url: request.url,
          service: 'websocket-handler'
        });
        
        socket.write(`HTTP/1.1 ${authResult.statusCode} ${this.getStatusText(authResult.statusCode)}\r\n\r\n${authResult.error}`);
        socket.destroy();
        return;
      }

      // Attach user and token to request
      request.user = authResult.user;
      request.user.token = authResult.token;

      // Upgrade the connection
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit('connection', ws, request);
      });

    } catch (error) {
      this.logger.error('WebSocket upgrade failed', error, {
        service: 'websocket-handler'
      });
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\nUpgrade error');
      socket.destroy();
    }
  }

  /**
   * Get HTTP status text
   * @param {number} statusCode - HTTP status code
   * @returns {string} - Status text
   */
  getStatusText(statusCode) {
    const statusTexts = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      500: 'Internal Server Error'
    };
    return statusTexts[statusCode] || 'Unknown';
  }

  /**
   * Get WebSocket server instance
   * @returns {WebSocket.Server} - WebSocket server instance
   */
  getWebSocketServer() {
    return this.wss;
  }

  /**
   * Close WebSocket server
   */
  close() {
    if (this.wss) {
      this.wss.close();
      this.logger.info('WebSocket server closed', {
        service: 'websocket-handler'
      });
    }
  }
}

module.exports = WebSocketHandler;
