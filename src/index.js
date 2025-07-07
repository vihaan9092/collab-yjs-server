require('dotenv').config();

const ServerConfig = require('./config/ServerConfig');
const Logger = require('./utils/Logger');
const WebSocketServer = require('./server/WebSocketServer');
const ConnectionManager = require('./managers/ConnectionManager');
const DocumentManager = require('./managers/DocumentManager');
const WebSocketHandler = require('./handlers/WebSocketHandler');
const YjsService = require('./services/YjsService');

/**
 * Main Application Class
 */
class RealtimeYjsServer {
  constructor() {
    this.config = null;
    this.logger = null;
    this.webSocketServer = null;
    this.connectionManager = null;
    this.documentManager = null;
    this.webSocketHandler = null;
    this.yjsService = null;
    this.isShuttingDown = false;
  }

  /**
   * Initialize all components
   */
  async initialize() {
    try {
      // Initialize configuration
      this.config = new ServerConfig();
      this.config.validate();

      // Initialize logger
      this.logger = new Logger(this.config.get('logging'));
      this.logger.info('Starting Realtime YJS Server...');

      // Initialize managers (following dependency injection)
      this.connectionManager = new ConnectionManager(this.logger);
      this.documentManager = new DocumentManager(this.logger, this.config.get('yjs'));

      // Initialize handlers
      this.webSocketHandler = new WebSocketHandler(
        this.connectionManager,
        this.documentManager,
        this.logger
      );

      // Initialize services
      this.yjsService = new YjsService(
        this.connectionManager,
        this.documentManager,
        this.webSocketHandler,
        this.logger
      );

      // Initialize WebSocket server
      this.webSocketServer = new WebSocketServer(this.config, this.logger);
      this.webSocketServer.initialize();
      this.webSocketServer.setYjsService(this.yjsService);

      // Initialize WebSocket server
      const wss = this.webSocketServer.initializeWebSocket();

      // Initialize YJS service
      await this.yjsService.initialize();

      this.logger.info('All components initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize application', error);
      throw error;
    }
  }

  /**
   * Start the server
   */
  async start() {
    try {
      await this.webSocketServer.start();
      
      this.logger.info('Realtime YJS Server is running', {
        port: this.config.get('port'),
        host: this.config.get('host'),
        nodeEnv: process.env.NODE_ENV || 'development'
      });

      // Setup graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      this.logger.error('Failed to start server', error);
      throw error;
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const shutdownHandler = async (signal) => {
      if (this.isShuttingDown) {
        this.logger.warn('Shutdown already in progress, forcing exit');
        process.exit(1);
      }

      this.isShuttingDown = true;
      this.logger.info(`Received ${signal}, starting graceful shutdown...`);

      try {
        // Shutdown YJS service first (notifies clients)
        if (this.yjsService) {
          await this.yjsService.shutdown();
        }

        // Stop WebSocket server
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

    // Handle different shutdown signals
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception', error);
      shutdownHandler('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Rejection', reason, { promise });
      shutdownHandler('unhandledRejection');
    });
  }

  /**
   * Get server health status
   */
  getHealthStatus() {
    if (this.yjsService) {
      return this.yjsService.healthCheck();
    }
    return { status: 'unhealthy', message: 'Service not initialized' };
  }
}

/**
 * Main execution
 */
async function main() {
  const server = new RealtimeYjsServer();
  
  try {
    await server.initialize();
    await server.start();
  } catch (error) {
    // Use basic console.error for startup failures since logger might not be initialized
    console.error('Failed to start Realtime YJS Server:', error);
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  main();
}

module.exports = RealtimeYjsServer;
