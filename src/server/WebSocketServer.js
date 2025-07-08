const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const helmet = require('helmet');
const { setupWSConnection, setDocumentManager } = require('../utils/y-websocket-utils');
const { extractDocumentId, parseDocumentMetadata } = require('../utils/DocumentUtils');
const AuthMiddleware = require('../middleware/AuthMiddleware');
const AuthConfig = require('../config/AuthConfig');

/**
 * WebSocket Server Class
 * Combines Express HTTP server with native WebSocket server for y-websocket
 * Follows Single Responsibility Principle - handles HTTP and WebSocket server setup
 * Follows Open/Closed Principle - extensible for additional middleware
 */
class WebSocketServer {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = null;
    this.isRunning = false;
    this.yjsService = null;

    // Initialize authentication middleware
    this.authMiddleware = new AuthMiddleware({
      jwtSecret: AuthConfig.jwt.secret,
      redisUrl: AuthConfig.redis.url
    });
  }

  /**
   * Initialize the Express server with middleware
   */
  initialize() {
    try {
      // Security middleware
      this.app.use(helmet({
        contentSecurityPolicy: false, // Allow WebSocket connections
        crossOriginEmbedderPolicy: false
      }));

      // CORS middleware
      this.app.use(cors(this.config.get('cors')));

      // Body parsing middleware
      this.app.use(express.json({ limit: '10mb' }));
      this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

      // Request logging middleware
      this.app.use((req, res, next) => {
        this.logger.http(`${req.method} ${req.url}`, {
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        next();
      });

      // API endpoints only - frontend is served separately by Vite/React

      // Health check endpoint
      this.app.get('/health', async (req, res) => {
        try {
          const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            websocket: this.wss ? 'active' : 'inactive'
          };

          // Add Redis sync health if YJS service is available
          if (this.yjsService && this.yjsService.documentManager && this.yjsService.documentManager.redisSync) {
            const redisHealth = await this.yjsService.documentManager.redisSync.healthCheck();
            health.redisSync = redisHealth;
          }

          res.json(health);
        } catch (error) {
          this.logger.error('Health check failed', error);
          res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      });

      // Block old example routes explicitly
      this.app.get('/examples/*', (req, res) => {
        res.status(404).json({
          error: 'Examples Removed',
          message: 'Old example files have been removed. Please use the main Tiptap collaborative editor at /',
          redirect: '/'
        });
      });

      // API routes
      this.setupApiRoutes();

      // Error handling middleware
      this.setupErrorHandling();

      this.logger.info('Express server initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Express server', error);
      throw error;
    }
  }

  /**
   * Setup API routes
   */
  setupApiRoutes() {
    const apiRouter = express.Router();

    // Authentication status endpoint
    apiRouter.get('/auth/status', async (req, res) => {
      try {
        const token = req.headers.authorization;
        if (!token) {
          return res.status(401).json({ authenticated: false, error: 'No token provided' });
        }
        
        const userInfo = await this.authMiddleware.validateToken(token);
        if (!userInfo) {
          return res.status(401).json({ authenticated: false, error: 'Invalid token' });
        }

        res.json({
          authenticated: true,
          user: {
            id: userInfo.userId,
            username: userInfo.username,
            email: userInfo.email
          }
        });
      } catch (error) {
        this.logger.error('Auth status check failed', error);
        res.status(500).json({ authenticated: false, error: 'Internal server error' });
      }
    });

    // Get server statistics
    apiRouter.get('/stats', (req, res) => {
      try {
        if (this.yjsService) {
          const stats = this.yjsService.getStats();
          res.json(stats);
        } else {
          res.status(503).json({ error: 'YJS service not available' });
        }
      } catch (error) {
        this.logger.error('Failed to get stats', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Get document information
    apiRouter.get('/documents/:documentId', (req, res) => {
      try {
        const { documentId } = req.params;
        if (this.yjsService) {
          const info = this.yjsService.getDocumentInfo(documentId);
          res.json(info);
        } else {
          res.status(503).json({ error: 'YJS service not available' });
        }
      } catch (error) {
        this.logger.error('Failed to get document info', error, {
          documentId: req.params.documentId
        });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Force document cleanup (admin endpoint)
    apiRouter.delete('/documents/:documentId', (req, res) => {
      try {
        const { documentId } = req.params;
        if (this.yjsService) {
          const removed = this.yjsService.cleanupDocument(documentId);
          res.json({ removed, documentId });
        } else {
          res.status(503).json({ error: 'YJS service not available' });
        }
      } catch (error) {
        this.logger.error('Failed to cleanup document', error, {
          documentId: req.params.documentId
        });
        res.status(400).json({ error: error.message });
      }
    });

    // Debug endpoint to see all documents
    apiRouter.get('/debug/documents', (req, res) => {
      try {
        const { docs } = require('../utils/y-websocket-utils');
        const documentList = [];

        docs.forEach((doc, documentId) => {
          documentList.push({
            documentId,
            connectionCount: doc.conns.size,
            awarenessStates: doc.awareness.getStates().size,
            hasDoc: !!doc
          });
        });

        res.json({
          totalDocuments: docs.size,
          documents: documentList
        });
      } catch (error) {
        this.logger.error('Failed to get debug documents', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.use('/api', apiRouter);
  }

  /**
   * Setup error handling middleware
   */
  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.url} not found`,
        availableRoutes: [
          'GET / - Main Tiptap collaborative editor',
          'GET /health - Server health check',
          'GET /api/stats - Server statistics',
          'GET /api/documents/:documentId - Document information',
          'DELETE /api/documents/:documentId - Force document cleanup'
        ]
      });
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      this.logger.error('Unhandled error in Express', error, {
        url: req.url,
        method: req.method,
        ip: req.ip
      });

      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    });
  }

  /**
   * Initialize WebSocket server for y-websocket
   */
  initializeWebSocket() {
    try {
      // Create WebSocket server without a server (we'll handle upgrade manually)
      this.wss = new WebSocket.Server({ noServer: true });

      // Handle WebSocket connections using y-websocket setup
      this.wss.on('connection', async (ws, req) => {
        // Extract document ID using consistent utility function
        const documentId = extractDocumentId(req);
        const documentMetadata = parseDocumentMetadata(req);
        const connectionId = `ws-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

        this.logger.info('New WebSocket connection', {
          connectionId,
          documentId,
          origin: req.headers.origin
        });

        // Use authenticated user information
        const user = req.user;
        const userId = user ? `user-${user.id}` : `anonymous-${Math.random().toString(36).substring(2, 11)}`;

        // Log authenticated user info
        if (user) {
          this.logger.info('🔗 Authenticated user connected to document', {
            connectionId,
            userId: user.id,
            username: user.username,
            email: user.email,
            documentId,
            origin: req.headers.origin,
            userAgent: req.headers['user-agent']?.substring(0, 50) + '...',
            secureConnection: true,
            service: 'realtime-yjs-server'
          });
        } else {
          this.logger.warn('🚨 Unauthenticated connection (should not happen)', {
            connectionId,
            documentId,
            service: 'realtime-yjs-server'
          });
        }

        // Add connection to our ConnectionManager if YJS service is available
        if (this.yjsService && this.yjsService.connectionManager) {
          try {
            this.yjsService.connectionManager.addConnection(connectionId, ws, {
              documentId,
              userId,
              user: user, // Include full user object
              url: req.url,
              origin: req.headers.origin,
              authenticated: !!user,
              permissions: user ? user.permissions : []
            });
          } catch (error) {
            this.logger.error('Failed to add connection to ConnectionManager', error, {
              connectionId,
              documentId
            });
          }
        }

        // Handle connection close
        ws.on('close', (code, reason) => {
          this.logger.info('🔌 WebSocket connection closed', {
            connectionId,
            documentId,
            userId,
            username: user?.username,
            closeCode: code,
            closeReason: reason?.toString() || 'No reason provided',
            wasSecureConnection: true,
            service: 'realtime-yjs-server'
          });

          // Remove connection from our ConnectionManager
          if (this.yjsService && this.yjsService.connectionManager) {
            try {
              this.yjsService.connectionManager.removeConnection(connectionId);
            } catch (error) {
              this.logger.error('Failed to remove connection from ConnectionManager', error, {
                connectionId
              });
            }
          }
        });

        // Use y-websocket connection setup with consistent document ID
        try {
          this.logger.info('Setting up YJS collaborative document connection', {
            connectionId,
            documentId,
            originalUrl: req.url,
            userId,
            username: user?.username,
            collaborativeFeatures: ['real-time-sync', 'awareness', 'redis-persistence'],
            service: 'realtime-yjs-server'
          });

          this.logger.debug('Calling setupWSConnection', {
            connectionId,
            documentId,
            service: 'realtime-yjs-server'
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
            service: 'realtime-yjs-server'
          });

          this.logger.debug('WebSocket connection details', {
            connectionId,
            documentId,
            userId,
            userAgent: req.headers['user-agent'],
            origin: req.headers.origin,
            service: 'realtime-yjs-server'
          });

        } catch (error) {
          this.logger.error('Failed to setup WebSocket connection', error, {
            connectionId,
            documentId,
            url: req.url
          });
          ws.close();
        }
      });

      this.server.on('upgrade', async (request, socket, head) => {
        try {
          let token = request.headers.authorization;
          if (token && token.startsWith('Bearer ')) {
            token = token.substring(7);
          }

          if (!token && request.headers['sec-websocket-protocol']) {
            const protocols = request.headers['sec-websocket-protocol'].split(',').map(p => p.trim());
            const authProtocol = protocols.find(p => p.startsWith('auth.'));
            if (authProtocol) {
              try {
                // Decode token from subprotocol
                const encodedToken = authProtocol.substring(5); // Remove "auth." prefix
                token = atob(encodedToken.replace(/_/g, '+')); // Decode URL-safe base64
              } catch (error) {
                this.logger.error('🚨 Failed to decode token from subprotocol', error, {
                  authProtocol,
                  service: 'realtime-yjs-server'
                });
              }
            }
          }

          this.logger.debug('WebSocket upgrade request received', {
            url: request.url,
            hasToken: !!token,
            tokenLength: token ? token.length : 0,
            hasAuthHeader: !!request.headers.authorization,
            hasSubprotocol: !!request.headers['sec-websocket-protocol'],
            authMethod: token ? (request.headers.authorization ? 'header' : 'subprotocol') : 'none',
            service: 'realtime-yjs-server'
          });

          if (token && token.length < 10) {
            this.logger.warn('WebSocket connection rejected: token too short', {
              tokenLength: token.length,
              service: 'realtime-yjs-server'
            });
            socket.write('HTTP/1.1 400 Bad Request\r\n\r\nInvalid token format');
            socket.destroy();
            return;
          }

          this.logger.info(`WebSocket upgrade request - URL: ${request.url}, Token present: ${!!token}`, {
            service: 'realtime-yjs-server'
          });

          if (!token) {
            this.logger.warn(`No token provided in WebSocket connection - URL: ${request.url}`);
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\nAuthentication token required in Authorization header or WebSocket subprotocol');
            socket.destroy();
            return;
          }

          const userInfo = await this.authMiddleware.validateToken(token);
          if (!userInfo) {
            this.logger.warn('WebSocket connection rejected: invalid token', {
              tokenLength: token.length,
              service: 'realtime-yjs-server'
            });
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\nInvalid or expired token');
            socket.destroy();
            return;
          }

          userInfo.token = token;
          const user = await this.authMiddleware.createUserFromJWT(userInfo);
          if (!user || !user.isActive) {
            this.logger.warn('WebSocket connection rejected: user not found or inactive', {
              userId: userInfo.userId,
              service: 'realtime-yjs-server'
            });
            socket.write('HTTP/1.1 403 Forbidden\r\n\r\nUser not found or inactive');
            socket.destroy();
            return;
          }

          request.user = user;
          request.user.token = userInfo.token;

          this.logger.info('WebSocket authentication successful', {
            userId: user.id,
            username: user.username,
            email: user.email,
            permissions: user.permissions,
            authMethod: request.headers.authorization ? 'header' : 'subprotocol',
            documentPath: request.url,
            service: 'realtime-yjs-server'
          });

          this.wss.handleUpgrade(request, socket, head, (ws) => {
            this.wss.emit('connection', ws, request);
          });

        } catch (error) {
          this.logger.error('WebSocket authentication failed', error);
          socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\nAuthentication error');
          socket.destroy();
        }
      });

      this.logger.info('WebSocket server initialized');
      return this.wss;
    } catch (error) {
      this.logger.error('Failed to initialize WebSocket server', error);
      throw error;
    }
  }

  /**
   * Set YJS service reference for API endpoints
   */
  setYjsService(yjsService) {
    this.yjsService = yjsService;

    // Set the DocumentManager in y-websocket-utils for Redis sync integration
    if (yjsService && yjsService.documentManager) {
      setDocumentManager(yjsService.documentManager);
      this.logger.info('DocumentManager set in y-websocket-utils for Redis sync');
    }
  }

  /**
   * Start the server
   */
  async start() {
    try {
      const port = this.config.get('port');
      const host = this.config.get('host');

      await new Promise((resolve, reject) => {
        this.server.listen(port, host, (error) => {
          if (error) {
            reject(error);
          } else {
            this.isRunning = true;
            this.logger.info(`Server started on ${host}:${port}`);
            resolve();
          }
        });
      });
    } catch (error) {
      this.logger.error('Failed to start server', error);
      throw error;
    }
  }

  /**
   * Stop the server
   */
  async stop() {
    try {
      if (!this.isRunning) {
        return;
      }

      // Close WebSocket server first
      if (this.wss) {
        this.wss.close();
      }

      await new Promise((resolve) => {
        this.server.close(() => {
          this.isRunning = false;
          this.logger.info('Server stopped');
          resolve();
        });
      });
    } catch (error) {
      this.logger.error('Failed to stop server', error);
      throw error;
    }
  }

  /**
   * Get WebSocket server instance
   */
  getWebSocketServer() {
    return this.wss;
  }

  /**
   * Check if server is running
   */
  isServerRunning() {
    return this.isRunning;
  }
}

module.exports = WebSocketServer;
