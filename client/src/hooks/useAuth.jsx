import { useState, useEffect, useCallback } from 'react'
import Debug from '../utils/debug'

const STORAGE_KEY = 'jwtToken'

export const useAuth = () => {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Clean token validation
  const isValidToken = useCallback((tokenString) => {
    if (!tokenString || typeof tokenString !== 'string') return false
    
    // Basic token length check
    if (tokenString.length < 10) {
      return false
    }

    // Basic JWT format check (header.payload.signature)
    const parts = tokenString.split('.')
    if (parts.length !== 3) return false

    try {
      // Decode payload to extract user info
      const payload = JSON.parse(atob(parts[1]))
      
      // Check if token is expired
      if (payload.exp && payload.exp < Date.now() / 1000) {
        return false
      }

      return { isValid: true, payload }
    } catch (e) {
      return false
    }
  }, [])

  // Load token from storage on mount
  useEffect(() => {
    const loadStoredToken = () => {
      try {
        const storedToken = localStorage.getItem(STORAGE_KEY)

        if (storedToken) {
          const validation = isValidToken(storedToken)
          if (validation && validation.isValid) {
            setToken(storedToken)
            setUser(validation.payload)
            setIsAuthenticated(true)
          } else {
            localStorage.removeItem(STORAGE_KEY)
          }
        }
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY)
      } finally {
        setIsLoading(false)
      }
    }

    loadStoredToken()
  }, [isValidToken])

  // Login function
  const login = useCallback((tokenString) => {
    setError(null)
    setIsLoading(true)

    try {
      const validation = isValidToken(tokenString)
      if (!validation || !validation.isValid) {
        throw new Error('Invalid token format')
      }

      // Store token
      localStorage.setItem(STORAGE_KEY, tokenString)
      setToken(tokenString)
      setUser(validation.payload)
      setIsAuthenticated(true)

      Debug.auth('Login successful', {
        username: validation.payload.username,
        userId: validation.payload.user_id || validation.payload.sub
      });

      return { success: true, user: validation.payload }
    } catch (e) {
      const errorMsg = e.message || 'Authentication failed'
      setError(errorMsg)
      Debug.auth('Login failed', { error: errorMsg });
      return { success: false, error: errorMsg }
    } finally {
      setIsLoading(false)
    }
  }, [isValidToken])

  // Logout function
  const logout = useCallback(() => {
    Debug.auth('User logout initiated - clearing authentication state')

    // Clear authentication state immediately
    localStorage.removeItem(STORAGE_KEY)
    setToken(null)
    setUser(null)
    setIsAuthenticated(false)
    setError(null)

    Debug.auth('Logout successful - WebSocket connections will be cleaned up');
  }, [])

  // Removed contaminated data cleanup - no longer needed

  return {
    token,
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout
  }
}
