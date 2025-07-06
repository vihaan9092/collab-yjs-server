/**
 * Basic Test to verify Jest setup
 */

describe('Basic Test Suite', () => {
  test('should pass basic test', () => {
    expect(1 + 1).toBe(2);
  });

  test('should verify environment variables are set', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.LOG_LEVEL).toBe('error');
    expect(process.env.AUTH_TEST_MODE).toBe('true');
  });

  test('should be able to require main modules', () => {
    expect(() => {
      require('../../src/config/ServerConfig');
    }).not.toThrow();

    expect(() => {
      require('../../src/utils/Logger');
    }).not.toThrow();
  });
});
