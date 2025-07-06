/**
 * Authentication Configuration
 * Centralized configuration for authentication settings
 */

const AuthConfig = {
    // JWT Configuration
    jwt: {
        secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        algorithm: 'HS256',
        issuer: process.env.JWT_ISSUER || 'collaboration-server',
        audience: process.env.JWT_AUDIENCE || 'collaboration-clients'
    },

    // Document Access Control
    documentAccess: {
        defaultAccess: process.env.DEFAULT_DOCUMENT_ACCESS !== 'false', // Default to allow access
        cacheTimeout: 300 // 5 minutes
    },

    // Redis Configuration
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'collab:',
        ttl: {
            userSession: parseInt(process.env.REDIS_USER_TTL) || 900, // 15 minutes
            documentAccess: parseInt(process.env.REDIS_ACCESS_TTL) || 300, // 5 minutes
            tokenBlacklist: parseInt(process.env.REDIS_BLACKLIST_TTL) || 86400 // 24 hours
        }
    },

    // Security Settings
    security: {
        maxConnectionsPerUser: parseInt(process.env.MAX_CONNECTIONS_PER_USER) || 5,
        rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000, // 1 minute
        rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100,
        allowedOrigins: process.env.ALLOWED_ORIGINS ? 
            process.env.ALLOWED_ORIGINS.split(',') : 
            ['http://localhost:3000', 'http://localhost:8000'],
        requireHttps: process.env.NODE_ENV === 'production',
        corsEnabled: process.env.CORS_ENABLED !== 'false'
    },

    // Document Access Control
    documents: {
        defaultPermissions: ['read'],
        adminPermissions: ['read', 'write', 'delete', 'share'],
        editorPermissions: ['read', 'write'],
        viewerPermissions: ['read'],
        maxDocumentSize: parseInt(process.env.MAX_DOCUMENT_SIZE) || 10485760, // 10MB
        autoSaveInterval: parseInt(process.env.AUTO_SAVE_INTERVAL) || 30000 // 30 seconds
    },

    // Logging Configuration
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        enableAuthLogs: process.env.ENABLE_AUTH_LOGS !== 'false',
        enableAccessLogs: process.env.ENABLE_ACCESS_LOGS !== 'false',
        logFailedAttempts: process.env.LOG_FAILED_ATTEMPTS !== 'false'
    },

    // Environment-specific settings
    development: {
        enableDebugMode: true,
        skipTokenValidation: false,
        mockDjangoApi: false,
        verboseLogging: true
    },

    production: {
        enableDebugMode: false,
        skipTokenValidation: false,
        mockDjangoApi: false,
        verboseLogging: false,
        requireSecureConnections: true
    },

    // Feature Flags
    features: {
        enableTokenRefresh: process.env.ENABLE_TOKEN_REFRESH !== 'false',
        enableUserPresence: process.env.ENABLE_USER_PRESENCE !== 'false',
        enableDocumentLocking: process.env.ENABLE_DOCUMENT_LOCKING === 'true',
        enableAuditLogging: process.env.ENABLE_AUDIT_LOGGING === 'true',
        enableRateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false'
    }
};

/**
 * Get configuration based on current environment
 * @returns {Object} Environment-specific configuration
 */
AuthConfig.getConfig = function() {
    const env = process.env.NODE_ENV || 'development';
    const baseConfig = { ...this };
    
    // Remove helper functions from config
    delete baseConfig.getConfig;
    delete baseConfig.validateConfig;
    
    // Merge environment-specific settings
    if (this[env]) {
        Object.assign(baseConfig, this[env]);
    }
    
    return baseConfig;
};

/**
 * Validate configuration settings
 * @returns {Array} Array of validation errors
 */
AuthConfig.validateConfig = function() {
    const errors = [];
    
    // Validate JWT secret
    if (!this.jwt.secret || this.jwt.secret === 'your-super-secret-jwt-key-change-in-production') {
        errors.push('JWT_SECRET must be set to a secure value in production');
    }
    
    // Validate Django API URL
    if (!this.django.apiUrl) {
        errors.push('DJANGO_API_URL must be configured');
    }
    
    // Validate Redis URL
    if (!this.redis.url) {
        errors.push('REDIS_URL must be configured');
    }
    
    // Validate security settings for production
    if (process.env.NODE_ENV === 'production') {
        if (!this.security.requireHttps) {
            errors.push('HTTPS should be required in production');
        }
        
        if (this.security.allowedOrigins.includes('http://localhost:3000')) {
            errors.push('Localhost origins should not be allowed in production');
        }
    }
    
    return errors;
};

module.exports = AuthConfig;
