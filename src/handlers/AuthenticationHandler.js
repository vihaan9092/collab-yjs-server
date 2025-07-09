const AuthMiddleware = require('../middleware/AuthMiddleware');
const AuthConfig = require('../config/AuthConfig');
const TokenDecoder = require('../utils/TokenDecoder');

class AuthenticationHandler {
  constructor(logger) {
    this.logger = logger;
    this.authMiddleware = new AuthMiddleware({
      jwtSecret: AuthConfig.jwt.secret,
      redisUrl: AuthConfig.redis.url
    });
    this.tokenDecoder = new TokenDecoder(logger);
  }

  extractToken(request) {
    let token = request.headers.authorization;
    if (token && token.startsWith('Bearer ')) {
      return token.substring(7);
    }

    if (request.headers['sec-websocket-protocol']) {
      const protocols = request.headers['sec-websocket-protocol'].split(',').map(p => p.trim());
      const authProtocol = protocols.find(p => p.startsWith('auth.'));
      if (authProtocol) {
        try {
          const encodedToken = authProtocol.substring(5);
          return this.tokenDecoder.decodeTokenFromWebSocket(encodedToken);
        } catch (error) {
          this.logger.error('Failed to decode token from subprotocol', error, {
            authProtocol,
            service: 'authentication-handler'
          });
          return null;
        }
      }
    }

    return null;
  }

  async validateAndCreateUser(token) {
    try {
      if (!token || token.length < 10) {
        this.logger.warn('Token validation failed: token too short', {
          tokenLength: token?.length || 0,
          service: 'authentication-handler'
        });
        return null;
      }

      const userInfo = await this.authMiddleware.validateToken(token);
      if (!userInfo) {
        this.logger.warn('Token validation failed: invalid token', {
          tokenLength: token.length,
          service: 'authentication-handler'
        });
        return null;
      }

      userInfo.token = token;
      const user = await this.authMiddleware.createUserFromJWT(userInfo);
      if (!user || !user.isActive) {
        this.logger.warn('User creation failed: user not found or inactive', {
          userId: userInfo.userId,
          service: 'authentication-handler'
        });
        return null;
      }

      return user;
    } catch (error) {
      this.logger.error('Authentication failed', error, {
        service: 'authentication-handler'
      });
      return null;
    }
  }

  async authenticateWebSocketUpgrade(request) {
    const result = {
      success: false,
      user: null,
      token: null,
      error: null,
      statusCode: 401
    };

    try {
      const token = this.extractToken(request);

      this.logger.debug('WebSocket authentication attempt', {
        url: request.url,
        hasToken: !!token,
        tokenLength: token ? token.length : 0,
        hasAuthHeader: !!request.headers.authorization,
        hasSubprotocol: !!request.headers['sec-websocket-protocol'],
        authMethod: token ? (request.headers.authorization ? 'header' : 'subprotocol') : 'none',
        service: 'authentication-handler'
      });

      if (!token) {
        result.error = 'Authentication token required in Authorization header or WebSocket subprotocol';
        result.statusCode = 401;
        this.logger.warn(`No token provided in WebSocket connection - URL: ${request.url}`);
        return result;
      }

      const user = await this.validateAndCreateUser(token);
      if (!user) {
        result.error = 'Invalid or expired token';
        result.statusCode = 401;
        return result;
      }

      result.success = true;
      result.user = user;
      result.token = token;

      this.logger.info('WebSocket authentication successful', {
        userId: user.id,
        username: user.username,
        email: user.email,
        permissions: user.permissions,
        authMethod: request.headers.authorization ? 'header' : 'subprotocol',
        documentPath: request.url,
        service: 'authentication-handler'
      });

      return result;
    } catch (error) {
      result.error = 'Authentication error';
      result.statusCode = 500;
      this.logger.error('WebSocket authentication failed', error, {
        service: 'authentication-handler'
      });
      return result;
    }
  }

  getAuthMiddleware() {
    return this.authMiddleware;
  }
}

module.exports = AuthenticationHandler;
