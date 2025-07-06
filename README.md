# 🚀 Tiptap Collaborative Editor Server

A real-time collaborative rich text editor server built with **Tiptap**, **YJS**, and **WebSocket** technology. This server enables multiple users to edit documents simultaneously with real-time synchronization and conflict resolution.

## ✨ Features

- **Real-time Collaboration**: Multiple users can edit the same document simultaneously
- **Rich Text Editing**: Full-featured editor with formatting, lists, links, and more
- **Conflict Resolution**: Automatic conflict resolution using YJS CRDT technology
- **User Presence**: See other users' cursors and selections in real-time
- **JWT Authentication**: Secure authentication with JWT tokens
- **Docker Support**: Easy deployment with Docker and Makefile commands
- **WebSocket Communication**: Efficient real-time communication
- **Document Persistence**: Documents are automatically saved and synchronized

## 🏗️ Architecture

This server is designed to work alongside your existing Django application:

```
┌─────────────────┐    JWT Token    ┌──────────────────────┐
│   Django App    │ ──────────────► │  Collaborative       │
│   (Your App)    │                 │  Editor Server       │
└─────────────────┘                 │  (This Project)      │
                                    └──────────────────────┘
                                             │
                                    WebSocket Connection
                                             │
                                    ┌──────────────────────┐
                                    │   Client Browsers    │
                                    │   (Tiptap Editor)    │
                                    └──────────────────────┘
```

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

#### Docker Mode
```bash
# Build and run with Docker (Node.js 22.7.0 + Redis 7.4)
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

## 🔧 Docker Commands

The project includes a comprehensive Makefile for Docker management:

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
Returns server health status and basic information.

### Statistics
```
GET /api/stats
```
Returns real-time server statistics including active connections and documents.

### Document Information
```
GET /api/documents/:documentId
```
Returns information about a specific document.

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

// Security
MAX_CONNECTIONS_PER_USER=5   // Max connections per user
RATE_LIMIT_MAX=100          // Rate limiting
ALLOWED_ORIGINS=*           // CORS origins
```

## 🐛 Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check if the server is running on the correct port
   - Verify JWT token is valid and not expired
   - Check CORS settings in configuration

2. **Authentication Errors**
   - Ensure JWT_SECRET matches between Django and this server
   - Verify token format and expiration
   - Check Redis connection for session caching

3. **Document Not Syncing**
   - Check WebSocket connection status
   - Verify document ID is consistent across clients
   - Check server logs for YJS errors

### Debugging

Enable debug logging:

```env
LOG_LEVEL=debug
ENABLE_AUTH_LOGS=true
```

Check logs:
```bash
# Docker logs
make logs-follow

# Local development
npm run dev
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
# Build production image
make build

# Run with production environment
make run

# Check health
make health
```

### Security Considerations

- Use strong JWT secrets in production
- Enable HTTPS in production environments
- Configure proper CORS origins
- Use Redis with authentication
- Monitor and log authentication attempts

## 📊 Monitoring

The server provides several monitoring endpoints:

- `/health` - Basic health check
- `/api/stats` - Real-time statistics
- Logs are written to `logs/` directory
- WebSocket connection metrics available

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For issues and questions:

1. Check the troubleshooting section above
2. Review server logs for error messages
3. Verify configuration settings
4. Test with minimal setup first

---

**Built with ❤️ using Tiptap, YJS, and WebSocket technology**