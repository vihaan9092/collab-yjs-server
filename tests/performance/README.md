# Performance Test Suite

Professional performance testing for the Y.js Collaborative Server with realistic user simulation and accurate metrics.

## Quick Start

```bash
# Run standard performance test
npm run perf-test

# Run quick test (5 users, 30 seconds)
npm run perf-test:quick

# Run stress test (10 users, 90 seconds)
npm run perf-test:stress

# Run memory optimization test
npm run perf-test:memory
```

## Test Configuration

The performance test suite runs three different document sizes:

- **100KB Document**: 5 users, 60 seconds (standard load)
- **1.5MB Document**: 10 users, 90 seconds (medium load)  
- **2MB Document**: 10 users, 120 seconds (heavy load)

## Environment Variables

You can customize the tests using environment variables:

```bash
# Custom configuration
USER_COUNT=15 TEST_DURATION=60000 npm run perf-test

# Enable memory optimizations
ENABLE_OPTIMIZATIONS=true npm run perf-test

# Server URL (if not localhost:3000)
SERVER_URL=ws://your-server:3000 npm run perf-test
```

## Test Reports

Reports are automatically generated in `tests/performance/reports/`:

- Individual test reports: `{size}-test-report.json`
- Comprehensive report: `comprehensive-performance-report-{timestamp}.json`



## Test Components

- **ProfessionalTestSuite.js**: Main test runner
- **core/PerformanceCollector.js**: Metrics collection
- **core/TestUser.js**: User simulation
- **core/DocumentGenerator.js**: Document generation

## Performance Metrics

The test suite measures:

- **Latency**: Message round-trip time
- **Throughput**: Operations per second
- **Memory Usage**: Heap usage and GC activity
- **Reliability**: Success rate and error handling
- **Network**: WebSocket message statistics

## Recommendations

The test suite provides automatic performance recommendations:

- 🚨 Critical issues (immediate action required)
- ⚠️ High priority (should be addressed)
- 💡 Suggestions (nice to have improvements)

## Troubleshooting

**High Memory Usage**: Enable optimizations with `ENABLE_OPTIMIZATIONS=true`

**Connection Failures**: Ensure server is running on correct port

**Slow Performance**: Check Redis connection and enable debouncing

**Test Failures**: Review server logs and check authentication
