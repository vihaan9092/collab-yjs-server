const Y = require('yjs');
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');
const map = require('lib0/map');
const { getDebounceConfig, logDebounceConfig } = require('../config/debounceConfig');
const Logger = require('./Logger');

// Initialize logger for y-websocket utilities
const logger = new Logger({ service: 'y-websocket-utils' });

// Dynamic imports for ES modules
let syncProtocol, awarenessProtocol;

// Initialize ES modules
const initializeModules = async () => {
  if (!syncProtocol || !awarenessProtocol) {
    try {
      // In test environment, use mocked modules
      if (process.env.NODE_ENV === 'test') {
        syncProtocol = require('y-protocols/sync.js');
        awarenessProtocol = require('y-protocols/awareness.js');
      } else {
        syncProtocol = await import('y-protocols/sync.js');
        awarenessProtocol = await import('y-protocols/awareness.js');
      }
    } catch (error) {
      // Fallback for test environment
      if (process.env.NODE_ENV === 'test') {
        syncProtocol = {
          writeUpdate: () => {},
          readSyncMessage: () => {},
          writeSyncStep1: () => {}
        };
        awarenessProtocol = {
          Awareness: class MockAwareness {
            constructor() {
              this.setLocalState = () => {};
              this.on = () => {};
              this.getStates = () => new Map();
            }
          },
          encodeAwarenessUpdate: () => new Uint8Array(),
          applyAwarenessUpdate: () => {},
          removeAwarenessStates: () => {}
        };
      } else {
        throw error;
      }
    }
  }
};

// WebSocket ready states
const wsReadyStateConnecting = 0;
const wsReadyStateOpen = 1;
const wsReadyStateClosing = 2;
const wsReadyStateClosed = 3;

// Message types
const messageSync = 0;
const messageAwareness = 1;

// Global document storage
const docs = new Map();

// Document creation locks to prevent race conditions
const documentLocks = new Map();

// DocumentManager instance for Redis sync integration
let documentManager = null;

/**
 * Set the DocumentManager instance for Redis sync integration
 * @param {Object} manager - DocumentManager instance
 */
const setDocumentManager = (manager) => {
  documentManager = manager;
};

// Ping timeout for connection health check
const pingTimeout = 30000;

/**
 * WSSharedDoc extends Y.Doc with WebSocket-specific functionality
 */
class WSSharedDoc extends Y.Doc {
  constructor(name) {
    super({ gc: true });
    this.name = name;

    // Maps from connection to set of controlled user ids
    this.conns = new Map();

    // Awareness instance - will be initialized after modules are loaded
    this.awareness = null;
    this.initialized = false;

    // Debouncing configuration
    this.debounceConfig = getDebounceConfig();

    // Debouncing state
    this.debounceState = {
      timer: null,
      pendingUpdates: [],
      firstUpdateTime: null,
      lastUpdateTime: null,
    };
  }

  /**
   * Initialize the document with ES modules
   */
  async initialize() {
    if (this.initialized) return;

    await initializeModules();

    // Initialize awareness
    this.awareness = new awarenessProtocol.Awareness(this);
    this.awareness.setLocalState(null);

    // Handle awareness changes
    const awarenessChangeHandler = ({ added, updated, removed }, conn) => {
      const changedClients = added.concat(updated, removed);
      if (conn !== null) {
        const connControlledIDs = this.conns.get(conn);
        if (connControlledIDs !== undefined) {
          added.forEach(clientID => {
            connControlledIDs.add(clientID);
          });
          removed.forEach(clientID => {
            connControlledIDs.delete(clientID);
          });
        }
      }
      
      // Broadcast awareness update
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients));
      const buff = encoding.toUint8Array(encoder);
      this.conns.forEach((_, c) => {
        send(this, c, buff);
      });
    };
    
    this.awareness.on('update', awarenessChangeHandler);

    // Handle document updates with optional debouncing
    this.on('update', (update, origin, doc) => {
      if (this.debounceConfig.enabled) {
        this.handleDebouncedUpdate(update, origin, doc);
      } else {
        this.handleImmediateUpdate(update, origin, doc);
      }
    });

    this.initialized = true;
  }

  /**
   * Handle immediate document update (original behavior)
   * @param {Uint8Array} update - The Y.js update
   * @param {any} origin - The origin of the update
   * @param {WSSharedDoc} doc - The document instance
   */
  handleImmediateUpdate(update, origin, doc) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);
    doc.conns.forEach((_, conn) => send(doc, conn, message));
  }

  /**
   * Handle debounced document update
   * @param {Uint8Array} update - The Y.js update
   * @param {any} origin - The origin of the update
   * @param {WSSharedDoc} doc - The document instance
   */
  handleDebouncedUpdate(update, origin, doc) {
    const now = Date.now();

    // Store the update
    this.debounceState.pendingUpdates.push({
      update,
      origin,
      timestamp: now
    });

    // Track timing
    if (!this.debounceState.firstUpdateTime) {
      this.debounceState.firstUpdateTime = now;
    }
    this.debounceState.lastUpdateTime = now;

    // Clear existing timer
    if (this.debounceState.timer) {
      clearTimeout(this.debounceState.timer);
    }

    // Check if we've exceeded max delay - force send immediately
    const timeSinceFirst = now - (this.debounceState.firstUpdateTime || now);
    if (timeSinceFirst >= this.debounceConfig.maxDelay) {
      this.flushPendingUpdates(doc);
      return;
    }

    // Set new debounce timer
    this.debounceState.timer = setTimeout(() => {
      this.flushPendingUpdates(doc);
    }, this.debounceConfig.delay);
  }

  /**
   * Flush all pending updates as a single combined update
   * @param {WSSharedDoc} doc - The document instance
   */
  flushPendingUpdates(doc) {
    if (this.debounceState.pendingUpdates.length === 0) {
      return;
    }

    try {
      // Combine all pending updates into a single update
      const updates = this.debounceState.pendingUpdates.map(item => item.update);

      if (updates.length === 1) {
        // Single update - send as is
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeUpdate(encoder, updates[0]);
        const message = encoding.toUint8Array(encoder);
        doc.conns.forEach((_, conn) => send(doc, conn, message));
      } else {
        // Multiple updates - merge them
        const mergedUpdate = Y.mergeUpdates(updates);
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeUpdate(encoder, mergedUpdate);
        const message = encoding.toUint8Array(encoder);
        doc.conns.forEach((_, conn) => send(doc, conn, message));
      }

      // Reset debounce state
      this.resetDebounceState();

    } catch (error) {
      logger.error('Error flushing pending updates', error, {
        pendingCount: this.debounceState.pendingUpdates.length,
        docName: doc.name
      });
      // Fallback: send updates individually
      this.debounceState.pendingUpdates.forEach(item => {
        this.handleImmediateUpdate(item.update, item.origin, doc);
      });
      this.resetDebounceState();
    }
  }

  /**
   * Reset debounce state
   */
  resetDebounceState() {
    if (this.debounceState.timer) {
      clearTimeout(this.debounceState.timer);
      this.debounceState.timer = null;
    }
    this.debounceState.pendingUpdates = [];
    this.debounceState.firstUpdateTime = null;
    this.debounceState.lastUpdateTime = null;
  }

  /**
   * Cleanup method to clear any pending timers
   */
  destroy() {
    this.resetDebounceState();
    super.destroy();
  }
}

/**
 * Get or create a Y.Doc by name with race condition protection
 */
const getYDoc = async (docname, gc = true) => {
  // Check if document already exists
  let doc = docs.get(docname);
  if (doc) {
    // Ensure document is initialized
    if (!doc.initialized) {
      await doc.initialize();
    }
    return doc;
  }

  // Check if another thread is already creating this document
  let lockPromise = documentLocks.get(docname);
  if (lockPromise) {
    // Wait for the other thread to finish creating the document
    await lockPromise;
    // Document should now exist, return it
    doc = docs.get(docname);
    if (doc) {
      return doc;
    }
    // If still doesn't exist, fall through to create it
  }

  // Create a promise for this document creation to prevent race conditions
  const createDocumentPromise = (async () => {
    try {
      // Double-check that document wasn't created while we were waiting
      let existingDoc = docs.get(docname);
      if (existingDoc) {
        if (!existingDoc.initialized) {
          await existingDoc.initialize();
        }
        return existingDoc;
      }

      // Create new document
      const newDoc = new WSSharedDoc(docname);
      newDoc.gc = gc;

      // Initialize the document
      await newDoc.initialize();

      // Store the document
      docs.set(docname, newDoc);

      // Integrate with DocumentManager for Redis sync
      if (documentManager) {
        try {
          await documentManager.getDocument(docname);
        } catch (error) {
          logger.error('Failed to setup Redis sync for document', error, {
            documentName: docname,
            hasDocumentManager: !!documentManager
          });
        }
      }

      return newDoc;
    } finally {
      // Always clean up the lock
      documentLocks.delete(docname);
    }
  })();

  // Store the creation promise to prevent other threads from creating the same document
  documentLocks.set(docname, createDocumentPromise);

  // Wait for document creation to complete
  return await createDocumentPromise;
};

/**
 * Handle incoming WebSocket messages
 * Check if user has write permissions
 * @param {WebSocket} conn - WebSocket connection
 * @returns {boolean} - Whether user can write to document
 */
const hasWritePermission = (conn) => {
  // Check if connection has user information with permissions
  if (!conn.user || !conn.user.permissions) {
    return false;
  }

  // Check for write permissions
  const permissions = conn.user.permissions;
  return permissions.includes('write') ||
         permissions.includes('edit') ||
         permissions.includes('*') ||
         permissions.includes('admin');
};

/**
 * Handle incoming WebSocket messages with permission validation
 */
const messageListener = (conn, doc, message) => {
  try {
    const encoder = encoding.createEncoder();
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case messageSync:
        // Check if this is a document update (write operation)
        const decoderCopy = decoding.createDecoder(message);
        decoding.readVarUint(decoderCopy); // Skip message type

        // Peek at the sync message type to determine if it's a write operation
        const syncMessageType = decoding.readVarUint(decoderCopy);

        // Sync message types: 0 = sync step 1 (read), 1 = sync step 2 (read), 2 = update (write)
        if (syncMessageType === 2) { // This is an update message (write operation)
          if (!hasWritePermission(conn)) {
            console.warn('Permission denied: User attempted to write without write permissions', {
              userId: conn.user?.id,
              username: conn.user?.username,
              permissions: conn.user?.permissions,
              documentId: doc.name
            });

            // Send error response instead of processing the update
            const errorEncoder = encoding.createEncoder();
            encoding.writeVarUint(errorEncoder, messageSync);
            // Don't process the update, just send back empty response
            send(doc, conn, encoding.toUint8Array(errorEncoder));
            return;
          }
        }

        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.readSyncMessage(decoder, encoder, doc, conn);

        // If the encoder only contains the type of reply message and no
        // message, there is no need to send the message. When encoder only
        // contains the type of reply, its length is 1.
        if (encoding.length(encoder) > 1) {
          send(doc, conn, encoding.toUint8Array(encoder));
        }
        break;

      case messageAwareness:
        // Awareness updates (cursor position, user presence) are allowed for all authenticated users
        awarenessProtocol.applyAwarenessUpdate(doc.awareness, decoding.readVarUint8Array(decoder), conn);
        break;
    }
  } catch (err) {
    // Emit error event for proper error handling
    doc.emit('error', [err]);
  }
};

/**
 * Close a WebSocket connection
 */
const closeConn = (doc, conn) => {
  if (doc.conns.has(conn)) {
    const controlledIds = doc.conns.get(conn);
    doc.conns.delete(conn);
    awarenessProtocol.removeAwarenessStates(doc.awareness, Array.from(controlledIds), null);
    
    if (doc.conns.size === 0) {
      // If no more connections, we could persist and destroy the document
      // For now, we'll keep it in memory
      // doc.destroy();
      // docs.delete(doc.name);
    }
  }
  
  if (conn.readyState !== wsReadyStateClosed) {
    conn.close();
  }
};

/**
 * Send message to WebSocket connection
 */
const send = (doc, conn, message) => {
  if (conn.readyState !== wsReadyStateConnecting && conn.readyState !== wsReadyStateOpen) {
    closeConn(doc, conn);
    return;
  }
  
  try {
    conn.send(message, {}, err => {
      if (err != null) {
        closeConn(doc, conn);
      }
    });
  } catch (e) {
    closeConn(doc, conn);
  }
};

/**
 * Setup WebSocket connection for y-websocket
 */
const setupWSConnection = async (conn, req, { docName = (req.url || '').slice(1).split('?')[0], gc = true } = {}) => {
  conn.binaryType = 'arraybuffer';

  // Get or create document
  const doc = await getYDoc(docName, gc);
  doc.conns.set(conn, new Set());
  
  // Listen to messages
  conn.on('message', message => messageListener(conn, doc, new Uint8Array(message)));
  
  // Setup ping/pong for connection health
  let pongReceived = true;
  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      if (doc.conns.has(conn)) {
        closeConn(doc, conn);
      }
      clearInterval(pingInterval);
    } else if (doc.conns.has(conn)) {
      pongReceived = false;
      try {
        conn.ping();
      } catch (e) {
        closeConn(doc, conn);
        clearInterval(pingInterval);
      }
    }
  }, pingTimeout);
  
  conn.on('close', () => {
    closeConn(doc, conn);
    clearInterval(pingInterval);
  });
  
  conn.on('pong', () => {
    pongReceived = true;
  });
  
  // Send initial sync
  {
    // Send sync step 1
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, doc);
    send(doc, conn, encoding.toUint8Array(encoder));

    // Send awareness states
    const awarenessStates = doc.awareness.getStates();
    if (awarenessStates.size > 0) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(awarenessStates.keys())));
      send(doc, conn, encoding.toUint8Array(encoder));
    }

    // Initial sync completed
  }
};

/**
 * Get document state size
 */
const getDocumentStateSize = (doc) => {
  return Y.encodeStateAsUpdate(doc).length;
};

/**
 * Apply update to YJS document (LOW-LEVEL UTILITY)
 *
 * 🔧 PURPOSE: Direct wrapper around YJS's applyUpdate function.
 * This is the lowest-level function that actually applies binary updates to YJS documents.
 *
 * 🔄 CALLED BY:
 * - handleRemoteUpdate() - When Redis updates arrive (origin: 'redis-sync')
 * - applyUpdate() - When external API calls are made (origin: varies)
 * - YJS internal processes - Various origins
 *
 * ⚡ PERFORMANCE: This is a direct call to YJS library - very fast, no overhead.
 *
 * 🎯 ORIGIN PARAMETER IMPORTANCE:
 * - 'redis-sync': Prevents re-broadcasting to Redis (avoids infinite loops)
 * - 'user-input': Triggers Redis broadcasting to other servers
 * - null/other: Default YJS behavior
 *
 * @param {Y.Doc} doc - YJS document instance (must already exist)
 * @param {Uint8Array} update - YJS update binary data
 * @param {string|null} origin - Update origin (used for event filtering)
 */
const applyUpdateToDoc = (doc, update, origin = null) => {
  // 🔥 DIRECT CALL to YJS library - this is where the actual document update happens
  Y.applyUpdate(doc, update, origin);
};

module.exports = {
  setupWSConnection,
  getYDoc,
  docs,
  WSSharedDoc,
  getDocumentStateSize,
  applyUpdateToDoc,
  setDocumentManager
};
