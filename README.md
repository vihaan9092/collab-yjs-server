# 🚀 Tiptap Collaborative Editor Server

A high-performance real-time collaborative rich text editor server built with **Tiptap**, **YJS**, and **WebSocket** technology. This server enables multiple users to edit documents simultaneously with real-time synchronization, intelligent debouncing, and comprehensive performance monitoring.

## ✨ Features

### 🔥 Core Collaboration
- **Real-time Collaboration**: Multiple users can edit the same document simultaneously
- **Rich Text Editing**: Full-featured editor with formatting, lists, links, and more
- **Conflict Resolution**: Automatic conflict resolution using YJS CRDT technology
- **User Presence**: See other users' cursors and selections in real-time
- **Document Persistence**: Documents are automatically saved and synchronized

### ⚡ Performance & Optimization
- **Intelligent Debouncing**: Reduces WebSocket messages by up to 80% during rapid typing
- **Configurable Performance**: Environment-based debouncing configuration
- **Performance Monitoring**: Comprehensive testing suite for WebSocket and Redis load analysis
- **Scalable Architecture**: Optimized for high concurrent user loads

### 🔐 Security & Infrastructure
- **JWT Authentication**: Secure authentication with JWT tokens
- **Docker Support**: Easy deployment with Docker Compose and comprehensive Makefile
- **Redis Integration**: Efficient caching and session management
- **WebSocket Communication**: Optimized real-time communication with debouncing

## 🏗️ Architecture

This server is designed to work alongside your existing Django application with optimized performance and monitoring:

```
┌─────────────────┐    JWT Token    ┌──────────────────────────────────┐
│   Django App    │ ──────────────► │  Collaborative Editor Server     │
│   (Your App)    │                 │  ┌─────────────────────────────┐ │
└─────────────────┘                 │  │ • YJS Document Management   │ │
                                    │  │ • Intelligent Debouncing    │ │
                                    │  │ • Performance Monitoring    │ │
                                    │  │ • Redis Session Management  │ │
                                    │  └─────────────────────────────┘ │
                                    └──────────────────────────────────┘
                                                     │
                                        Optimized WebSocket Connection
                                        (Debounced Updates)
                                                     │
                                    ┌──────────────────────────────────┐
                                    │   Client Browsers                │
                                    │   (React + Tiptap Editor)       │
                                    └──────────────────────────────────┘
```

### 🔧 System Components

- **YJS Service**: Document synchronization with intelligent debouncing
- **WebSocket Server**: Real-time communication with performance optimization
- **Redis Cache**: Session management and document persistence
- **Performance Monitor**: Real-time metrics and load analysis
- **Authentication**: JWT-based secure user authentication

## 🚀 Quick Start

### Prerequisites

- Node.js 22.7.0+
- Docker (optional, for containerized deployment)
- Redis 7.4+ (for caching and session management)

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd realtime_y_socket_yjs_servert

# If using nvm, switch to the correct Node.js version
nvm use

# Install dependencies
npm install
```

### 2. Environment Configuration

Copy the example environment file and customize it:

```bash
cp .env.example .env
```

Edit the `.env` file with your settings:

```env
# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h

# Django Integration (Your Django Server)
DJANGO_API_URL=http://localhost:8000
DJANGO_API_TIMEOUT=5000

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=collab:

# Performance Optimization (NEW)
DEBOUNCE_ENABLED=true
DEBOUNCE_DELAY=300
DEBOUNCE_MAX_DELAY=1000

# Security Settings
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000
CORS_ENABLED=true

# Logging
LOG_LEVEL=info
ENABLE_AUTH_LOGS=true
```

### 3. Build the Tiptap Bundle

```bash
npm run build:bundle
```

### 4. Start the Server

#### Development Mode
```bash
npm run dev
```

#### Production Mode
```bash
npm start
```

#### Docker Mode (Recommended)
```bash
# Build and run with Docker Compose (Node.js 22.7.0 + Redis 7.4)
docker-compose up --build -d

# Or use the comprehensive Makefile
make build
make run

# Or use the shortcut
make rebuild
```

### 5. Access the Editor

Open your browser and navigate to:
- **Editor Interface**: http://localhost:3000/
- **Health Check**: http://localhost:3000/health
- **API Stats**: http://localhost:3000/api/stats
- **Performance Metrics**: Available through performance testing suite

## 🔧 Docker Commands

The project includes a comprehensive Makefile and Docker Compose setup for container management:

### Docker Compose (Recommended)
```bash
# Start all services (app + Redis)
docker-compose up -d

# Build and start with latest changes
docker-compose up --build -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Scale the application
docker-compose up --scale app=2 -d
```

### Makefile Commands
```bash
# Build the Docker image
make build

# Run the container
make run

# Rebuild and run (useful during development)
make rebuild

# View container logs
make logs

# Follow logs in real-time
make logs-follow

# Check container status
make status

# Stop and remove container
make clean

# Remove everything (container + image)
make clean-all

# Open shell in running container
make shell

# Check application health
make health
```

## 🔐 Authentication Integration

This server is designed to work with your existing Django authentication system:

### 1. Django Setup

In your Django application, create JWT tokens for authenticated users:

```python
from rest_framework_simplejwt.tokens import RefreshToken

def get_collaboration_token(user):
    refresh = RefreshToken.for_user(user)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user_id': user.id,
        'username': user.username
    }
```

### 2. Client Integration

Pass the JWT token to the collaborative editor:

```javascript
// In your Django template or frontend
const token = "{{ collaboration_token }}";
const userId = "{{ user.username }}";

// Redirect to collaborative editor with authentication
window.location.href = `http://localhost:3000/?token=${token}&user=${userId}`;
```

### 3. WebSocket Connection

The client automatically connects to the WebSocket server with authentication:

```javascript
const wsUrl = `ws://localhost:3000/${documentId}?token=${encodeURIComponent(authToken)}`;
```

## 📝 API Endpoints

### Health Check
```
GET /health
```
Returns server health status, debouncing configuration, and basic information.

### Statistics
```
GET /api/stats
```
Returns real-time server statistics including:
- Active connections and documents
- WebSocket message frequency
- Redis performance metrics
- Debouncing effectiveness

### Document Information
```
GET /api/documents/:documentId
```
Returns information about a specific document including:
- Document metadata
- Active user count
- Debouncing status
- Performance metrics

## 🎨 Editor Features

The collaborative editor includes:

- **Text Formatting**: Bold, italic, underline, strikethrough
- **Headings**: H1-H6 support
- **Lists**: Bullet and numbered lists
- **Text Alignment**: Left, center, right, justify
- **Colors**: Text color and highlighting
- **Links**: Insert and edit links
- **Code**: Inline code formatting
- **Blockquotes**: Quote formatting
- **Superscript/Subscript**: Mathematical notation
- **Real-time Cursors**: See other users' positions
- **Markdown Shortcuts**: Type `# ` for headings, `- ` for lists, etc.

## 🔧 Configuration

### Server Configuration

The server can be configured through environment variables or the configuration files in `src/config/`:

- `ServerConfig.js`: Basic server settings
- `AuthConfig.js`: Authentication and security settings
- `debounceConfig.js`: Performance optimization settings

### Key Configuration Options

```javascript
// Server Settings
PORT=3000                    // Server port
HOST=0.0.0.0                // Server host

// Authentication
JWT_SECRET=your-secret       // JWT signing secret
JWT_EXPIRES_IN=24h          // Token expiration

// Redis
REDIS_URL=redis://localhost:6379  // Redis connection
REDIS_KEY_PREFIX=collab:          // Key prefix for Redis

// Performance Optimization (NEW)
DEBOUNCE_ENABLED=true       // Enable intelligent debouncing
DEBOUNCE_DELAY=300          // Debounce delay in milliseconds
DEBOUNCE_MAX_DELAY=1000     // Maximum delay before forced update

// Security
MAX_CONNECTIONS_PER_USER=5   // Max connections per user
RATE_LIMIT_MAX=100          // Rate limiting
ALLOWED_ORIGINS=*           // CORS origins
```

### Performance Configuration

#### Debouncing Settings
| Use Case | DEBOUNCE_DELAY | DEBOUNCE_MAX_DELAY | Description |
|----------|----------------|-------------------|-------------|
| **Text Editing** | 300ms | 1000ms | Optimal for typing (default) |
| **Drawing/Graphics** | 100ms | 500ms | Lower latency for visual feedback |
| **Bulk Operations** | 500ms | 2000ms | Higher batching for efficiency |
| **Real-time Critical** | 0ms (disabled) | N/A | Immediate updates required |

## 🐛 Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check if the server is running on the correct port
   - Verify JWT token is valid and not expired
   - Check CORS settings in configuration
   - Verify debouncing configuration is not causing delays

2. **Authentication Errors**
   - Ensure JWT_SECRET matches between Django and this server
   - Verify token format and expiration
   - Check Redis connection for session caching

3. **Document Not Syncing**
   - Check WebSocket connection status
   - Verify document ID is consistent across clients
   - Check server logs for YJS errors
   - Verify debouncing is not causing excessive delays

4. **Performance Issues**
   - Run performance tests: `npm run perf-test:quick`
   - Check debouncing configuration
   - Monitor Redis performance
   - Verify WebSocket message frequency

### Debugging

Enable debug logging:

```env
LOG_LEVEL=debug
ENABLE_AUTH_LOGS=true
```

Check logs and performance:
```bash
# Docker logs with debouncing status
docker logs realtime-yjs-server --tail 20

# Follow logs in real-time
make logs-follow

# Run performance analysis
npm run perf-test:quick

# Local development
npm run dev
```

### Performance Debugging

```bash
# Check debouncing effectiveness
grep -i debounce logs/server.log

# Monitor WebSocket message frequency
npm run perf-test:quick

# Analyze Redis performance
docker logs realtime-yjs-redis --tail 10
```

## 🚀 Production Deployment

### Environment Variables

Set these environment variables for production:

```env
NODE_ENV=production
JWT_SECRET=your-production-secret-key
DJANGO_API_URL=https://your-django-app.com
REDIS_URL=redis://your-redis-server:6379
ALLOWED_ORIGINS=https://your-domain.com
```

### Docker Deployment

```bash
# Build production image with optimizations
docker-compose build

# Run with production environment
docker-compose up -d

# Check health and performance
make health
docker logs realtime-yjs-server --tail 20
```

### Performance Optimization for Production

```bash
# Enable debouncing for optimal performance
DEBOUNCE_ENABLED=true
DEBOUNCE_DELAY=300
DEBOUNCE_MAX_DELAY=1000

# Monitor performance
npm run perf-test:quick
```

### Security Considerations

- Use strong JWT secrets in production
- Enable HTTPS in production environments
- Configure proper CORS origins
- Use Redis with authentication
- Monitor and log authentication attempts
- Regular performance testing to ensure optimal debouncing settings

## 📊 Performance Testing & Monitoring

### Comprehensive Performance Testing Suite

The server includes a comprehensive performance testing suite to analyze WebSocket load and Redis usage:

```bash
# Run full performance test (20 users, 60 seconds)
npm run perf-test

# Run quick test (10 users, 30 seconds)
npm run perf-test:quick

# Custom configuration
USER_COUNT=20 TEST_DURATION=60000 npm run perf-test
```

### Performance Metrics

The testing suite provides detailed analysis of:

#### WebSocket Load Analysis
- **Message Frequency**: Messages per keystroke ratio
- **Data Transfer**: Total bandwidth usage
- **Connection Stability**: Error rates and latency
- **Debouncing Effectiveness**: Performance improvement metrics

#### Redis Performance Analysis
- **Command Frequency**: Commands per second
- **Memory Usage**: Memory consumption patterns
- **Connection Management**: Peak connections and efficiency
- **Key Distribution**: Storage pattern analysis

### Monitoring Endpoints

- `/health` - Health check with debouncing status
- `/api/stats` - Real-time statistics with performance metrics
- Logs are written to `logs/` directory with performance data
- WebSocket connection metrics with debouncing effectiveness
- Redis performance monitoring with detailed command analysis

### Performance Results

With debouncing enabled, the system achieves:
- **Up to 80% reduction** in WebSocket message frequency
- **Significant bandwidth savings** during rapid typing
- **Improved server performance** under high load
- **Better scalability** for concurrent users

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 📚 Documentation

### Additional Resources

- **[Debouncing Implementation Guide](docs/DEBOUNCING.md)**: Detailed guide on WebSocket debouncing
- **[Performance Testing Suite](tests/performance/README.md)**: Comprehensive performance testing documentation
- **Configuration Examples**: See `.env.example` for all available options

### Performance Optimization

For optimal performance:
1. Enable debouncing in production: `DEBOUNCE_ENABLED=true`
2. Run regular performance tests: `npm run perf-test:quick`
3. Monitor WebSocket message frequency
4. Adjust debouncing parameters based on use case

## 🆘 Support

For issues and questions:

1. Check the troubleshooting section above
2. Review server logs for error messages and debouncing status
3. Run performance tests to identify bottlenecks
4. Verify configuration settings including debouncing parameters
5. Test with minimal setup first
6. Check the comprehensive documentation in the `docs/` folder

## 🎯 Key Performance Features

- **Intelligent Debouncing**: Up to 80% reduction in WebSocket messages
- **Comprehensive Testing**: Built-in performance testing suite
- **Real-time Monitoring**: Live performance metrics and analysis
- **Scalable Architecture**: Optimized for high concurrent user loads
- **Production Ready**: Docker Compose setup with Redis integration

---

**Built with ❤️ using Tiptap, YJS, WebSocket technology, and intelligent performance optimization**