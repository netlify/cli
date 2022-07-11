class ConnectionError extends Error {
  constructor(message) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
    this.name = 'ConnectionError';
  }
}

module.exports = ConnectionError;
