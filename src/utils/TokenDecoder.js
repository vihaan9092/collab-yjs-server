const { Base64 } = require('js-base64');

class TokenDecoder {
  constructor(logger) {
    this.logger = logger;
    this.logger.info('Using js-base64 library (industry standard)', {
      service: 'token-decoder'
    });
  }

  /**
   * Modern token decoding using built-in Node.js functions
   * @param {string} encodedToken - URL-safe base64 encoded token
   * @returns {string} - Decoded JWT token
   * @throws {Error} - If decoding fails
   */
  decodeTokenFromWebSocket(encodedToken) {
    try {
      if (!encodedToken || typeof encodedToken !== 'string') {
        throw new Error('Invalid encoded token');
      }

      if (!/^[A-Za-z0-9\-_]*$/.test(encodedToken)) {
        throw new Error('Token contains invalid characters');
      }

      const token = Base64.decode(encodedToken, true);

      if (!/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/.test(token)) {
        throw new Error('Decoded token is not valid JWT format');
      }

      return token;
    } catch (error) {
      this.logger.error('Token decoding failed', error, {
        encodedTokenLength: encodedToken?.length || 0,
        service: 'token-decoder'
      });
      throw new Error('Failed to decode token from WebSocket transmission');
    }
  }

  /**
   * Modern token encoding using built-in Node.js functions
   * Industry standard approach used by Google, AWS, Microsoft
   * @param {string} token - JWT token to encode
   * @returns {string} - URL-safe base64 encoded token
   */
  encodeTokenForWebSocket(token) {
    try {
      if (typeof token !== 'string') {
        throw new Error('Token must be a string');
      }

      const encoded = Base64.encode(token, true);

      if (encoded.length > 1000) { // Conservative limit
        throw new Error('Token too long for WebSocket subprotocol');
      }

      // Step 4: Validate only safe characters
      if (!/^[A-Za-z0-9\-_]*$/.test(encoded)) {
        throw new Error('Token contains invalid characters after encoding');
      }

      return encoded;
    } catch (error) {
      this.logger.error('Token encoding failed', error, {
        service: 'token-decoder'
      });
      throw new Error('Failed to encode token for WebSocket transmission');
    }
  }




}

module.exports = TokenDecoder;
