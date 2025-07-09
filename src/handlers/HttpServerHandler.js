const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

class HttpServerHandler {
  constructor(config, logger, routeHandler) {
    this.config = config;
    this.logger = logger;
    this.routeHandler = routeHandler;
    this.app = express();
  }

  initialize(wss) {
    try {
      this.setupMiddleware();
      this.setupRoutes(wss);
      this.setupErrorHandling();

      this.logger.info('Express server initialized', {
        service: 'http-server-handler'
      });
    } catch (error) {
      this.logger.error('Failed to initialize Express server', error, {
        service: 'http-server-handler'
      });
      throw error;
    }
  }

  setupMiddleware() {
    this.app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }));

    this.app.use(cors(this.config.get('cors')));

    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    this.app.use((req, res, next) => {
      this.logger.http(`${req.method} ${req.url}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        service: 'http-server-handler'
      });
      next();
    });

    this.logger.debug('Express middleware configured', {
      service: 'http-server-handler'
    });
  }

  setupRoutes(wss) {
    this.app.get('/health', this.routeHandler.createHealthRoute(wss));
    this.app.get('/examples/*', this.routeHandler.createDeprecatedRoutesHandler());

    const apiRouter = this.routeHandler.createApiRouter();
    this.app.use('/api', apiRouter);

    this.logger.debug('HTTP routes configured', {
      service: 'http-server-handler'
    });
  }

  setupErrorHandling() {
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.url} not found`,
        availableRoutes: [
          'GET /health - Server health check',
          'GET /api/auth/status - Authentication status',
          'GET /api/stats - Server statistics',
          'GET /api/documents/:documentId - Document information',
          'DELETE /api/documents/:documentId - Force document cleanup',
          'GET /api/debug/documents - Debug document list'
        ]
      });
    });

    this.app.use((error, req, res, next) => {
      this.logger.error('Unhandled error in Express', error, {
        url: req.url,
        method: req.method,
        ip: req.ip,
        service: 'http-server-handler'
      });

      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    });

    this.logger.debug('Error handling configured', {
      service: 'http-server-handler'
    });
  }

  getApp() {
    return this.app;
  }
}

module.exports = HttpServerHandler;
