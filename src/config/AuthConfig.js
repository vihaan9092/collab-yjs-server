const AuthConfig = {
    jwt: {
        secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        algorithm: 'HS256',
        issuer: process.env.JWT_ISSUER || 'collaboration-server',
        audience: process.env.JWT_AUDIENCE || 'collaboration-clients'
    },

    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'collab:',
        ttl: {
            userSession: parseInt(process.env.REDIS_USER_TTL) || 900,
            documentAccess: parseInt(process.env.REDIS_ACCESS_TTL) || 300,
            tokenBlacklist: parseInt(process.env.REDIS_BLACKLIST_TTL) || 86400
        }
    },

    documentAccess: {
        defaultAccess: process.env.DEFAULT_DOCUMENT_ACCESS !== 'false'
    }
};

module.exports = AuthConfig;
