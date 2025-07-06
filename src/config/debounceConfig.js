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
    console.warn(`DEBOUNCE_DELAY (${config.delay}ms) is less than minimum (${config.minDelay}ms). Using minimum.`);
    config.delay = config.minDelay;
  }

  if (config.maxDelay < config.delay) {
    console.warn(`DEBOUNCE_MAX_DELAY (${config.maxDelay}ms) is less than DEBOUNCE_DELAY (${config.delay}ms). Using delay * 3.`);
    config.maxDelay = config.delay * 3;
  }

  return config;
};

/**
 * Validate debouncing configuration
 * @param {Object} config - Configuration to validate
 * @returns {boolean} True if valid
 */
const validateDebounceConfig = (config) => {
  if (!config || typeof config !== 'object') {
    return false;
  }

  const requiredFields = ['enabled', 'delay', 'maxDelay', 'minDelay'];
  for (const field of requiredFields) {
    if (!(field in config)) {
      return false;
    }
  }

  if (typeof config.enabled !== 'boolean') {
    return false;
  }

  if (!Number.isInteger(config.delay) || config.delay < 0) {
    return false;
  }

  if (!Number.isInteger(config.maxDelay) || config.maxDelay < 0) {
    return false;
  }

  if (!Number.isInteger(config.minDelay) || config.minDelay < 0) {
    return false;
  }

  return true;
};

/**
 * Get recommended debouncing settings based on use case
 * @param {string} useCase - Use case ('typing', 'drawing', 'bulk-edit', 'real-time')
 * @returns {Object} Recommended configuration
 */
const getRecommendedConfig = (useCase = 'typing') => {
  const configs = {
    // For text editing (default)
    typing: {
      enabled: true,
      delay: 300,
      maxDelay: 1000,
      minDelay: 50,
    },
    
    // For drawing/graphics applications
    drawing: {
      enabled: true,
      delay: 100,
      maxDelay: 500,
      minDelay: 25,
    },
    
    // For bulk editing operations
    'bulk-edit': {
      enabled: true,
      delay: 500,
      maxDelay: 2000,
      minDelay: 100,
    },
    
    // For real-time applications requiring immediate updates
    'real-time': {
      enabled: false,
      delay: 0,
      maxDelay: 0,
      minDelay: 0,
    },
    
    // For high-performance scenarios
    performance: {
      enabled: true,
      delay: 200,
      maxDelay: 800,
      minDelay: 50,
    }
  };

  return configs[useCase] || configs.typing;
};

/**
 * Log debouncing configuration for debugging
 * @param {Object} config - Configuration to log
 * @param {Object} logger - Logger instance (optional)
 */
const logDebounceConfig = (config, logger = console) => {
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

/**
 * Calculate expected performance improvement
 * @param {Object} config - Debouncing configuration
 * @param {number} keystrokesPerSecond - Expected keystrokes per second
 * @returns {Object} Performance metrics
 */
const calculatePerformanceImprovement = (config, keystrokesPerSecond = 5) => {
  if (!config.enabled) {
    return {
      messageReduction: 0,
      bandwidthSaving: 0,
      description: 'Debouncing disabled - no performance improvement'
    };
  }

  // Estimate message reduction based on debounce delay
  const messagesPerSecondWithoutDebounce = keystrokesPerSecond * 2; // Assume 2 messages per keystroke
  const messagesPerSecondWithDebounce = Math.max(1, 1000 / config.delay);
  
  const messageReduction = Math.max(0, 
    ((messagesPerSecondWithoutDebounce - messagesPerSecondWithDebounce) / messagesPerSecondWithoutDebounce) * 100
  );

  // Estimate bandwidth saving (assuming average message size of 100 bytes)
  const avgMessageSize = 100;
  const bandwidthSavingBytes = (messagesPerSecondWithoutDebounce - messagesPerSecondWithDebounce) * avgMessageSize;
  const bandwidthSavingKB = bandwidthSavingBytes / 1024;

  return {
    messageReduction: Math.round(messageReduction),
    bandwidthSaving: Math.round(bandwidthSavingKB * 100) / 100,
    messagesPerSecondBefore: messagesPerSecondWithoutDebounce,
    messagesPerSecondAfter: messagesPerSecondWithDebounce,
    description: `${Math.round(messageReduction)}% fewer messages, ${Math.round(bandwidthSavingKB * 100) / 100}KB/s bandwidth saved`
  };
};

module.exports = {
  getDebounceConfig,
  validateDebounceConfig,
  getRecommendedConfig,
  logDebounceConfig,
  calculatePerformanceImprovement
};
