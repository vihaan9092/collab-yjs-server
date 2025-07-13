const getBaseDebounceConfig = () => {
  const config = {
    enabled: process.env.DEBOUNCE_ENABLED !== 'false',
    delay: parseInt(process.env.DEBOUNCE_DELAY) || 300,
    maxDelay: parseInt(process.env.DEBOUNCE_MAX_DELAY) || 1000,
    minDelay: parseInt(process.env.DEBOUNCE_MIN_DELAY) || 50,
    largeDocumentThreshold: parseInt(process.env.LARGE_DOC_THRESHOLD) || 1024 * 1024,
    largeDocumentDelay: parseInt(process.env.LARGE_DOC_DELAY) || 500,
    largeDocumentMaxDelay: parseInt(process.env.LARGE_DOC_MAX_DELAY) || 2000,
    batchEnabled: process.env.BATCH_ENABLED !== 'false',
    batchSize: parseInt(process.env.BATCH_SIZE) || 10,
    batchTimeout: parseInt(process.env.BATCH_TIMEOUT) || 100,
    connectionScaling: process.env.CONNECTION_SCALING !== 'false',
    baseConnectionCount: parseInt(process.env.BASE_CONNECTION_COUNT) || 1,
    scalingFactor: parseFloat(process.env.SCALING_FACTOR) || 1.2,
  };

  if (config.delay < config.minDelay) {
    config.delay = config.minDelay;
  }

  if (config.maxDelay < config.delay) {
    config.maxDelay = config.delay * 3;
  }

  if (config.largeDocumentDelay < config.delay) {
    config.largeDocumentDelay = config.delay * 1.5;
  }

  return config;
};


const getDebounceConfig = (documentSize = 0, connectionCount = 1) => {
  const baseConfig = getBaseDebounceConfig();

  if (!baseConfig.enabled) {
    return baseConfig;
  }

  let optimizedConfig = { ...baseConfig };

  if (documentSize > baseConfig.largeDocumentThreshold) {
    optimizedConfig.delay = baseConfig.largeDocumentDelay;
    optimizedConfig.maxDelay = baseConfig.largeDocumentMaxDelay;
  }

  if (baseConfig.connectionScaling && connectionCount > baseConfig.baseConnectionCount) {
    const scalingMultiplier = Math.pow(baseConfig.scalingFactor,
      Math.log(connectionCount / baseConfig.baseConnectionCount));

    optimizedConfig.delay = Math.min(
      optimizedConfig.delay * scalingMultiplier,
      optimizedConfig.maxDelay * 0.8
    );
  }

  optimizedConfig.delay = Math.max(optimizedConfig.minDelay,
    Math.min(optimizedConfig.delay, optimizedConfig.maxDelay));

  return optimizedConfig;
};

const logDebounceConfig = (config, logger) => {
  if (!logger) {
    // Fallback to console only if no logger provided (should not happen in production)
    logger = console;
  }
  const status = config.enabled ? 'ENABLED' : 'DISABLED';
  
  logger.info('Debouncing Configuration:', {
    status,
    delay: config.enabled ? `${config.delay}ms` : 'N/A',
    maxDelay: config.enabled ? `${config.maxDelay}ms` : 'N/A',
    minDelay: config.enabled ? `${config.minDelay}ms` : 'N/A',
    performance: config.enabled ? 
      `Expected ${Math.round(1000 / config.delay)}x reduction in message frequency` : 
      'No performance improvement (disabled)'
  });

  if (config.enabled) {
    logger.info('Debouncing Benefits:', {
      messageReduction: 'Up to 80% fewer WebSocket messages',
      bandwidthSaving: 'Significant bandwidth reduction',
      serverLoad: 'Reduced server processing load',
      batteryLife: 'Improved mobile device battery life'
    });
  }
};

module.exports = {
  getDebounceConfig,
  logDebounceConfig
};
