import { useState, useEffect, useCallback, useRef } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import Debug from '../utils/debug'
import {
  createSecureProviderConfig,
  validateTokenFormat,
  getWebSocketErrorInfo,
  forceCloseWebSocket
} from '../utils/secureWebSocket'

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
    Debug.yjs('Connection status changed', { status: event.status })

    // Use setTimeout to avoid setState during render
    setTimeout(() => {
      setConnectionStatus(event.status)

      if (event.status === 'connected') {
        setError(null)
        Debug.yjs('Connected to collaboration server')
      } else if (event.status === 'disconnected') {
        Debug.yjs('Disconnected from collaboration server')
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
      Debug.yjs('Connected users updated', { userCount: users.size })
    }, 0)
  }, [])

  // Error handler
  const handleError = useCallback((error) => {
    Debug.error('YJS', 'Provider error', error)

    // Use setTimeout to avoid setState during render
    setTimeout(() => {
      setError(error.message || 'Connection error')
    }, 0)
  }, [])

  // Initialize YJS document and provider
  const initializeProvider = useCallback(() => {
    if (!documentId || !token || !user) {
      Debug.yjs('Missing required parameters for initialization', { documentId: !!documentId, token: !!token, user: !!user })
      setError('Missing required parameters: documentId, token, or user')
      return
    }

    // Validate token format before proceeding
    if (!validateTokenFormat(token)) {
      Debug.error('YJS', 'Invalid token format')
      setError('Invalid authentication token format')
      return
    }

    // Validate user object
    if (!user.username || !user.user_id) {
      Debug.error('YJS', 'Invalid user object', user)
      setError('Invalid user information')
      return
    }

    try {
      // Create new YJS document first
      const newDoc = new Y.Doc()

      // newDoc.on('update', (update, origin) => {
      //     console.log('📝 [Y.js] Document changed!', {
      //       updateSize: update.length,
      //       updateBytes: Array.from(update),
      //       origin: origin,
      //       timestamp: new Date().toISOString()
      //     })
      //   })
    
      // Set document immediately so components can access it
      docRef.current = newDoc
      setDoc(newDoc)

      // Small delay to ensure document is fully ready
      setTimeout(() => {
        Debug.yjs('Connecting to collaboration server', { documentId, serverUrl: 'ws://localhost:3000' })
        Debug.yjs('Using secure subprotocol-based authentication')

        let newProvider
        try {
          const secureConfig = createSecureProviderConfig(token, {
            connect: true,
            resyncInterval: 5000
          })

          newProvider = new WebsocketProvider(
            'ws://localhost:3000',
            documentId,
            newDoc,
            secureConfig
          )

          // ADD THIS TO SEE WEBSOCKET MESSAGES:
          // newProvider.ws.addEventListener('message', (event) => {
          //   console.log('📡 [WebSocket] Received message:', {
          //     dataSize: event.data.size || event.data.length,
          //     timestamp: new Date().toISOString()
          //   })
          // })

          // // ADD THIS TO SEE OUTGOING MESSAGES:
          // const originalSend = newProvider.ws.send.bind(newProvider.ws)
          // newProvider.ws.send = function(data) {
          //   console.log('📤 [WebSocket] Sending message:', {
          //     dataSize: data.length,
          //     dataBytes: Array.from(new Uint8Array(data)),
          //     timestamp: new Date().toISOString()
          //   })
          //   return originalSend(data)
          // }
        } catch (error) {
          Debug.error('YJS', 'Failed to create WebSocket provider', error)
          setError(`Failed to create connection: ${error.message}`)
          return
        }

        providerRef.current = newProvider
        setProvider(newProvider)

        newProvider.on('status', handleConnectionStatus)
        newProvider.on('connection-error', handleError)

        newProvider.on('connection-close', (event) => {
          const errorInfo = getWebSocketErrorInfo(event)
          if (errorInfo.isAuthError || event.code !== 1000) {
            setError(errorInfo.userMessage)
          }
        })

        newProvider.on('disconnect', () => {
          Debug.yjs('Provider disconnected - all reconnections will use secure authentication')
        })

        if (newProvider.ws) {
          newProvider.ws.addEventListener('error', (event) => {
            Debug.error('YJS', 'WebSocket error', event)
            setError('WebSocket connection error')
          })

          newProvider.ws.addEventListener('close', (event) => {
            const errorInfo = getWebSocketErrorInfo(event)
            if (errorInfo.isAuthError || event.code !== 1000) {
              setError(errorInfo.userMessage)
            }
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
      Debug.yjs('Cleaning up provider and closing WebSocket connection')

      try {
        if (providerRef.current.ws) {
          forceCloseWebSocket(providerRef.current.ws, 'Provider cleanup')
        }

        providerRef.current.off('status', handleConnectionStatus)
        providerRef.current.off('connection-error', handleError)
        if (providerRef.current.awareness) {
          providerRef.current.awareness.off('change', handleAwarenessChange)
        }
        providerRef.current.destroy()
      } catch (error) {
        Debug.warn('YJS', 'Error during cleanup', error)
      }

      providerRef.current = null
      setProvider(null)
    }

    if (docRef.current) {
      try {
        docRef.current.destroy()
      } catch (error) {
        Debug.warn('YJS', 'Error destroying document', error)
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
    } else {
      cleanup()
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
