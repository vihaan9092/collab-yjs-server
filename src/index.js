require('dotenv').config();

const ServerConfig = require('./config/ServerConfig');
const Logger = require('./utils/Logger');
const WebSocketServer = require('./server/WebSocketServer');
const ConnectionManager = require('./managers/ConnectionManager');
const DocumentManager = require('./managers/DocumentManager');
const YjsService = require('./services/YjsService');

class RealtimeYjsServer {
  constructor() {
    this.config = null;
    this.logger = null;
    this.webSocketServer = null;
    this.connectionManager = null;
    this.documentManager = null;
    this.yjsService = null;
    this.isShuttingDown = false;
  }

  async initialize() {
    try {
      this.config = new ServerConfig();
      this.config.validate();

      this.logger = new Logger(this.config.get('logging'));
      this.logger.info('Starting Realtime YJS Server...');

      this.connectionManager = new ConnectionManager(this.logger);
      this.documentManager = new DocumentManager(this.logger, this.config.get('yjs'));

      this.yjsService = new YjsService(
        this.connectionManager,
        this.documentManager,
        this.logger
      );

      this.webSocketServer = new WebSocketServer(this.config, this.logger);
      this.webSocketServer.setYjsService(this.yjsService);
      this.webSocketServer.initialize();

      await this.yjsService.initialize();

      this.logger.info('All components initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize application', error);
      throw error;
    }
  }

  start() {
    try {
      this.webSocketServer.start();

      this.logger.info('🎯 Realtime YJS Server startup complete', {
        port: this.config.get('port'),
        host: this.config.get('host'),
        nodeEnv: process.env.NODE_ENV || 'development',
        architecture: 'Refactored with Dependency Injection'
      });

      this.setupGracefulShutdown();

    } catch (error) {
      this.logger.error('Failed to start server', error);
      throw error;
    }
  }

  setupGracefulShutdown() {
    const shutdownHandler = async (signal) => {
      if (this.isShuttingDown) {
        this.logger.warn('Shutdown already in progress, forcing exit');
        process.exit(1);
      }

      this.isShuttingDown = true;
      this.logger.info(`Received ${signal}, starting graceful shutdown...`);

      try {
        if (this.yjsService) {
          await this.yjsService.shutdown();
        }

        if (this.webSocketServer) {
          await this.webSocketServer.stop();
        }

        this.logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during graceful shutdown', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));

    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception', error);
      shutdownHandler('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Rejection', reason, { promise });

      // Don't shutdown for cleanup-related errors - just log them
      if (reason && reason.message && reason.message.includes('Cannot remove document with active connections')) {
        this.logger.warn('Cleanup error detected, continuing operation', { reason: reason.message });
        return;
      }

      // For other critical errors, still shutdown
      this.logger.error('Critical unhandled rejection, initiating shutdown');
      shutdownHandler('unhandledRejection');
    });
  }

  getHealthStatus() {
    if (this.yjsService) {
      return this.yjsService.healthCheck();
    }
    return { status: 'unhealthy', message: 'Service not initialized' };
  }
}

async function main() {
  const Logger = require('./utils/Logger');
  const logger = new Logger({ service: 'startup' });

  const server = new RealtimeYjsServer();

  try {
    await server.initialize();
    server.start();
  } catch (error) {
    logger.error('🚨 CRITICAL: Failed to start Realtime YJS Server', error, {
      suggestion: 'Check configuration, dependencies, and port availability'
    });
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = RealtimeYjsServer;
