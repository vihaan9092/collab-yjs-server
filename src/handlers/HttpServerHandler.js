const express = require('express');
const path = require('path');
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
    this.app.use(express.static('public'));

    this.app.get('/dashboard', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'public', 'dashboard.html'));
    });

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
          'GET /dashboard - Interactive monitoring dashboard',
          'GET /health - Server health check',
          'GET /api/auth/status - Authentication status',
          'GET /api/stats - Server statistics',
          'GET /api/dashboard/metrics - Real-time dashboard metrics',
          'GET /api/dashboard/documents - Document details for dashboard',
          'GET /api/dashboard/health - System health status',
          'GET /api/dashboard/performance - Performance metrics',
          'POST /api/gc - Force garbage collection',
          'POST /api/cleanup/idle - Force cleanup idle documents',
          'GET /api/documents/:documentId - Document information',
          'DELETE /api/documents/:documentId - Force document cleanup',
          'POST /api/cleanup/documents - Cleanup stale documents',
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
