/**
 * Test Utilities and Helpers
 * Common utilities for testing the realtime YJS server
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

/**
 * Create a test JWT token
 */
function createTestToken(payload = {}) {
  const defaultPayload = {
    user_id: 1,
    username: 'testuser',
    email: 'test@example.com',
    is_active: true,
    permissions: ['read', 'write'],
    exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign({ ...defaultPayload, ...payload }, process.env.JWT_SECRET);
}

/**
 * Create a test WebSocket connection
 */
function createTestWebSocket(url = 'ws://localhost:3000/test-doc', token = null) {
  const wsUrl = new URL(url);
  if (token) {
    wsUrl.searchParams.set('token', token);
  }
  
  return new WebSocket(wsUrl.toString());
}

/**
 * Wait for WebSocket to reach a specific state
 */
function waitForWebSocketState(ws, state, timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (ws.readyState === state) {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      reject(new Error(`WebSocket did not reach state ${state} within ${timeout}ms`));
    }, timeout);

    const checkState = () => {
      if (ws.readyState === state) {
        clearTimeout(timer);
        ws.removeEventListener('open', checkState);
        ws.removeEventListener('close', checkState);
        ws.removeEventListener('error', checkState);
        resolve();
      }
    };

    ws.addEventListener('open', checkState);
    ws.addEventListener('close', checkState);
    ws.addEventListener('error', checkState);
  });
}

/**
 * Create a mock logger for testing
 */
function createMockLogger() {
  const mockFn = () => {};
  return {
    info: mockFn,
    error: mockFn,
    warn: mockFn,
    debug: mockFn,
    http: mockFn
  };
}

/**
 * Create test server configuration
 */
function createTestConfig() {
  return {
    port: 0, // Use random available port
    host: 'localhost',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    logging: {
      level: 'error',
      format: 'simple'
    },
    yjs: {
      persistence: false,
      gcEnabled: true,
      cleanupInterval: 60000,
      maxIdleTime: 300000
    },
    websocket: {
      pingTimeout: 5000,
      maxConnections: 100
    }
  };
}

/**
 * Wait for a condition to be true
 */
function waitFor(condition, timeout = 5000, interval = 100) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      if (condition()) {
        resolve();
        return;
      }
      
      if (Date.now() - startTime > timeout) {
        reject(new Error(`Condition not met within ${timeout}ms`));
        return;
      }
      
      setTimeout(check, interval);
    };
    
    check();
  });
}

/**
 * Create a test document update
 */
function createTestUpdate() {
  // This would normally be a YJS update, but for testing we'll use a simple buffer
  return new Uint8Array([1, 2, 3, 4, 5]);
}

module.exports = {
  createTestToken,
  createTestWebSocket,
  waitForWebSocketState,
  createMockLogger,
  createTestConfig,
  waitFor,
  createTestUpdate
};
