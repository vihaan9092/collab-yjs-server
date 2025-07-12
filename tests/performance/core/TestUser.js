/**
 * TestUser Class - Represents a real user in performance tests
 * Simulates authentic user behavior with realistic editing patterns
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { EventEmitter } = require('events');
const { Base64 } = require('js-base64');
const Y = require('yjs');
const { WebsocketProvider } = require('y-websocket');

class TestUser extends EventEmitter {
  constructor(config) {
    super();
    this.id = config.id;
    this.username = config.username || `user${this.id}`;
    this.email = config.email || `${this.username}@company.com`;
    this.role = config.role || 'editor';
    this.permissions = config.permissions || ['read', 'write'];
    
    // Connection state
    this.ws = null;
    this.connected = false;
    this.documentId = null;
    this.connectionStartTime = null;
    this.connectionTime = 0;
    
    // Performance metrics
    this.metrics = {
      messagesReceived: 0,
      messagesSent: 0,
      bytesReceived: 0,
      bytesSent: 0,
      latencies: [],
      errors: [],
      editsPerformed: 0,
      connectionAttempts: 0,
      reconnections: 0
    };
    
    // Editing behavior
    this.editingStyle = config.editingStyle || 'balanced'; // aggressive, balanced, conservative
    this.typingSpeed = config.typingSpeed || 'normal'; // slow, normal, fast
    this.isActive = false;
    this.pendingOperations = new Map();
    this.operationQueue = [];
    this.isProcessingQueue = false;
    
    // Real user simulation
    this.userBehavior = {
      pauseBetweenEdits: this.calculatePauseTime(),
      editBurstSize: this.calculateBurstSize(),
      preferredOperations: this.getPreferredOperations()
    };
  }

  /**
   * Generate authentic JWT token for this user
   */
  generateAuthToken() {
    const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

    const payload = {
      user_id: this.id,
      userId: this.id,
      username: this.username,
      email: this.email,
      role: this.role,
      permissions: this.permissions,
      department: 'Engineering',
      company: 'TestCorp',
      iss: 'collaboration-server',
      aud: 'collaboration-clients',
      exp: Math.floor(Date.now() / 1000) + 7200, // 2 hours
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, secret, { algorithm: 'HS256' });
  }

  /**
   * Encode JWT token for WebSocket subprotocol authentication
   * Uses the same method as the client-side implementation
   */
  encodeTokenForWebSocket(token) {
    try {
      if (!token || typeof token !== 'string' || token.length < 10) {
        throw new Error('Invalid token input');
      }

      const encoded = Base64.encode(token, true); // base64url-safe

      if (encoded.length > 1000) {
        throw new Error('Encoded token too long for WebSocket');
      }

      return encoded;
    } catch (error) {
      throw new Error('Failed to encode token for WebSocket');
    }
  }

  /**
   * Create a secure WebSocket class that adds JWT authentication via subprotocols
   * (Same approach as the UI)
   */
  createSecureWebSocket(token) {
    if (!token || typeof token !== 'string' || token.length < 10) {
      throw new Error('Invalid or missing authentication token');
    }

    return class SecureWebSocket extends WebSocket {
      constructor(url, protocols = []) {
        try {
          const encodedToken = Base64.encode(token, true);
          const authProtocol = `auth.${encodedToken}`;

          const allProtocols = Array.isArray(protocols) ? [authProtocol, ...protocols] : [authProtocol];

          super(url, allProtocols);

        } catch (error) {
          console.error('Failed to create secure WebSocket', error);
          throw error;
        }
      }
    };
  }

  /**
   * Create a secure WebSocket provider configuration for y-websocket
   * (Same approach as the UI)
   */
  createSecureProviderConfig(token, options = {}) {
    const SecureWebSocket = this.createSecureWebSocket(token);

    return {
      WebSocketPolyfill: SecureWebSocket,
      connect: true,
      resyncInterval: 5000,
      disableBc: true,
      maxBackoffTime: 30000,
      ...options
    };
  }

  /**
   * Connect to document with realistic connection behavior using Y.js WebSocket provider
   */
  async connectToDocument(serverUrl, documentId) {
    return new Promise((resolve, reject) => {
      this.connectionStartTime = Date.now();
      this.documentId = documentId;
      this.metrics.connectionAttempts++;

      const token = this.generateAuthToken();

      try {
        // Create Y.js document
        this.ydoc = new Y.Doc();
        this.ytext = this.ydoc.getText('content');

        // Create WebSocket provider with authentication (like the UI)
        const wsUrl = serverUrl.replace(/\/$/, ''); // Remove trailing slash
        const secureConfig = this.createSecureProviderConfig(token, {
          connect: true,
          resyncInterval: 5000
        });

        this.provider = new WebsocketProvider(wsUrl, documentId, this.ydoc, secureConfig);

        // Setup Y.js provider event handlers
        this.setupYjsProviderHandlers(resolve, reject);

        // Connection timeout
        setTimeout(() => {
          if (!this.connected) {
            this.metrics.errors.push({
              type: 'connection_timeout',
              timestamp: Date.now(),
              message: 'Connection timeout after 15 seconds'
            });
            reject(new Error(`Connection timeout for user ${this.username}`));
          }
        }, 15000);

      } catch (error) {
        this.metrics.errors.push({
          type: 'connection_error',
          timestamp: Date.now(),
          message: error.message
        });
        reject(error);
      }
    });
  }

  /**
   * Setup Y.js WebSocket provider event handlers with realistic behavior
   */
  setupYjsProviderHandlers(resolve, reject) {
    this.provider.on('status', (event) => {
      try {
        if (event.status === 'connected') {
          this.connected = true;
          this.connectionTime = Date.now() - this.connectionStartTime;
          this.metrics.connectionsSuccessful++;

          // Validate Y.js document state after connection
          if (!this.ydoc || !this.ytext) {
            throw new Error('Y.js document or text object not properly initialized');
          }

          this.emit('connected', {
            userId: this.id,
            username: this.username,
            connectionTime: this.connectionTime,
            timestamp: Date.now()
          });

          resolve(this);
        } else if (event.status === 'disconnected') {
          this.connected = false;
          this.emit('disconnected', {
            userId: this.id,
            username: this.username,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        this.metrics.errors.push({
          type: 'connection_error',
          timestamp: Date.now(),
          message: error.message
        });
        console.warn(`⚠️  Connection error for ${this.username}: ${error.message}`);
        reject(error);
      }
    });

    this.provider.on('connection-error', (error) => {
      this.metrics.errors.push({
        type: 'connection_error',
        timestamp: Date.now(),
        message: error.message
      });

      if (!this.connected) {
        reject(error);
      }
    });

    // Track document updates (this will trigger Redis pub/sub)
    this.ydoc.on('update', (update) => {
      try {
        // Validate update before processing
        if (update && update.length > 0) {
          this.metrics.messagesReceived++;
          this.metrics.lastActivity = Date.now();
        }
      } catch (error) {
        this.logger?.error('Y.js update processing error:', error);
        this.metrics.errors.push({
          type: 'yjs_update_error',
          timestamp: Date.now(),
          message: error.message
        });
      }
    });

    // Setup awareness if available
    if (this.provider.awareness) {
      this.provider.awareness.setLocalStateField('user', {
        name: this.username,
        color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
        id: this.id
      });
    }
  }

  /**
   * Handle incoming WebSocket messages with latency tracking
   */
  handleIncomingMessage(data) {
    this.metrics.messagesReceived++;
    this.metrics.bytesReceived += data.length;
    
    try {
      const message = JSON.parse(data);
      
      // Track operation latency
      if (message.type === 'ack' && message.operationId) {
        const pendingOp = this.pendingOperations.get(message.operationId);
        if (pendingOp) {
          const latency = Date.now() - pendingOp.timestamp;
          this.metrics.latencies.push(latency);
          this.pendingOperations.delete(message.operationId);
          
          this.emit('operationAck', {
            userId: this.id,
            operationId: message.operationId,
            latency
          });
        }
      }
      
      this.emit('messageReceived', {
        userId: this.id,
        messageType: message.type,
        size: data.length
      });
      
    } catch (error) {
      this.metrics.errors.push({
        type: 'message_parse_error',
        timestamp: Date.now(),
        message: error.message,
        rawData: data.toString().substring(0, 100)
      });
    }
  }

  /**
   * Start realistic editing simulation
   */
  async startEditing(duration) {
    if (!this.connected) {
      throw new Error('User must be connected before starting editing');
    }
    
    this.isActive = true;
    const endTime = Date.now() + duration;
    
    this.emit('editingStarted', {
      userId: this.id,
      username: this.username,
      duration,
      editingStyle: this.editingStyle
    });
    
    while (Date.now() < endTime && this.connected && this.isActive) {
      await this.performEditingBurst();
      await this.simulateUserPause();
    }
    
    this.isActive = false;
    this.emit('editingCompleted', {
      userId: this.id,
      editsPerformed: this.metrics.editsPerformed
    });
  }

  /**
   * Perform a burst of edits (realistic user behavior)
   */
  async performEditingBurst() {
    const burstSize = Math.floor(Math.random() * this.userBehavior.editBurstSize) + 1;
    
    for (let i = 0; i < burstSize && this.isActive; i++) {
      await this.performSingleEdit();
      
      // Small delay between edits in a burst
      await this.sleep(50 + Math.random() * 200);
    }
  }

  /**
   * Perform a single realistic edit operation
   */
  async performSingleEdit() {
    const operations = this.userBehavior.preferredOperations;
    const operation = operations[Math.floor(Math.random() * operations.length)];
    
    const edit = this.generateRealisticEdit(operation);
    const operationId = `op_${this.id}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    const message = {
      type: 'edit',
      operationId,
      userId: this.id,
      username: this.username,
      timestamp: Date.now(),
      operation: edit
    };
    
    this.queueOperation(message, operationId);
    this.metrics.editsPerformed++;
    
    this.emit('editPerformed', {
      userId: this.id,
      operationType: operation,
      operationId
    });
  }

  /**
   * Generate realistic edit operations based on user behavior
   */
  generateRealisticEdit(operationType) {
    const position = Math.floor(Math.random() * 10000);
    
    switch (operationType) {
      case 'typing':
        const text = this.generateRealisticText();
        return {
          type: 'insert',
          position,
          text: text,
          content: text,
          formatting: this.getRandomFormatting()
        };
        
      case 'deletion':
        return {
          type: 'delete',
          position,
          length: Math.floor(Math.random() * 20) + 1
        };
        
      case 'formatting':
        const formatStyle = this.getRandomFormatting();
        const formatText = `[${formatStyle}]${this.generateRealisticText()}[/${formatStyle}]`;
        return {
          type: 'format',
          position,
          length: Math.floor(Math.random() * 50) + 5,
          format: formatStyle,
          content: formatText,
          attributes: { [formatStyle]: true }
        };
        
      case 'table_edit':
        // Convert table edit to simple insert operation
        return {
          type: 'insert',
          position,
          text: `[Table Cell: ${this.generateRealisticText()}]`,
          content: `[Table Cell: ${this.generateRealisticText()}]`
        };

      case 'list_operation':
        // Convert list operation to simple insert operation
        const listType = Math.random() > 0.5 ? 'bullet' : 'numbered';
        const listText = listType === 'bullet' ? `• ${this.generateRealisticText()}` : `1. ${this.generateRealisticText()}`;
        return {
          type: 'insert',
          position,
          text: listText,
          content: listText
        };
        
      default:
        return {
          type: 'insert',
          position,
          text: this.generateRealisticText()
        };
    }
  }

  /**
   * Generate realistic text content
   */
  generateRealisticText() {
    const textSamples = [
      'The quarterly results show significant improvement in user engagement.',
      'We need to discuss the implementation timeline for the new features.',
      'Customer feedback indicates strong satisfaction with the recent updates.',
      'The development team has completed the security audit requirements.',
      'Market analysis suggests expanding into the European region.',
      'Performance metrics demonstrate a 25% increase in efficiency.',
      'The new collaboration tools have streamlined our workflow processes.',
      'Budget allocation for Q4 includes additional resources for R&D.',
      'User interface improvements have reduced support ticket volume.',
      'Integration with third-party services is scheduled for next month.'
    ];
    
    const sample = textSamples[Math.floor(Math.random() * textSamples.length)];
    
    // Simulate typing variations
    if (Math.random() < 0.3) {
      // Partial typing (user still typing)
      const words = sample.split(' ');
      const partialLength = Math.floor(Math.random() * words.length) + 1;
      return words.slice(0, partialLength).join(' ');
    }
    
    return sample;
  }

  /**
   * Get random formatting options
   */
  getRandomFormatting() {
    const formats = {
      bold: Math.random() < 0.2,
      italic: Math.random() < 0.15,
      underline: Math.random() < 0.1,
      fontSize: Math.random() < 0.1 ? [12, 14, 16, 18][Math.floor(Math.random() * 4)] : undefined,
      color: Math.random() < 0.05 ? ['#000000', '#333333', '#666666', '#0066cc'][Math.floor(Math.random() * 4)] : undefined
    };
    
    // Remove undefined values
    return Object.fromEntries(Object.entries(formats).filter(([_, v]) => v !== undefined));
  }

  /**
   * Queue operation for processing to prevent race conditions
   */
  queueOperation(message, operationId = null) {
    this.operationQueue.push({ message, operationId, timestamp: Date.now() });
    this.processOperationQueue();
  }

  /**
   * Process queued operations sequentially to prevent Y.js race conditions
   */
  async processOperationQueue() {
    if (this.isProcessingQueue || this.operationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.operationQueue.length > 0) {
      const { message, operationId } = this.operationQueue.shift();

      try {
        await this.sendMessage(message, operationId);
        // Small delay to prevent overwhelming Y.js
        await new Promise(resolve => setTimeout(resolve, 10));
      } catch (error) {
        this.metrics.errors.push({
          type: 'queue_processing_error',
          timestamp: Date.now(),
          message: error.message,
          operationId
        });
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Send Y.js document update (triggers Redis pub/sub)
   */
  sendMessage(message, operationId = null) {
    if (!this.connected || !this.ytext) {
      this.metrics.errors.push({
        type: 'send_failed_not_connected',
        timestamp: Date.now(),
        message: 'Attempted to send message while not connected'
      });
      return Promise.reject(new Error('Not connected'));
    }

    return new Promise((resolve, reject) => {
      try {
        // Perform real Y.js document update based on the operation with transaction safety
        const operation = message.operation;

        // Validate operation before applying
        if (!operation || !operation.type) {
          throw new Error('Invalid operation: missing type');
        }

        // Use Y.js transaction for atomic operations
        this.ydoc.transact(() => {
          // Ensure ytext is still valid
          if (!this.ytext || this.ytext.length === undefined) {
            throw new Error('Y.js text object is invalid');
          }

          const currentLength = this.ytext.length;

          if (operation.type === 'insert') {
            const content = operation.text || operation.content || '';
            if (content.length > 0) {
              // Ensure position is within bounds
              const safePosition = Math.min(Math.max(0, operation.position || 0), currentLength);
              this.ytext.insert(safePosition, content);
            }
          } else if (operation.type === 'delete') {
            if (currentLength > 0) {
              const position = Math.min(Math.max(0, operation.position || 0), currentLength - 1);
              const length = Math.min(operation.length || 1, currentLength - position, 50); // Limit deletion size
              if (length > 0) {
                this.ytext.delete(position, length);
              }
            }
          } else if (operation.type === 'format') {
            // For formatting, we'll just insert formatted text
            const content = operation.content || '';
            const format = operation.format || 'bold';
            const formattedText = `[${format}]${content}[/${format}]`;
            if (formattedText.length > 0) {
              const safePosition = Math.min(Math.max(0, operation.position || 0), currentLength);
              this.ytext.insert(safePosition, formattedText);
            }
          }
        });

        if (operationId) {
          this.pendingOperations.set(operationId, {
            timestamp: Date.now(),
            message: message
          });
        }

        this.metrics.messagesSent++;
        this.metrics.bytesSent += (operation.content || operation.text || '').length;

        resolve();

      } catch (error) {
        this.metrics.errors.push({
          type: 'send_error',
          timestamp: Date.now(),
          message: error.message,
          operationId,
          operation: message.operation?.type
        });

        // Log error for debugging
        console.warn(`⚠️  Y.js operation error for ${this.username}: ${error.message}`);
        reject(error);
      }
    });
  }

  /**
   * Calculate realistic pause time between editing sessions
   */
  calculatePauseTime() {
    const baseTime = {
      aggressive: 500,
      balanced: 1500,
      conservative: 3000
    };
    
    return baseTime[this.editingStyle] || baseTime.balanced;
  }

  /**
   * Calculate editing burst size based on user style
   */
  calculateBurstSize() {
    const burstSizes = {
      aggressive: 8,
      balanced: 4,
      conservative: 2
    };
    
    return burstSizes[this.editingStyle] || burstSizes.balanced;
  }

  /**
   * Get preferred operations based on user role and style
   */
  getPreferredOperations() {
    const baseOps = ['typing', 'deletion', 'formatting'];
    
    if (this.role === 'editor' || this.role === 'admin') {
      baseOps.push('table_edit', 'list_operation');
    }
    
    if (this.editingStyle === 'aggressive') {
      baseOps.push('formatting', 'table_edit');
    }
    
    return baseOps;
  }

  /**
   * Simulate realistic user pause
   */
  async simulateUserPause() {
    const pauseTime = this.userBehavior.pauseBetweenEdits + (Math.random() * 1000);
    await this.sleep(pauseTime);
  }

  /**
   * Get comprehensive user metrics
   */
  getMetrics() {
    const avgLatency = this.metrics.latencies.length > 0 
      ? this.metrics.latencies.reduce((sum, lat) => sum + lat, 0) / this.metrics.latencies.length 
      : 0;
      
    const maxLatency = this.metrics.latencies.length > 0 
      ? Math.max(...this.metrics.latencies) 
      : 0;
      
    return {
      userId: this.id,
      username: this.username,
      role: this.role,
      connection: {
        connected: this.connected,
        connectionTime: this.connectionTime,
        attempts: this.metrics.connectionAttempts,
        reconnections: this.metrics.reconnections
      },
      performance: {
        avgLatency: Math.round(avgLatency * 100) / 100,
        maxLatency,
        totalLatencyMeasurements: this.metrics.latencies.length
      },
      activity: {
        editsPerformed: this.metrics.editsPerformed,
        messagesReceived: this.metrics.messagesReceived,
        messagesSent: this.metrics.messagesSent,
        bytesReceived: this.metrics.bytesReceived,
        bytesSent: this.metrics.bytesSent
      },
      errors: {
        count: this.metrics.errors.length,
        types: [...new Set(this.metrics.errors.map(e => e.type))]
      },
      behavior: {
        editingStyle: this.editingStyle,
        typingSpeed: this.typingSpeed,
        isActive: this.isActive
      }
    };
  }

  /**
   * Disconnect user gracefully
   */
  async disconnect() {
    this.isActive = false;

    if (this.provider && this.connected) {
      this.provider.destroy();
    }

    if (this.ydoc) {
      this.ydoc.destroy();
    }

    this.emit('disconnecting', { userId: this.id, username: this.username });
  }

  /**
   * Utility sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = TestUser;
