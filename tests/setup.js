/**
 * Test Setup and Configuration
 * Sets up the testing environment for the realtime YJS server
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
process.env.AUTH_TEST_MODE = 'true';
process.env.JWT_SECRET = 'test-secret-key';
process.env.REDIS_URL = 'redis://localhost:6379/1'; // Use test database

// Mock Redis for tests that don't need real Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1),
    flushdb: jest.fn().mockResolvedValue('OK')
  }));
});

// Global test timeout
if (typeof jest !== 'undefined') {
  jest.setTimeout(30000);
}

// Clean up after each test
if (typeof afterEach !== 'undefined') {
  afterEach(async () => {
    // Clear any timers
    if (typeof jest !== 'undefined') {
      jest.clearAllTimers();

      // Clear any mocks
      jest.clearAllMocks();
    }
  });
}

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in tests, just log
});

module.exports = {
  testTimeout: 30000,
  setupFilesAfterEnv: [__filename]
};
