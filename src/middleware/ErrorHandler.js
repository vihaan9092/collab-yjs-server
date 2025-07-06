/**
 * Centralized Error Handler
 * Follows Single Responsibility Principle - handles only error processing
 */
class ErrorHandler {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Handle application errors
   */
  handleError(error, context = {}) {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      ...context
    };

    // Log based on error severity
    if (this.isCriticalError(error)) {
      this.logger.error('Critical error occurred', error, errorInfo);
    } else if (this.isWarningError(error)) {
      this.logger.warn('Warning error occurred', errorInfo);
    } else {
      this.logger.error('Error occurred', error, errorInfo);
    }

    return errorInfo;
  }

  /**
   * Handle WebSocket errors
   */
  handleWebSocketError(error, socket, context = {}) {
    const errorInfo = this.handleError(error, {
      ...context,
      socketId: socket?.id,
      type: 'websocket'
    });

    // Send error to client if socket is available
    if (socket && socket.connected) {
      socket.emit('error', {
        message: this.getSafeErrorMessage(error),
        code: error.code,
        timestamp: new Date().toISOString()
      });
    }

    return errorInfo;
  }

  /**
   * Handle HTTP errors
   */
  handleHttpError(error, req, res, context = {}) {
    const errorInfo = this.handleError(error, {
      ...context,
      url: req?.url,
      method: req?.method,
      ip: req?.ip,
      type: 'http'
    });

    const statusCode = this.getHttpStatusCode(error);
    const safeMessage = this.getSafeErrorMessage(error);

    if (res && !res.headersSent) {
      res.status(statusCode).json({
        error: safeMessage,
        code: error.code,
        timestamp: new Date().toISOString()
      });
    }

    return errorInfo;
  }

  /**
   * Handle YJS document errors
   */
  handleDocumentError(error, documentId, context = {}) {
    return this.handleError(error, {
      ...context,
      documentId,
      type: 'document'
    });
  }

  /**
   * Handle connection errors
   */
  handleConnectionError(error, connectionId, context = {}) {
    return this.handleError(error, {
      ...context,
      connectionId,
      type: 'connection'
    });
  }

  /**
   * Determine if error is critical
   */
  isCriticalError(error) {
    const criticalErrors = [
      'EADDRINUSE',
      'EACCES',
      'EMFILE',
      'ENFILE'
    ];

    return criticalErrors.includes(error.code) || 
           error.name === 'SystemError' ||
           error.message.includes('out of memory');
  }

  /**
   * Determine if error is a warning
   */
  isWarningError(error) {
    const warningErrors = [
      'ECONNRESET',
      'EPIPE',
      'ETIMEDOUT'
    ];

    return warningErrors.includes(error.code) ||
           error.name === 'ValidationError';
  }

  /**
   * Get HTTP status code from error
   */
  getHttpStatusCode(error) {
    if (error.statusCode) return error.statusCode;
    if (error.status) return error.status;
    
    switch (error.name) {
      case 'ValidationError':
        return 400;
      case 'UnauthorizedError':
        return 401;
      case 'ForbiddenError':
        return 403;
      case 'NotFoundError':
        return 404;
      case 'ConflictError':
        return 409;
      case 'RateLimitError':
        return 429;
      default:
        return 500;
    }
  }

  /**
   * Get safe error message for client
   */
  getSafeErrorMessage(error) {
    // In production, don't expose internal error details
    if (process.env.NODE_ENV === 'production') {
      switch (error.name) {
        case 'ValidationError':
          return 'Invalid input provided';
        case 'UnauthorizedError':
          return 'Authentication required';
        case 'ForbiddenError':
          return 'Access denied';
        case 'NotFoundError':
          return 'Resource not found';
        case 'ConflictError':
          return 'Resource conflict';
        case 'RateLimitError':
          return 'Too many requests';
        default:
          return 'Internal server error';
      }
    }

    return error.message || 'Unknown error occurred';
  }

  /**
   * Create custom error types
   */
  static createError(name, message, code, statusCode) {
    const error = new Error(message);
    error.name = name;
    error.code = code;
    error.statusCode = statusCode;
    return error;
  }

  /**
   * Validation error
   */
  static validationError(message, field) {
    const error = ErrorHandler.createError('ValidationError', message, 'VALIDATION_FAILED', 400);
    error.field = field;
    return error;
  }

  /**
   * Not found error
   */
  static notFoundError(resource) {
    return ErrorHandler.createError('NotFoundError', `${resource} not found`, 'NOT_FOUND', 404);
  }

  /**
   * Unauthorized error
   */
  static unauthorizedError(message = 'Authentication required') {
    return ErrorHandler.createError('UnauthorizedError', message, 'UNAUTHORIZED', 401);
  }

  /**
   * Rate limit error
   */
  static rateLimitError(message = 'Too many requests') {
    return ErrorHandler.createError('RateLimitError', message, 'RATE_LIMIT_EXCEEDED', 429);
  }
}

module.exports = ErrorHandler;
