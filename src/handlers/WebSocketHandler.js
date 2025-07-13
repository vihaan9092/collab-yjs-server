const WebSocket = require('ws');
const { setupWSConnection } = require('../utils/y-websocket-utils');
const { extractDocumentId, parseDocumentMetadata } = require('../utils/DocumentUtils');

class WebSocketHandler {
  constructor(logger, authenticationHandler) {
    this.logger = logger;
    this.authenticationHandler = authenticationHandler;
    this.wss = null;
  }

  initialize(httpServer) {
    try {
      this.wss = new WebSocket.Server({ noServer: true });

      this.wss.on('connection', async (ws, req) => {
        try {
          await this.handleConnection(ws, req);
        } catch (error) {
          this.logger.error('Error in WebSocket connection handler', error, {
            url: req.url,
            service: 'websocket-handler'
          });
          if (ws.readyState === WebSocket.OPEN) {
            ws.close(1011, 'Server error during connection setup');
          }
        }
      });

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


  async handleConnection(ws, req) {
    const documentId = extractDocumentId(req);
    // const documentMetadata = parseDocumentMetadata(req);
    const connectionId = `ws-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    this.logger.info('New WebSocket connection', {
      connectionId,
      documentId,
      origin: req.headers.origin,
      service: 'websocket-handler'
    });

    try {
      const user = req.user;
      const userId = user ? `user-${user.id}` : 'anonymous';

      ws.user = user;

      this.logger.info('Authenticated user connected to document', {
        connectionId,
        userId: user?.id,
        username: user?.username,
        email: user?.email,
        documentId,
        userAgent: req.headers['user-agent']?.substring(0, 50) + '...',
        secureConnection: true,
        service: 'websocket-handler'
      });

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

  getStatusText(statusCode) {
    const statusTexts = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      500: 'Internal Server Error'
    };
    return statusTexts[statusCode] || 'Unknown';
  }

  getWebSocketServer() {
    return this.wss;
  }

  close() {
    if (this.wss) {
      this.wss.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1001, 'Server shutting down');
        }
      });

      this.wss.close();
      this.logger.info('WebSocket server closed and all connections terminated', {
        service: 'websocket-handler'
      });
    }
  }
}

module.exports = WebSocketHandler;
