const { Base64 } = require('js-base64');

class TokenDecoder {
  constructor(logger) {
    this.logger = logger;
    this.logger.info('Using js-base64 library (industry standard)', {
      service: 'token-decoder'
    });
  }

  decodeTokenFromWebSocket(encodedToken) {
    try {
      if (typeof encodedToken !== 'string' || encodedToken.length < 10) {
        throw new Error('Missing or short token');
      }

      const decoded = Base64.decode(encodedToken, true);

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
