const http = require('http');
const { setDocumentManager } = require('../utils/y-websocket-utils');

const AuthenticationHandler = require('../handlers/AuthenticationHandler');
const HttpServerHandler = require('../handlers/HttpServerHandler');
const WebSocketHandler = require('../handlers/WebSocketHandler');
const RouteHandler = require('../handlers/RouteHandler');

class WebSocketServer {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.server = http.createServer();
    this.isRunning = false;
    this.yjsService = null;

    this.authenticationHandler = new AuthenticationHandler(logger);
    this.routeHandler = new RouteHandler(logger, this.authenticationHandler);
    this.httpServerHandler = new HttpServerHandler(config, logger, this.routeHandler);
    this.webSocketHandler = new WebSocketHandler(logger, this.authenticationHandler);

    this.logger.info('🏗️ WebSocketServer initialized with refactored architecture', {
      handlers: ['AuthenticationHandler', 'HttpServerHandler', 'WebSocketHandler', 'RouteHandler'],
      pattern: 'Dependency Injection + Single Responsibility',
      service: 'websocket-server'
    });
  }

  initialize() {
    try {
      this.wss = this.webSocketHandler.initialize(this.server);

      this.httpServerHandler.initialize(this.wss);

      this.server.on('request', this.httpServerHandler.getApp());

      this.logger.info('WebSocketServer initialization complete', {
        components: ['HTTP Server', 'WebSocket Server', 'Authentication', 'Routes'],
        architecture: 'Modular with Dependency Injection',
        service: 'websocket-server'
      });
    } catch (error) {
      this.logger.error('Failed to initialize WebSocketServer', error, {
        service: 'websocket-server'
      });
      throw error;
    }
  }

  setYjsService(yjsService) {
    this.yjsService = yjsService;
    this.routeHandler.setYjsService(yjsService);

    if (yjsService && yjsService.documentManager) {
      setDocumentManager(yjsService.documentManager);
    }

    this.logger.info('YJS service configured', {
      hasDocumentManager: !!(yjsService && yjsService.documentManager),
      service: 'websocket-server'
    });
  }

  start() {
    try {
      const port = this.config.get('port');
      const host = this.config.get('host');

      this.server.listen(port, host, () => {
        this.isRunning = true;
        this.logger.info(`Realtime YJS Server started successfully`, {
          port,
          host,
          environment: process.env.NODE_ENV || 'development',
          components: ['HTTP Server', 'WebSocket Server', 'Authentication', 'YJS Collaboration'],
          service: 'websocket-server'
        });
      });

      this.server.on('error', (error) => {
        this.logger.error('Server error', error, {
          service: 'websocket-server'
        });
      });

    } catch (error) {
      this.logger.error('Failed to start server', error, {
        service: 'websocket-server'
      });
      throw error;
    }
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server && this.isRunning) {
        // Close WebSocket server first
        if (this.webSocketHandler) {
          this.webSocketHandler.close();
        }

        this.server.close(() => {
          this.isRunning = false;
          this.logger.info('WebSocketServer stopped gracefully', {
            service: 'websocket-server'
          });
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getWebSocketServer() {
    return this.webSocketHandler ? this.webSocketHandler.getWebSocketServer() : null;
  }

  isServerRunning() {
    return this.isRunning;
  }
}

module.exports = WebSocketServer;
