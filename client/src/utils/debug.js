/**
 * Debug utility for React components
 * Only logs in development mode
 */

const isDevelopment = import.meta.env.DEV;

class Debug {
  static log(component, message, data = {}) {
    if (isDevelopment) {
      console.log(`[${component}] ${message}`, data);
    }
  }

  static warn(component, message, data = {}) {
    if (isDevelopment) {
      console.warn(`[${component}] ${message}`, data);
    }
  }

  static error(component, message, error = null) {
    if (isDevelopment) {
      console.error(`[${component}] ${message}`, error);
    }
  }

  static auth(message, data = {}) {
    this.log('Auth', message, data);
  }

  static editor(message, data = {}) {
    this.log('Editor', message, data);
  }

  static yjs(message, data = {}) {
    this.log('YJS', message, data);
  }

  static connection(message, data = {}) {
    this.log('Connection', message, data);
  }
}

export default Debug;
