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
      if (typeof encodedToken !== 'string' || encodedToken.length < 10) {
        throw new Error('Missing or short token');
      }

      // Attempt to decode directly
      const decoded = Base64.decode(encodedToken, true);

      // Fast structural check without regex
      const parts = decoded.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT structure');
      }

      return decoded;
    } catch (error) {
      this.logger?.error?.('Token decoding failed', error, {
        encodedTokenLength: encodedToken?.length || 0,
        service: 'token-decoder'
      });
      throw new Error('Failed to decode token from WebSocket');
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
      if (typeof token !== 'string' || token.length < 10) {
        throw new Error('Invalid token input');
      }

      const encoded = Base64.encode(token, true); // base64url-safe

      if (encoded.length > 1000) {
        throw new Error('Encoded token too long for WebSocket');
      }

      return encoded;
    } catch (error) {
      this.logger?.error?.('Token encoding failed', error, {
        service: 'token-encoder'
      });
      throw new Error('Failed to encode token for WebSocket');
    }
  }




}

module.exports = TokenDecoder;
