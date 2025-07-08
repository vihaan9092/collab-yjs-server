const http = require('http');
const { setDocumentManager } = require('../utils/y-websocket-utils');

// Import refactored handlers
const AuthenticationHandler = require('../handlers/AuthenticationHandler');
const HttpServerHandler = require('../handlers/HttpServerHandler');
const WebSocketHandler = require('../handlers/WebSocketHandler');
const RouteHandler = require('../handlers/RouteHandler');

/**
 * WebSocketServer - Main Orchestrator (Refactored)
 *
 * ARCHITECTURE OVERVIEW:
 * =====================
 * This class follows the Dependency Injection pattern and acts as a composition root.
 * It coordinates specialized handlers, each with a single responsibility:
 *
 * 1. AuthenticationHandler - JWT validation, user creation, token decoding
 * 2. HttpServerHandler - Express setup, middleware, CORS, security
 * 3. WebSocketHandler - WebSocket server, connection management, upgrades
 * 4. RouteHandler - API route definitions and handlers
 *
 * BENEFITS:
 * - Single Responsibility Principle: Each handler has one clear purpose
 * - Dependency Injection: Easy testing and flexibility
 * - Separation of Concerns: HTTP, WebSocket, Auth, and Routes are separate
 * - Maintainability: Changes to one area don't affect others
 * - Testability: Each handler can be unit tested independently
 */
class WebSocketServer {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.server = http.createServer();
    this.isRunning = false;
    this.yjsService = null;

    // Initialize handlers with dependency injection
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

  /**
   * Initialize all server components
   * Coordinates the initialization of all handlers in the correct order
   */
  initialize() {
    try {
      // Step 1: Initialize WebSocket server first
      this.wss = this.webSocketHandler.initialize(this.server);

      // Step 2: Initialize HTTP server with WebSocket reference
      this.httpServerHandler.initialize(this.wss);

      // Step 3: Attach Express app to HTTP server
      this.server.on('request', this.httpServerHandler.getApp());

      this.logger.info('🎯 WebSocketServer initialization complete', {
        components: ['HTTP Server', 'WebSocket Server', 'Authentication', 'Routes'],
        architecture: 'Modular with Dependency Injection',
        service: 'websocket-server'
      });
    } catch (error) {
      this.logger.error('❌ Failed to initialize WebSocketServer', error, {
        service: 'websocket-server'
      });
      throw error;
    }
  }

  /**
   * Set YJS service reference for route handlers
   * @param {Object} yjsService - YJS service instance
   */
  setYjsService(yjsService) {
    this.yjsService = yjsService;
    this.routeHandler.setYjsService(yjsService);

    // Set document manager for y-websocket-utils
    if (yjsService && yjsService.documentManager) {
      setDocumentManager(yjsService.documentManager);
    }

    this.logger.info('YJS service configured', {
      hasDocumentManager: !!(yjsService && yjsService.documentManager),
      service: 'websocket-server'
    });
  }


  /**
   * Start the server
   */
  start() {
    try {
      const port = this.config.get('port');
      const host = this.config.get('host');

      this.server.listen(port, host, () => {
        this.isRunning = true;
        this.logger.info(`🚀 Realtime YJS Server started successfully`, {
          port,
          host,
          environment: process.env.NODE_ENV || 'development',
          components: ['HTTP Server', 'WebSocket Server', 'Authentication', 'YJS Collaboration'],
          service: 'websocket-server'
        });
      });

      // Handle server errors
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

  /**
   * Stop the server gracefully
   */
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

  /**
   * Get WebSocket server instance
   * @returns {WebSocket.Server} - WebSocket server instance
   */
  getWebSocketServer() {
    return this.webSocketHandler ? this.webSocketHandler.getWebSocketServer() : null;
  }

  /**
   * Check if server is running
   * @returns {boolean} - Server running status
   */
  isServerRunning() {
    return this.isRunning;
  }
}

module.exports = WebSocketServer;
