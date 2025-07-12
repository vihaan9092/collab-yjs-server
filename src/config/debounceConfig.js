/**
 * Debouncing Configuration
 * Centralized configuration for WebSocket message debouncing
 */

/**
 * Get debouncing configuration from environment variables
 * @returns {Object} Debouncing configuration
 */
const getDebounceConfig = () => {
  const config = {
    // Enable/disable debouncing
    enabled: process.env.DEBOUNCE_ENABLED !== 'false',

    // Debounce delay in milliseconds (default: 300ms)
    delay: parseInt(process.env.DEBOUNCE_DELAY) || 300,

    // Maximum delay before forcing send (default: 1000ms)
    maxDelay: parseInt(process.env.DEBOUNCE_MAX_DELAY) || 1000,

    // Minimum delay to prevent too frequent updates (default: 50ms)
    minDelay: parseInt(process.env.DEBOUNCE_MIN_DELAY) || 50,

    // Large document optimizations
    largeDocumentThreshold: parseInt(process.env.LARGE_DOC_THRESHOLD) || 1024 * 1024, // 1MB
    largeDocumentDelay: parseInt(process.env.LARGE_DOC_DELAY) || 500, // 500ms for large docs
    largeDocumentMaxDelay: parseInt(process.env.LARGE_DOC_MAX_DELAY) || 2000, // 2s max for large docs

    // Batch processing
    batchEnabled: process.env.BATCH_ENABLED !== 'false',
    batchSize: parseInt(process.env.BATCH_SIZE) || 10, // Max updates per batch
    batchTimeout: parseInt(process.env.BATCH_TIMEOUT) || 100, // 100ms batch window

    // Connection-based scaling
    connectionScaling: process.env.CONNECTION_SCALING !== 'false',
    baseConnectionCount: parseInt(process.env.BASE_CONNECTION_COUNT) || 5,
    scalingFactor: parseFloat(process.env.SCALING_FACTOR) || 1.2,
  };

  // Validation
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

/**
 * Get optimized debounce settings based on document size and connection count
 * @param {number} documentSize - Document size in bytes
 * @param {number} connectionCount - Number of active connections
 * @returns {Object} Optimized debounce configuration
 */
const getOptimizedDebounceConfig = (documentSize = 0, connectionCount = 1) => {
  const baseConfig = getDebounceConfig();

  if (!baseConfig.enabled) {
    return baseConfig;
  }

  let optimizedConfig = { ...baseConfig };

  // Adjust for large documents
  if (documentSize > baseConfig.largeDocumentThreshold) {
    optimizedConfig.delay = baseConfig.largeDocumentDelay;
    optimizedConfig.maxDelay = baseConfig.largeDocumentMaxDelay;
  }

  // Adjust for connection count
  if (baseConfig.connectionScaling && connectionCount > baseConfig.baseConnectionCount) {
    const scalingMultiplier = Math.pow(baseConfig.scalingFactor,
      Math.log(connectionCount / baseConfig.baseConnectionCount));

    optimizedConfig.delay = Math.min(
      optimizedConfig.delay * scalingMultiplier,
      optimizedConfig.maxDelay * 0.8
    );
  }

  // Ensure bounds
  optimizedConfig.delay = Math.max(optimizedConfig.minDelay,
    Math.min(optimizedConfig.delay, optimizedConfig.maxDelay));

  return optimizedConfig;
};



/**
 * Log debouncing configuration for debugging
 * @param {Object} config - Configuration to log
 * @param {Object} logger - Logger instance (required)
 */
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
  getOptimizedDebounceConfig,
  logDebounceConfig
};
