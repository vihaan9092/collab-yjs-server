#!/usr/bin/env node

/**
 * JWT Token Generator for Testing
 * Generates test JWT tokens for the collaborative editor
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Generate a test JWT token
 * @param {Object} payload - Token payload
 * @returns {string} JWT token
 */
function generateTestToken(payload = {}) {
    const defaultPayload = {
        user_id: payload.user_id || Math.floor(Math.random() * 1000) + 1,
        username: payload.username || `testuser${Math.floor(Math.random() * 100)}`,
        email: payload.email || `test${Math.floor(Math.random() * 100)}@example.com`,
        permissions: payload.permissions || ['read', 'write'],
        iss: 'collaboration-server',
        aud: 'collaboration-clients'
    };

    const finalPayload = { ...defaultPayload, ...payload };

    return jwt.sign(finalPayload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN
    });
}

/**
 * Verify a JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token or error
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return { error: error.message };
    }
}

// Command line interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
        case 'generate':
        case 'gen':
            const username = args[1] || `testuser${Math.floor(Math.random() * 100)}`;
            const userId = args[2] || Math.floor(Math.random() * 1000) + 1;
            const permissions = args[3] ? args[3].split(',') : ['read', 'write'];

            const token = generateTestToken({
                username: username,
                user_id: parseInt(userId),
                email: `${username}@example.com`,
                permissions: permissions
            });

            const decoded = jwt.decode(token);

            break;

        case 'readonly':
        case 'read':
            const readUsername = args[1] || `reader${Math.floor(Math.random() * 100)}`;
            const readUserId = args[2] || Math.floor(Math.random() * 1000) + 1;

            const readToken = generateTestToken({
                username: readUsername,
                user_id: parseInt(readUserId),
                email: `${readUsername}@example.com`,
                permissions: ['read'] // Only read permission
            });

            const readDecoded = jwt.decode(readToken);

            break;

        case 'verify':
            const tokenToVerify = args[1];
            if (!tokenToVerify) {
                console.error('❌ Please provide a token to verify');
                console.log('Usage: node generate-test-token.js verify <token>');
                process.exit(1);
            }
            
            const result = verifyToken(tokenToVerify);
            if (result.error) {
                console.log('❌ Token verification failed:');
                console.log(result.error);
            } else {
                console.log('✅ Token is valid:');
                console.log(JSON.stringify(result, null, 2));
            }
            break;

        case 'bulk':
            const count = parseInt(args[1]) || 5;
            
            for (let i = 1; i <= count; i++) {
                const username = `user${i}`;
                const token = generateTestToken({
                    username: username,
                    user_id: i,
                    email: `${username}@example.com`
                });
                
            }
            break;

        case 'help':
        case '--help':
        case '-h':
        default:
            console.log('\n🎫 JWT Token Generator for Collaborative Editor');
            console.log('━'.repeat(50));
            console.log('\nUsage:');
            console.log('  node generate-test-token.js generate [username] [userId] [permissions]');
            console.log('  node generate-test-token.js readonly [username] [userId]');
            console.log('  node generate-test-token.js verify <token>');
            console.log('  node generate-test-token.js bulk [count]');
            console.log('  node generate-test-token.js help');
            console.log('\nExamples:');
            console.log('  node generate-test-token.js generate alice 123');
            console.log('  node generate-test-token.js generate bob 456 read,write');
            console.log('  node generate-test-token.js generate editor 789 read,write,admin');
            console.log('  node generate-test-token.js readonly viewer 101');
            console.log('  node generate-test-token.js bulk 3');
            console.log('  node generate-test-token.js verify eyJhbGciOiJIUzI1NiIs...');
            console.log('\nShortcuts:');
            console.log('  gen = generate');
            console.log('  read = readonly');
            console.log('\nPermissions:');
            console.log('  read - Can view documents');
            console.log('  write - Can edit documents');
            console.log('  edit - Same as write');
            console.log('  admin - Full access');
            console.log('  * - Wildcard (all permissions)');
            console.log('\nEnvironment Variables:');
            console.log('  JWT_SECRET - Secret key for signing tokens (default: "your-super-secret-jwt-key-change-in-production")');
            console.log('  JWT_EXPIRES_IN - Token expiration time (default: "24h")');
            console.log('');
            break;
    }
}

module.exports = {
    generateTestToken,
    verifyToken
};
