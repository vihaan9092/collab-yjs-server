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



    apiRouter.get('/dashboard/metrics', (req, res) => {
      try {
        const memUsage = process.memoryUsage();
        const { docs } = require('../utils/y-websocket-utils');

        let totalConnections = 0;
        let totalDocumentSize = 0;
        const documentMetrics = [];

        docs.forEach((doc, documentId) => {
          const connections = doc.conns.size;
          totalConnections += connections;

          let docSize = 0;
          try {
            const { getDocumentStateSize } = require('../utils/y-websocket-utils');
            docSize = getDocumentStateSize(doc);
            totalDocumentSize += docSize;
          } catch (error) {
            // Ignore size calculation errors
          }

          documentMetrics.push({
            id: documentId,
            connections,
            size: docSize,
            lastActivity: doc.lastActivity || Date.now(),
            isActive: connections > 0
          });
        });

        const metrics = {
          timestamp: Date.now(),
          server: {
            uptime: Math.round(process.uptime()),
            nodeVersion: process.version,
            platform: process.platform,
            pid: process.pid
          },
          memory: {
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
            heapUsagePercent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
            rss: Math.round(memUsage.rss / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024),
            arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024),
            maxOldSpaceSize: process.env.NODE_OPTIONS ?
              parseInt(process.env.NODE_OPTIONS.match(/--max-old-space-size=(\d+)/)?.[1]) || 'default' : 'default'
          },
          documents: {
            total: docs.size,
            active: documentMetrics.filter(d => d.isActive).length,
            totalSize: Math.round(totalDocumentSize / 1024), // KB
            list: documentMetrics.slice(0, 10) // Top 10 for dashboard
          },
          connections: {
            total: totalConnections,
            averagePerDocument: docs.size > 0 ? Math.round(totalConnections / docs.size * 100) / 100 : 0
          }
        };

        if (this.yjsService && this.yjsService.documentManager) {
          const dm = this.yjsService.documentManager;
          if (dm.memoryManager) {
            metrics.optimization = {
              memoryManager: dm.memoryManager.getMemoryStats(),
              performanceMonitor: dm.performanceMonitor ? dm.performanceMonitor.getPerformanceSummary() : null
            };
          }
        }

        res.json(metrics);
      } catch (error) {
        this.logger.error('Failed to get dashboard metrics', error, {
          service: 'route-handler'
        });
        res.status(500).json({ error: 'Failed to get dashboard metrics' });
      }
    });

    apiRouter.get('/dashboard/documents', (req, res) => {
      try {
        const { docs } = require('../utils/y-websocket-utils');
        const { getDocumentStateSize } = require('../utils/y-websocket-utils');

        const documents = [];
        docs.forEach((doc, documentId) => {
          const connections = [];
          doc.conns.forEach((_, conn) => {
            connections.push({
              userId: conn.user?.id || 'anonymous',
              username: conn.user?.username || 'Anonymous',
              connectedAt: conn.connectedAt || Date.now(),
              readyState: conn.readyState
            });
          });

          let docSize = 0;
          try {
            docSize = getDocumentStateSize(doc);
          } catch (error) {
            // Ignore size calculation errors
          }

          documents.push({
            id: documentId,
            size: Math.round(docSize / 1024), // KB
            connections: connections,
            connectionCount: connections.length,
            lastActivity: doc.lastActivity || Date.now(),
            isActive: connections.length > 0,
            awareness: doc.awareness ? doc.awareness.getStates().size : 0
          });
        });

        // Sort by activity (most recent first)
        documents.sort((a, b) => b.lastActivity - a.lastActivity);

        res.json({
          timestamp: Date.now(),
          total: documents.length,
          documents: documents
        });
      } catch (error) {
        this.logger.error('Failed to get document details', error, {
          service: 'route-handler'
        });
        res.status(500).json({ error: 'Failed to get document details' });
      }
    });

    // Dashboard API - System health
    apiRouter.get('/dashboard/health', async (req, res) => {
      try {
        const health = {
          timestamp: Date.now(),
          status: 'healthy',
          checks: {
            server: { status: 'healthy', uptime: Math.round(process.uptime()) },
            memory: { status: 'healthy', usage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100) },
            redis: { status: 'unknown', connected: false },
            websocket: { status: 'healthy', connections: 0 }
          }
        };

        // Check Redis connection
        if (this.yjsService && this.yjsService.documentManager && this.yjsService.documentManager.redisSync) {
          try {
            const redisSync = this.yjsService.documentManager.redisSync;
            health.checks.redis = {
              status: 'healthy',
              connected: true,
              metrics: redisSync.getMetrics()
            };
          } catch (error) {
            health.checks.redis = { status: 'error', connected: false, error: error.message };
          }
        }

        // Check WebSocket connections
        const { docs } = require('../utils/y-websocket-utils');
        let totalConnections = 0;
        docs.forEach(doc => totalConnections += doc.conns.size);
        health.checks.websocket.connections = totalConnections;

        // Check memory usage
        const memUsage = (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100;
        if (memUsage > 90) {
          health.checks.memory.status = 'warning';
          health.status = 'warning';
        } else if (memUsage > 95) {
          health.checks.memory.status = 'critical';
          health.status = 'critical';
        }

        res.json(health);
      } catch (error) {
        this.logger.error('Failed to get system health', error, {
          service: 'route-handler'
        });
        res.status(500).json({
          timestamp: Date.now(),
          status: 'error',
          error: 'Failed to get system health'
        });
      }
    });

    // Dashboard API - Performance metrics
    apiRouter.get('/dashboard/performance', (req, res) => {
      try {
        const timeRange = req.query.range || '1h'; // 1h, 6h, 24h
        const performance = {
          timestamp: Date.now(),
          timeRange,
          metrics: {
            memory: {
              current: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
              trend: 'stable' // Could be enhanced with historical data
            },
            documents: {
              total: 0,
              active: 0,
              averageSize: 0
            },
            connections: {
              total: 0,
              peak: 0, // Could be tracked over time
              averageLatency: 0 // Could be measured
            }
          }
        };

        // Calculate current metrics
        const { docs } = require('../utils/y-websocket-utils');
        let totalConnections = 0;
        let totalSize = 0;
        let activeDocuments = 0;

        docs.forEach((doc, documentId) => {
          const connections = doc.conns.size;
          totalConnections += connections;
          if (connections > 0) activeDocuments++;

          try {
            const { getDocumentStateSize } = require('../utils/y-websocket-utils');
            totalSize += getDocumentStateSize(doc);
          } catch (error) {
            // Ignore size calculation errors
          }
        });

        performance.metrics.documents = {
          total: docs.size,
          active: activeDocuments,
          averageSize: docs.size > 0 ? Math.round(totalSize / docs.size / 1024) : 0 // KB
        };

        performance.metrics.connections = {
          total: totalConnections,
          peak: totalConnections, // In a real implementation, track historical peak
          averageLatency: 0 // Would need to implement latency tracking
        };

        // Add optimization metrics if available
        if (this.yjsService && this.yjsService.documentManager && this.yjsService.documentManager.performanceMonitor) {
          const perfSummary = this.yjsService.documentManager.performanceMonitor.getPerformanceSummary();
          performance.optimization = perfSummary;
        }

        res.json(performance);
      } catch (error) {
        this.logger.error('Failed to get performance metrics', error, {
          service: 'route-handler'
        });
        res.status(500).json({ error: 'Failed to get performance metrics' });
      }
    });

    // Force garbage collection endpoint
    apiRouter.post('/gc', (req, res) => {
      try {
        if (global.gc) {
          const beforeGC = process.memoryUsage();
          global.gc();
          const afterGC = process.memoryUsage();

          const improvement = {
            heapUsedBefore: Math.round(beforeGC.heapUsed / 1024 / 1024),
            heapUsedAfter: Math.round(afterGC.heapUsed / 1024 / 1024),
            heapFreed: Math.round((beforeGC.heapUsed - afterGC.heapUsed) / 1024 / 1024),
            rssFreed: Math.round((beforeGC.rss - afterGC.rss) / 1024 / 1024)
          };

          this.logger.info('Manual garbage collection triggered', improvement);

          res.json({
            success: true,
            message: 'Garbage collection completed',
            improvement,
            timestamp: new Date().toISOString()
          });
        } else {
          res.status(400).json({
            success: false,
            error: 'Garbage collection not available. Start with --expose-gc flag.'
          });
        }
      } catch (error) {
        this.logger.error('Failed to trigger GC', error);
        res.status(500).json({
          success: false,
          error: 'Failed to trigger garbage collection'
        });
      }
    });

    // Force idle cleanup endpoint
    apiRouter.post('/cleanup/idle', async (req, res) => {
      try {
        const { docs } = require('../utils/y-websocket-utils');
        const cleaned = [];

        // Force cleanup all documents with no active connections
        for (const [documentId, doc] of docs.entries()) {
          if (doc.conns.size === 0) {
            docs.delete(documentId);
            cleaned.push(documentId);
            this.logger.info('Force cleaned idle document', { documentId });
          }
        }

        // Force garbage collection
        if (global.gc) {
          global.gc();
        }

        res.json({
          success: true,
          message: `Force cleaned ${cleaned.length} idle documents`,
          cleanedDocuments: cleaned,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        this.logger.error('Failed to force cleanup idle documents', error);
        res.status(500).json({
          success: false,
          error: 'Failed to cleanup idle documents'
        });
      }
    });

    // Cleanup endpoint for stale documents
    apiRouter.post('/cleanup/documents', async (req, res) => {
      try {
        const { docs } = require('../utils/y-websocket-utils');
        const cleaned = [];

        // Find documents with no connections
        docs.forEach((doc, documentId) => {
          if (doc.conns.size === 0) {
            // Clean up Redis subscriptions if available
            if (this.yjsService && this.yjsService.documentManager && this.yjsService.documentManager.redisSync) {
              this.yjsService.documentManager.redisSync.unsubscribeFromDocument(documentId);
            }

            // Remove from docs map
            docs.delete(documentId);
            cleaned.push(documentId);

            this.logger.info('Cleaned up stale document', {
              documentId,
              service: 'route-handler'
            });
          }
        });

        res.json({
          success: true,
          cleanedDocuments: cleaned.length,
          documentIds: cleaned
        });
      } catch (error) {
        this.logger.error('Failed to cleanup documents', error, {
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
