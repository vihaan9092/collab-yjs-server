import { useState, useEffect, useCallback, useRef } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import Debug from '../utils/debug'

export const useYjsProvider = (documentId, token, user) => {
  const [provider, setProvider] = useState(null)
  const [doc, setDoc] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [connectedUsers, setConnectedUsers] = useState(new Map())
  const [error, setError] = useState(null)
  
  // Use refs to prevent stale closures
  const providerRef = useRef(null)
  const docRef = useRef(null)

  // Connection status handler
  const handleConnectionStatus = useCallback((event) => {
    console.log('[YJS] Connection status changed:', event.status)

    // Use setTimeout to avoid setState during render
    setTimeout(() => {
      setConnectionStatus(event.status)

      if (event.status === 'connected') {
        setError(null)
        console.log('[YJS] ✅ Connected to collaboration server')
      } else if (event.status === 'disconnected') {
        console.log('[YJS] ❌ Disconnected from collaboration server')
      }
    }, 0)
  }, [])

  // Awareness change handler
  const handleAwarenessChange = useCallback(() => {
    if (!providerRef.current?.awareness) return

    const awareness = providerRef.current.awareness
    const users = new Map()

    awareness.getStates().forEach((state, clientId) => {
      if (state.user && clientId !== awareness.clientID) {
        users.set(clientId, {
          name: state.user.name,
          color: state.user.color,
          cursor: state.cursor
        })
      }
    })

    // Use setTimeout to avoid setState during render
    setTimeout(() => {
      setConnectedUsers(users)
      console.log('[YJS] Connected users updated:', users.size)
    }, 0)
  }, [])

  // Error handler
  const handleError = useCallback((error) => {
    console.error('[YJS] Provider error:', error)

    // Use setTimeout to avoid setState during render
    setTimeout(() => {
      setError(error.message || 'Connection error')
    }, 0)
  }, [])

  // Initialize YJS document and provider
  const initializeProvider = useCallback(() => {
    if (!documentId || !token || !user) {
      console.log('[YJS] Missing required parameters for initialization')
      return
    }

    try {
      // Create new YJS document first
      const newDoc = new Y.Doc()
      console.log('[YJS] YJS document created')

      // Set document immediately so components can access it
      docRef.current = newDoc
      setDoc(newDoc)

      // Small delay to ensure document is fully ready
      setTimeout(() => {
        // Create WebSocket provider with authentication
        // Best practice: Use 'params' option if y-websocket >= 1.4.0
        console.log('[YJS] Connecting to: ws://localhost:3000 for document:', documentId)
        console.log('[YJS] Token:', token ? token.substring(0, 50) + '...' : 'none')

        const newProvider = new WebsocketProvider(
          'ws://localhost:3000',      // Just the origin, no document ID or query
          documentId,                 // Document ID, gets added as path
          newDoc,
          { params: { token } }       // y-websocket auto-appends as query param
        )

        providerRef.current = newProvider
        setProvider(newProvider)

        // Set up event listeners
        newProvider.on('status', handleConnectionStatus)
        newProvider.on('connection-error', handleError)

        // Add more detailed error handling
        newProvider.on('connection-close', (event) => {
          console.log('[YJS] Connection closed:', event)
        })

        // Listen to the underlying WebSocket events
        if (newProvider.ws) {
          newProvider.ws.addEventListener('error', (event) => {
            console.error('[YJS] WebSocket error:', event)
          })

          newProvider.ws.addEventListener('close', (event) => {
            console.log('[YJS] WebSocket closed:', event.code, event.reason)
          })
        }

        // Set up awareness after provider is created
        if (newProvider.awareness) {
          newProvider.awareness.on('change', handleAwarenessChange)

          // Set initial awareness state
          newProvider.awareness.setLocalStateField('user', {
            name: user.username,
            color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
            id: user.user_id
          })
        }

        Debug.yjs('Provider initialized successfully', {
          documentId,
          hasAwareness: !!newProvider.awareness,
          connectionStatus: newProvider.ws?.readyState
        });
      }, 100) // Small delay to ensure document is ready

    } catch (error) {
      setError(error.message)
      Debug.yjs('Provider initialization failed', { error: error.message });
    }
  }, [documentId, token, user, handleConnectionStatus, handleError, handleAwarenessChange])

  // Cleanup function
  const cleanup = useCallback(() => {
    if (providerRef.current) {
      console.log('[YJS] Cleaning up provider')
      
      try {
        providerRef.current.off('status', handleConnectionStatus)
        providerRef.current.off('connection-error', handleError)
        if (providerRef.current.awareness) {
          providerRef.current.awareness.off('change', handleAwarenessChange)
        }
        providerRef.current.destroy()
      } catch (error) {
        console.warn('[YJS] Error during cleanup:', error)
      }
      
      providerRef.current = null
      setProvider(null)
    }

    if (docRef.current) {
      try {
        docRef.current.destroy()
      } catch (error) {
        console.warn('[YJS] Error destroying document:', error)
      }
      
      docRef.current = null
      setDoc(null)
    }

    setConnectionStatus('disconnected')
    setConnectedUsers(new Map())
    setError(null)
  }, [handleConnectionStatus, handleError, handleAwarenessChange])

  // Initialize provider when dependencies change
  useEffect(() => {
    if (documentId && token && user) {
      cleanup() // Clean up any existing provider
      initializeProvider()
    }

    return cleanup
  }, [documentId, token, user, initializeProvider, cleanup])

  // Cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  return {
    provider,
    doc,
    connectionStatus,
    connectedUsers,
    error,
    isConnected: connectionStatus === 'connected',
    cleanup
  }
}
