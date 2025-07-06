const Y = require('yjs');
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');
const map = require('lib0/map');

// Dynamic imports for ES modules
let syncProtocol, awarenessProtocol;

// Initialize ES modules
const initializeModules = async () => {
  if (!syncProtocol || !awarenessProtocol) {
    syncProtocol = await import('y-protocols/sync.js');
    awarenessProtocol = await import('y-protocols/awareness.js');
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
    
    // Handle document updates
    this.on('update', (update, origin, doc) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeUpdate(encoder, update);
      const message = encoding.toUint8Array(encoder);
      doc.conns.forEach((_, conn) => send(doc, conn, message));
    });

    this.initialized = true;
  }
}

/**
 * Get or create a Y.Doc by name
 */
const getYDoc = async (docname, gc = true) => {
  let doc = docs.get(docname);
  if (!doc) {
    doc = new WSSharedDoc(docname);
    doc.gc = gc;
    await doc.initialize();
    docs.set(docname, doc);
  } else if (!doc.initialized) {
    await doc.initialize();
  }
  return doc;
};

/**
 * Handle incoming WebSocket messages
 */
const messageListener = (conn, doc, message) => {
  try {
    const encoder = encoding.createEncoder();
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);
    
    switch (messageType) {
      case messageSync:
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
 * Apply update to document
 */
const applyUpdateToDoc = (doc, update, origin = null) => {
  Y.applyUpdate(doc, update, origin);
};

module.exports = {
  setupWSConnection,
  getYDoc,
  docs,
  WSSharedDoc,
  getDocumentStateSize,
  applyUpdateToDoc
};
