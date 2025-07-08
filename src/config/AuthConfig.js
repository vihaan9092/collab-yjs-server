/**
 * Authentication Configuration
 * Centralized configuration for authentication settings
 */

const AuthConfig = {
    // JWT Configuration
    jwt: {
        secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        algorithm: 'HS256',
        issuer: process.env.JWT_ISSUER || 'collaboration-server',
        audience: process.env.JWT_AUDIENCE || 'collaboration-clients'
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

    // Document Access Control
    documentAccess: {
        defaultAccess: process.env.DEFAULT_DOCUMENT_ACCESS !== 'false' // Default to allow access
    }
};



module.exports = AuthConfig;
