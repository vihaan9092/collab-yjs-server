const express = require('express');

class RouteHandler {
  constructor(logger, authenticationHandler) {
    this.logger = logger;
    this.authenticationHandler = authenticationHandler;
    this.yjsService = null;
  }


  setYjsService(yjsService) {
    this.yjsService = yjsService;
  }

  createApiRouter() {
    const apiRouter = express.Router();

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


  createHealthRoute(wss) {
    return async (req, res) => {
      try {
        const health = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          websocket: wss ? 'active' : 'inactive'
        };

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
