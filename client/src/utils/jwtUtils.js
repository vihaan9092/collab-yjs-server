// JWT Configuration - should match backend AuthConfig
const JWT_CONFIG = {
  secret: 'your-super-secret-jwt-key-change-in-production', // Should match backend JWT_SECRET
  expiresIn: 24 * 60 * 60, // 24 hours in seconds
  algorithm: 'HS256',
  issuer: 'collaboration-server',
  audience: 'collaboration-clients'
}

// Browser-compatible HMAC-SHA256 implementation
async function hmacSha256(key, data) {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(key)
  const messageData = encoder.encode(data)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
  return new Uint8Array(signature)
}

// Base64URL encoding (JWT standard)
function base64UrlEncode(data) {
  if (data instanceof Uint8Array) {
    // Convert Uint8Array to base64
    const binary = String.fromCharCode(...data)
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  } else {
    // Convert string to base64
    return btoa(JSON.stringify(data))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }
}

export const generateTestToken = async (username, userId, permissions = ['read', 'write']) => {
  const now = Math.floor(Date.now() / 1000)

  const header = {
    alg: JWT_CONFIG.algorithm,
    typ: 'JWT'
  }

  const payload = {
    user_id: userId,
    username: username,
    email: `${username}@example.com`,
    permissions: permissions,
    iss: JWT_CONFIG.issuer,
    aud: JWT_CONFIG.audience,
    iat: now,
    exp: now + JWT_CONFIG.expiresIn
  }

  // Create the token parts
  const encodedHeader = base64UrlEncode(header)
  const encodedPayload = base64UrlEncode(payload)
  const data = `${encodedHeader}.${encodedPayload}`

  // Generate HMAC signature
  const signature = await hmacSha256(JWT_CONFIG.secret, data)
  const encodedSignature = base64UrlEncode(signature)

  return `${data}.${encodedSignature}`
}

export const decodeToken = (token) => {
  try {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid token')
    }

    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new Error('Invalid token format')
    }

    const header = JSON.parse(atob(parts[0]))
    const payload = JSON.parse(atob(parts[1]))

    return {
      header,
      payload,
      isExpired: payload.exp && payload.exp < Date.now() / 1000
    }
  } catch (e) {
    throw new Error(`Token decode failed: ${e.message}`)
  }
}

export const isTokenExpired = (token) => {
  try {
    const decoded = decodeToken(token)
    return decoded.isExpired
  } catch (e) {
    return true
  }
}

export const getTokenUser = (token) => {
  try {
    const decoded = decodeToken(token)
    return decoded.payload
  } catch (e) {
    return null
  }
}

// Validate token format and basic structure
export const validateTokenFormat = (token) => {
  try {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Token must be a string' }
    }

    const parts = token.split('.')
    if (parts.length !== 3) {
      return { valid: false, error: 'Token must have 3 parts separated by dots' }
    }

    // Try to decode header and payload
    const decoded = decodeToken(token)

    // Check required fields
    const payload = decoded.payload
    if (!payload.user_id && !payload.sub) {
      return { valid: false, error: 'Token missing user ID' }
    }

    if (!payload.username) {
      return { valid: false, error: 'Token missing username' }
    }

    if (decoded.isExpired) {
      return { valid: false, error: 'Token is expired' }
    }

    return {
      valid: true,
      payload: payload,
      expiresAt: new Date(payload.exp * 1000)
    }
  } catch (error) {
    return { valid: false, error: `Token validation failed: ${error.message}` }
  }
}

// Generate test users with dynamically created tokens
const generateTestUsers = async () => {
  const users = [
    { username: 'user1', userId: 1, permissions: ['read', 'write'] },
    { username: 'user2', userId: 2, permissions: ['read', 'write'] },
    { username: 'user3', userId: 3, permissions: ['read', 'write'] },
    { username: 'admin', userId: 4, permissions: ['read', 'write', 'admin'] },
    { username: 'viewer', userId: 5, permissions: ['read'] }
  ]

  const usersWithTokens = await Promise.all(
    users.map(async user => ({
      ...user,
      token: await generateTestToken(user.username, user.userId, user.permissions)
    }))
  )

  return usersWithTokens
}

// Function to get test users (async)
export const getTestUsers = async () => {
  return await generateTestUsers()
}

// Function to generate a fresh set of test users (useful for refreshing tokens)
export const refreshTestUsers = async () => {
  return await generateTestUsers()
}

// For backward compatibility, provide a synchronous version with pre-generated tokens
// These will be replaced with dynamically generated ones when the component loads
export const TEST_USERS = [
  { username: 'user1', userId: 1, permissions: ['read', 'write'], token: 'loading...' },
  { username: 'user2', userId: 2, permissions: ['read', 'write'], token: 'loading...' },
  { username: 'user3', userId: 3, permissions: ['read', 'write'], token: 'loading...' },
  { username: 'admin', userId: 4, permissions: ['read', 'write', 'admin'], token: 'loading...' },
  { username: 'viewer', userId: 5, permissions: ['read'], token: 'loading...' }
]
