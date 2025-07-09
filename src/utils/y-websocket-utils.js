const Y = require('yjs');
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');
const map = require('lib0/map');
const { getDebounceConfig, logDebounceConfig } = require('../config/debounceConfig');
const Logger = require('./Logger');

const logger = new Logger({ service: 'y-websocket-utils' });

let syncProtocol, awarenessProtocol;

const wsReadyStateConnecting = 0;
const wsReadyStateOpen = 1;
const wsReadyStateClosed = 3;

const messageSync = 0;
const messageAwareness = 1;

const docs = new Map();
const documentLocks = new Map();
let documentManager = null;

const pingTimeout = 30000;


const initializeModules = async () => {
  if (!syncProtocol || !awarenessProtocol) {
    try {
      if (process.env.NODE_ENV === 'test') {
        syncProtocol = require('y-protocols/sync.js');
        awarenessProtocol = require('y-protocols/awareness.js');
      } else {
        syncProtocol = await import('y-protocols/sync.js');
        awarenessProtocol = await import('y-protocols/awareness.js');
      }
    } catch (error) {
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


const setDocumentManager = (manager) => {
  documentManager = manager;
};


class WSSharedDoc extends Y.Doc {
  constructor(name) {
    super({ gc: true });
    this.name = name;
    this.conns = new Map();
    this.awareness = null;
    this.initialized = false;
    this.debounceConfig = getDebounceConfig();
    this.debounceState = {
      timer: null,
      pendingUpdates: [],
      firstUpdateTime: null,
      lastUpdateTime: null,
    };
  }

  async initialize() {
    if (this.initialized) return;

    await initializeModules();

    this.awareness = new awarenessProtocol.Awareness(this);
    this.awareness.setLocalState(null);

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

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients));
      const buff = encoding.toUint8Array(encoder);
      this.conns.forEach((_, c) => {
        send(this, c, buff);
      });
    };

    this.awareness.on('update', awarenessChangeHandler);

    this.on('update', (update, origin, doc) => {
      if (this.debounceConfig.enabled) {
        this.handleDebouncedUpdate(update, origin, doc);
      } else {
        this.handleImmediateUpdate(update, origin, doc);
      }
    });

    this.initialized = true;
  }

  handleImmediateUpdate(update, origin, doc) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);
    doc.conns.forEach((_, conn) => send(doc, conn, message));
  }

  handleDebouncedUpdate(update, origin, doc) {
    const now = Date.now();

    this.debounceState.pendingUpdates.push({
      update,
      origin,
      timestamp: now
    });

    if (!this.debounceState.firstUpdateTime) {
      this.debounceState.firstUpdateTime = now;
    }
    this.debounceState.lastUpdateTime = now;

    if (this.debounceState.timer) {
      clearTimeout(this.debounceState.timer);
    }

    const timeSinceFirst = now - (this.debounceState.firstUpdateTime || now);
    if (timeSinceFirst >= this.debounceConfig.maxDelay) {
      this.flushPendingUpdates(doc);
      return;
    }

    this.debounceState.timer = setTimeout(() => {
      this.flushPendingUpdates(doc);
    }, this.debounceConfig.delay);
  }

  flushPendingUpdates(doc) {
    if (this.debounceState.pendingUpdates.length === 0) {
      return;
    }

    try {
      const updates = this.debounceState.pendingUpdates.map(item => item.update);

      if (updates.length === 1) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeUpdate(encoder, updates[0]);
        const message = encoding.toUint8Array(encoder);
        doc.conns.forEach((_, conn) => send(doc, conn, message));
      } else {
        const mergedUpdate = Y.mergeUpdates(updates);
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeUpdate(encoder, mergedUpdate);
        const message = encoding.toUint8Array(encoder);
        doc.conns.forEach((_, conn) => send(doc, conn, message));
      }

      this.resetDebounceState();

    } catch (error) {
      logger.error('Error flushing pending updates', error, {
        pendingCount: this.debounceState.pendingUpdates.length,
        docName: doc.name
      });
      this.debounceState.pendingUpdates.forEach(item => {
        this.handleImmediateUpdate(item.update, item.origin, doc);
      });
      this.resetDebounceState();
    }
  }

  resetDebounceState() {
    if (this.debounceState.timer) {
      clearTimeout(this.debounceState.timer);
      this.debounceState.timer = null;
    }
    this.debounceState.pendingUpdates = [];
    this.debounceState.firstUpdateTime = null;
    this.debounceState.lastUpdateTime = null;
  }

  destroy() {
    this.resetDebounceState();
    super.destroy();
  }
}

const getYDoc = async (docname, gc = true) => {
  let doc = docs.get(docname);
  if (doc) {
    if (!doc.initialized) {
      await doc.initialize();
    }
    return doc;
  }

  let lockPromise = documentLocks.get(docname);
  if (lockPromise) {
    await lockPromise;
    doc = docs.get(docname);
    if (doc) {
      return doc;
    }
  }

  const createDocumentPromise = (async () => {
    try {
      let existingDoc = docs.get(docname);
      if (existingDoc) {
        if (!existingDoc.initialized) {
          await existingDoc.initialize();
        }
        return existingDoc;
      }

      const newDoc = new WSSharedDoc(docname);
      newDoc.gc = gc;
      await newDoc.initialize();
      docs.set(docname, newDoc);

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
      documentLocks.delete(docname);
    }
  })();

  documentLocks.set(docname, createDocumentPromise);
  return await createDocumentPromise;
};

const hasWritePermission = (conn) => {
  if (!conn.user || !conn.user.permissions) {
    return false;
  }

  const permissions = conn.user.permissions;
  return permissions.includes('write') ||
         permissions.includes('edit') ||
         permissions.includes('*') ||
         permissions.includes('admin');
};

const messageListener = (conn, doc, message) => {
  try {
    const encoder = encoding.createEncoder();
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case messageSync:
        const decoderCopy = decoding.createDecoder(message);
        decoding.readVarUint(decoderCopy);
        const syncMessageType = decoding.readVarUint(decoderCopy);

        if (syncMessageType === 2) {
          if (!hasWritePermission(conn)) {
            console.warn('Permission denied: User attempted to write without write permissions', {
              userId: conn.user?.id,
              username: conn.user?.username,
              permissions: conn.user?.permissions,
              documentId: doc.name
            });

            const errorEncoder = encoding.createEncoder();
            encoding.writeVarUint(errorEncoder, messageSync);
            send(doc, conn, encoding.toUint8Array(errorEncoder));
            return;
          }
        }

        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.readSyncMessage(decoder, encoder, doc, conn);

        if (encoding.length(encoder) > 1) {
          send(doc, conn, encoding.toUint8Array(encoder));
        }
        break;

      case messageAwareness:
        awarenessProtocol.applyAwarenessUpdate(doc.awareness, decoding.readVarUint8Array(decoder), conn);
        break;
    }
  } catch (err) {
    doc.emit('error', [err]);
  }
};

const closeConn = (doc, conn) => {
  if (doc.conns.has(conn)) {
    const controlledIds = doc.conns.get(conn);
    doc.conns.delete(conn);
    awarenessProtocol.removeAwarenessStates(doc.awareness, Array.from(controlledIds), null);
  }

  if (conn.readyState !== wsReadyStateClosed) {
    conn.close();
  }
};

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

const setupWSConnection = async (conn, req, { docName = (req.url || '').slice(1).split('?')[0], gc = true } = {}) => {
  conn.binaryType = 'arraybuffer';

  const doc = await getYDoc(docName, gc);
  doc.conns.set(conn, new Set());

  conn.on('message', message => messageListener(conn, doc, new Uint8Array(message)));

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

  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, doc);
  send(doc, conn, encoding.toUint8Array(encoder));

  const awarenessStates = doc.awareness.getStates();
  if (awarenessStates.size > 0) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(awarenessStates.keys())));
    send(doc, conn, encoding.toUint8Array(encoder));
  }
};

const getDocumentStateSize = (doc) => {
  return Y.encodeStateAsUpdate(doc).length;
};

const applyUpdateToDoc = (doc, update, origin = null) => {
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
