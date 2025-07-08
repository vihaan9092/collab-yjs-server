const express = require('express');

/**
 * RouteHandler
 * Handles all API route definitions
 * Follows Single Responsibility Principle - only handles route definitions
 */
class RouteHandler {
  constructor(logger, authenticationHandler) {
    this.logger = logger;
    this.authenticationHandler = authenticationHandler;
    this.yjsService = null;
  }

  /**
   * Set YJS service reference
   * @param {Object} yjsService - YJS service instance
   */
  setYjsService(yjsService) {
    this.yjsService = yjsService;
  }

  /**
   * Create API router with all routes
   * @returns {express.Router} - Configured API router
   */
  createApiRouter() {
    const apiRouter = express.Router();

    // Authentication status endpoint
    apiRouter.get('/auth/status', async (req, res) => {
      try {
        const token = req.headers.authorization;
        if (!token) {
          return res.status(401).json({ authenticated: false, error: 'No token provided' });
        }
        
        const authMiddleware = this.authenticationHandler.getAuthMiddleware();
        const userInfo = await authMiddleware.validateToken(token);
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
        this.logger.error('Auth status check failed', error, {
          service: 'route-handler'
        });
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
        this.logger.error('Failed to get stats', error, {
          service: 'route-handler'
        });
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
          documentId: req.params.documentId,
          service: 'route-handler'
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
          documentId: req.params.documentId,
          service: 'route-handler'
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
        this.logger.error('Failed to get debug documents', error, {
          service: 'route-handler'
        });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    return apiRouter;
  }

  /**
   * Create health check route
   * @param {Object} wss - WebSocket server instance
   * @returns {Function} - Express route handler
   */
  createHealthRoute(wss) {
    return async (req, res) => {
      try {
        const health = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          websocket: wss ? 'active' : 'inactive'
        };

        // Add Redis sync health if YJS service is available
        if (this.yjsService && this.yjsService.documentManager && this.yjsService.documentManager.redisSync) {
          const redisHealth = await this.yjsService.documentManager.redisSync.healthCheck();
          health.redisSync = redisHealth;
        }

        res.json(health);
      } catch (error) {
        this.logger.error('Health check failed', error, {
          service: 'route-handler'
        });
        res.status(500).json({
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  /**
   * Create deprecated routes handler
   * @returns {Function} - Express route handler
   */
  createDeprecatedRoutesHandler() {
    return (req, res) => {
      res.status(404).json({
        error: 'Examples Removed',
        message: 'Old example files have been removed. Please use the main Tiptap collaborative editor at /',
        redirect: '/'
      });
    };
  }
}

module.exports = RouteHandler;
