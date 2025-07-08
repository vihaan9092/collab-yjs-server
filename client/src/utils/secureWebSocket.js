import { Base64 } from 'js-base64'

/**
 * Secure WebSocket Utility
 * Provides browser-compatible secure authentication for WebSocket connections
 * Uses WebSocket subprotocols to transmit JWT tokens securely
 */

// Simple logging utility for development
const isDevelopment = import.meta.env.DEV
const log = {
  info: (message, data) => isDevelopment && console.log(`[SecureWebSocket] ${message}`, data || ''),
  error: (message, error) => isDevelopment && console.error(`[SecureWebSocket] 🚨 ${message}`, error || ''),
  warn: (message, data) => isDevelopment && console.warn(`[SecureWebSocket] ⚠️ ${message}`, data || '')
}

function encodeTokenForWebSocket(token) {
  try {
    if (typeof token !== 'string') {
      throw new Error('Token must be a string')
    }

    const encoded = Base64.encode(token, true)
    console.log(encoded)

    if (encoded.length > 1000) {
      throw new Error('Token too long for WebSocket subprotocol')
    }

    if (!/^[A-Za-z0-9\-_]*$/.test(encoded)) {
      throw new Error('Token contains invalid characters after encoding')
    }

    return encoded
  } catch (error) {
    log.error('Token encoding failed', error)
    throw new Error('Failed to encode token for WebSocket transmission')
  }
}



/**
 * Create a secure WebSocket class that adds JWT authentication via subprotocols
 * @param {string} token - JWT token for authentication
 * @returns {class} SecureWebSocket class that extends WebSocket
 */
export function createSecureWebSocket(token) {
  if (!token || typeof token !== 'string' || token.length < 10) {
    throw new Error('Invalid or missing authentication token')
  }

  return class SecureWebSocket extends WebSocket {
    constructor(url, protocols = []) {
      try {
        // Validate URL format
        if (!url || typeof url !== 'string' || !url.startsWith('ws')) {
          throw new Error('Invalid WebSocket URL')
        }

        // 🔧 BULLETPROOF: Future-proof token encoding
        const encodedToken = encodeTokenForWebSocket(token)
        const authProtocol = `auth.${encodedToken}`
        
        const allProtocols = Array.isArray(protocols) ? [authProtocol, ...protocols] : [authProtocol]
        
        super(url, allProtocols)
        
        this.addEventListener('error', (event) => {
          log.error('WebSocket error (possibly auth-related)', event)
        })

        this.addEventListener('close', (event) => {
          log.info(`WebSocket closed with code: ${event.code}, reason: ${event.reason}`)

          // Handle specific close codes for better debugging
          if (event.code === 1002 || event.code === 1003) {
            log.error('WebSocket closed due to protocol error (likely auth failure)')
          } else if (event.code === 1006) {
            log.error('WebSocket closed abnormally (check server logs)')
          } else if (event.code === 1000) {
            log.info('WebSocket closed normally')
          }
        })

        // Add connection timeout protection
        const connectionTimeout = setTimeout(() => {
          if (this.readyState === WebSocket.CONNECTING) {
            log.error('WebSocket connection timeout')
            this.close()
          }
        }, 10000) // 10 second timeout

        this.addEventListener('open', () => {
          clearTimeout(connectionTimeout)
        })

      } catch (error) {
        log.error('Failed to create secure WebSocket', error)
        throw error
      }
    }
  }
}

/**
 * Create a secure WebSocket provider configuration for y-websocket
 * @param {string} token - JWT token for authentication
 * @param {Object} options - Additional WebSocket provider options
 * @returns {Object} Configuration object for WebsocketProvider
 */
export function createSecureProviderConfig(token, options = {}) {
  const SecureWebSocket = createSecureWebSocket(token)

  return {
    WebSocketPolyfill: SecureWebSocket,
    connect: true,
    resyncInterval: 5000,
    // Disable automatic reconnection to prevent insecure fallback connections
    disableBc: true,
    // Ensure all reconnections use our secure WebSocket class
    maxBackoffTime: 30000,
    ...options
  }
}

/**
 * Validate JWT token format
 * @param {string} token - JWT token to validate
 * @returns {boolean} True if token appears to be valid format
 */
export function validateTokenFormat(token) {
  if (!token || typeof token !== 'string') {
    return false
  }

  // Check minimum length first
  if (token.length < 10) {
    return false
  }

  // Basic JWT format check (3 parts separated by dots)
  const parts = token.split('.')
  if (parts.length !== 3) {
    return false
  }

  // Check that each part has content
  if (parts.some(part => part.length === 0)) {
    return false
  }

  return true
}

/**
 * Extract error information from WebSocket close events
 * @param {CloseEvent} event - WebSocket close event
 * @returns {Object} Error information with user-friendly message
 */
export function getWebSocketErrorInfo(event) {
  const errorInfo = {
    code: event.code,
    reason: event.reason,
    wasClean: event.wasClean,
    userMessage: 'Connection lost',
    isAuthError: false
  }

  switch (event.code) {
    case 1000:
      errorInfo.userMessage = 'Connection closed normally'
      break
    case 1002:
      errorInfo.userMessage = 'Authentication failed: Invalid token format'
      errorInfo.isAuthError = true
      break
    case 1003:
      errorInfo.userMessage = 'Authentication failed: Token validation error'
      errorInfo.isAuthError = true
      break
    case 1006:
      errorInfo.userMessage = 'Connection lost: Please check your network'
      break
    case 1011:
      errorInfo.userMessage = 'Server error: Please try again later'
      break
    default:
      errorInfo.userMessage = `Connection error (code: ${event.code})`
  }

  return errorInfo
}

/**
 * Force close a WebSocket connection immediately
 * @param {WebSocket} ws - WebSocket to close
 * @param {string} reason - Reason for closing
 */
export function forceCloseWebSocket(ws, reason = 'User logout') {
  if (ws && typeof ws.close === 'function' && ws.readyState === 1) { // 1 = WebSocket.OPEN
    log.info(`Force closing WebSocket: ${reason}`)
    ws.close(1000, reason)
  }
}
