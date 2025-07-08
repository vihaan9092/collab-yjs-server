# Realtime YJS Server

A production-ready real-time collaborative text editor server built with YJS, WebSocket, and Redis. Enables multiple users to edit documents simultaneously with conflict-free synchronization, intelligent performance optimization, and comprehensive monitoring.

## Features

### Core Collaboration
- Real-time multi-user document editing
- Conflict-free synchronization using YJS CRDT technology
- User presence and cursor tracking
- Automatic document persistence

### Performance Optimization
- Intelligent debouncing reduces WebSocket messages by up to 80%
- Configurable performance settings for different use cases
- Comprehensive performance testing and monitoring suite
- Scalable architecture with Redis-based cross-instance synchronization

### Security & Infrastructure
- JWT-based authentication with Redis session management
- Docker containerization with health checks
- Graceful shutdown handling
- Production-ready logging and monitoring

## Architecture

```
┌─────────────────┐    JWT Token    ┌──────────────────────────────────┐
│   Client App    │ ──────────────► │  Realtime YJS Server             │
│                 │                 │  ┌─────────────────────────────┐ │
└─────────────────┘                 │  │ • YJS Document Management   │ │
                                    │  │ • Intelligent Debouncing    │ │
                                    │  │ • Performance Monitoring    │ │
                                    │  │ • Redis Session Management  │ │
                                    │  └─────────────────────────────┘ │
                                    └──────────────────────────────────┘
                                                     │
                                        WebSocket Connection
                                        (Optimized with Debouncing)
                                                     │
                                    ┌──────────────────────────────────┐
                                    │   React Client                   │
                                    │   (Tiptap Editor)                │
                                    └──────────────────────────────────┘
```

### System Components

- **YJS Service**: Document synchronization orchestrator
- **WebSocket Server**: Real-time communication with Express integration
- **Connection Manager**: WebSocket connection lifecycle management
- **Document Manager**: YJS document lifecycle and Redis synchronization
- **Redis Sync**: Cross-instance document synchronization via Pub/Sub
- **Performance Monitor**: Real-time metrics and load analysis

## Quick Start

### Prerequisites

- Node.js 22.7.0+
- Docker and Docker Compose
- Redis 7.4+ (included in Docker setup)

### Installation

```bash
git clone <your-repo-url>
cd realtime_yjs_server

# Copy environment configuration
cp .env.example .env

# Install dependencies
npm install
```

### Configuration

Copy and edit the environment configuration:

```bash
cp .env.example .env
```

Configure your JWT secret, Redis URL, and other settings in the `.env` file.

### Running the Server

#### Docker (Recommended)
```bash
# Development mode with hot reloading
make build && make run

# Background mode
make build && make run-detached

# Production mode
make prod-build && make prod-run
```

#### Local Development
```bash
# Start Redis
redis-server

# Start the server
npm run dev
```

### Access Points

- **Client Interface**: http://localhost:3001/
- **Health Check**: http://localhost:3000/health
- **API Statistics**: http://localhost:3000/api/stats

## Docker Commands

### Development Commands
```bash
# Build and run with hot reloading
make build && make run

# Run in background
make run-detached

# View logs
make logs

# Stop services
make stop

# Access container shell
make shell

# Check health
make health

# Clean up
make clean
```

### Debug Commands

For VS Code debugging with breakpoints and step-through debugging:

```bash
# Start debug server (waits for debugger to attach)
make vscodedebug
```

**VS Code Debug Setup:**

1. **Start the debug server:**
   ```bash
   make vscodedebug
   ```

2. **Attach VS Code debugger:**
   - Open VS Code
   - Go to Run and Debug (Ctrl+Shift+D / Cmd+Shift+D)
   - Select "Attach to Node.js (Docker)" from the dropdown
   - Click the green play button or press F5

3. **Set breakpoints:**
   - Click in the gutter next to line numbers in your source files
   - The debugger will pause execution when breakpoints are hit

4. **Debug features available:**
   - Step through code (F10 = step over, F11 = step into, Shift+F11 = step out)
   - Inspect variables in the Variables panel
   - Evaluate expressions in the Debug Console
   - View call stack and loaded scripts

**Debug Configuration Details:**
- **Debug Port:** localhost:9229
- **Application Port:** localhost:3000
- **Source Maps:** Automatically mapped between local and container paths
- **Auto-restart:** Debugger reconnects automatically when code changes

**Alternative: Local Debugging**
You can also debug locally without Docker by selecting "Debug Node.js (Local)" configuration, but you'll need Redis running locally.

### Production Commands
```bash
# Build production image
make prod-build

# Run production services
make prod-run

# Run in background
make prod-run-detached

# View production logs
make prod-logs

# Stop production services
make prod-stop
```

## Authentication

The server uses JWT-based authentication with Redis session management.

### JWT Token Structure

```javascript
{
  "sub": "user-id",
  "username": "user-name",
  "permissions": ["read", "write"],
  "iat": 1234567890,
  "exp": 1234567890
}
```

### Client Integration

```javascript
// 🔐 SECURE: WebSocket connection with header-based authentication
import { WebsocketProvider } from 'y-websocket'

// Custom WebSocket class that adds Authorization header
class SecureWebSocket extends WebSocket {
  constructor(url, protocols) {
    const options = {
      headers: {
        'Authorization': `Bearer ${jwtToken}`
      }
    };
    super(url, protocols, options);
  }
}

// Create provider with secure authentication
const provider = new WebsocketProvider(
  'ws://localhost:3000',
  documentId,
  doc,
  { WebSocketPolyfill: SecureWebSocket }
);

// HTTP requests
const response = await fetch('/api/stats', {
  headers: {
    'Authorization': `Bearer ${jwtToken}`
  }
});
```

### Token Generation

For testing, use the included token generator:

```bash
node generate-test-token.js
```

## API Endpoints

### Health Check
```
GET /health
```
Returns server health status and configuration.

**Response:**
```json
{
  "status": "healthy",
  "uptime": 3600,
  "memory": {...},
  "stats": {...},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Statistics
```
GET /api/stats
```
Returns real-time server statistics.

**Response:**
```json
{
  "connections": {
    "total": 5,
    "byDocument": {...}
  },
  "documents": {
    "total": 2,
    "redisSync": {...}
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Document Information
```
GET /api/documents/:documentId
```
Returns specific document information and active connections.

## Performance Features

- **Intelligent Debouncing**: Reduces WebSocket messages by up to 80%
- **Redis Synchronization**: Enables horizontal scaling across multiple instances
- **Connection Management**: Efficient WebSocket connection lifecycle handling
- **Built-in Monitoring**: Performance metrics and health checks

## Configuration

The server is configured through environment variables in the `.env` file. See `.env.example` for all available configuration options including server settings, authentication, Redis, performance optimization, security, and logging.

## Troubleshooting

**Connection Issues**: Verify server is running with `curl http://localhost:3000/health`

**Authentication Errors**: Check JWT_SECRET consistency and token validity

**Sync Issues**: Verify WebSocket connection and document ID consistency

**Debug Logging**: Set `LOG_LEVEL=debug` in `.env` and check logs with `make logs`

## Production Deployment

### Security Considerations

- Use strong JWT secrets in production
- Enable HTTPS in production environments
- Configure proper CORS origins
- Use Redis with authentication
- Monitor and log authentication attempts

### Docker Deployment

```bash
# Production build and deployment
make prod-build && make prod-run

# Check health
make health
```

## Documentation

Additional documentation available in the `docs/` directory:

- **Debouncing Implementation**: Detailed guide on WebSocket debouncing
- **Performance Testing**: Comprehensive testing documentation
- **Configuration Examples**: See `.env.example` for all options

---

**Built with YJS, WebSocket, Redis, and intelligent performance optimization**