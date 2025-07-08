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
  };

  // Validation
  if (config.delay < config.minDelay) {
    config.delay = config.minDelay;
  }

  if (config.maxDelay < config.delay) {
    config.maxDelay = config.delay * 3;
  }

  return config;
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
  logDebounceConfig
};
