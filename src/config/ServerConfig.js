class ServerConfig {
  constructor() {
    this.config = {
      port: process.env.PORT || 3000,
      host: process.env.HOST || '0.0.0.0',
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
        credentials: true
      },
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'combined'
      },
      yjs: {
        persistence: process.env.YJS_PERSISTENCE || false,
        gcEnabled: process.env.YJS_GC_ENABLED !== 'false',
        cleanupInterval: parseInt(process.env.YJS_CLEANUP_INTERVAL) || 300000,
        maxIdleTime: parseInt(process.env.YJS_MAX_IDLE_TIME) || 1800000
      },
      websocket: {
        pingTimeout: parseInt(process.env.WS_PING_TIMEOUT) || 30000,
        maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS) || 1000
      }
    };
  }

  get(key) {
    return key ? this.config[key] : this.config;
  }

  set(key, value) {
    this.config[key] = value;
  }

  validate() {
    const requiredFields = ['port', 'host'];
    const missing = requiredFields.filter(field => !this.config[field]);

    if (missing.length > 0) {
      throw new Error(`Missing required configuration fields: ${missing.join(', ')}`);
    }

    return true;
  }
}

module.exports = ServerConfig;
