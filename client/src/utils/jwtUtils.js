// JWT utility functions for the client

export const generateTestToken = (username, userId, permissions = ['read', 'write']) => {
  // This mimics the server's JWT generation for testing
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  }

  const payload = {
    user_id: userId,
    username: username,
    email: `${username}@example.com`,
    permissions: permissions,
    iss: 'collaboration-server',
    aud: 'collaboration-clients',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  }

  // Note: This is for demo purposes only
  // In production, tokens should only be generated server-side
  const encodedHeader = btoa(JSON.stringify(header))
  const encodedPayload = btoa(JSON.stringify(payload))
  
  // Mock signature (in real app, this would be generated server-side with secret)
  const mockSignature = btoa(`mock-signature-${username}-${Date.now()}`)
  
  return `${encodedHeader}.${encodedPayload}.${mockSignature}`
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

// Predefined test users with real server-generated tokens
export const TEST_USERS = [
  {
    username: 'user1',
    userId: 1,
    permissions: ['read', 'write'],
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6InVzZXIxIiwiZW1haWwiOiJ1c2VyMUBleGFtcGxlLmNvbSIsInBlcm1pc3Npb25zIjpbInJlYWQiLCJ3cml0ZSJdLCJpc3MiOiJjb2xsYWJvcmF0aW9uLXNlcnZlciIsImF1ZCI6ImNvbGxhYm9yYXRpb24tY2xpZW50cyIsImlhdCI6MTc1MTgyMTc3NSwiZXhwIjoxNzUxOTA4MTc1fQ.WZS21Ur-pRFkQklN6eej2vJKxZSbYFxW-T6mvdSsjkM'
  },
  {
    username: 'user2',
    userId: 2,
    permissions: ['read', 'write'],
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyLCJ1c2VybmFtZSI6InVzZXIyIiwiZW1haWwiOiJ1c2VyMkBleGFtcGxlLmNvbSIsInBlcm1pc3Npb25zIjpbInJlYWQiLCJ3cml0ZSJdLCJpc3MiOiJjb2xsYWJvcmF0aW9uLXNlcnZlciIsImF1ZCI6ImNvbGxhYm9yYXRpb24tY2xpZW50cyIsImlhdCI6MTc1MTgyMTc3NSwiZXhwIjoxNzUxOTA4MTc1fQ.jHpTsqb0NuIFr-QzjLUu-JrCSTWCV6QjilWzh_Yeys8'
  },
  {
    username: 'user3',
    userId: 3,
    permissions: ['read', 'write'],
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjozLCJ1c2VybmFtZSI6InVzZXIzIiwiZW1haWwiOiJ1c2VyM0BleGFtcGxlLmNvbSIsInBlcm1pc3Npb25zIjpbInJlYWQiLCJ3cml0ZSJdLCJpc3MiOiJjb2xsYWJvcmF0aW9uLXNlcnZlciIsImF1ZCI6ImNvbGxhYm9yYXRpb24tY2xpZW50cyIsImlhdCI6MTc1MTgyMTc3NSwiZXhwIjoxNzUxOTA4MTc1fQ._VA09lb5zWK0dsINqFl343IIgXrDNKMsiXqLOIqHwTg'
  }
]
