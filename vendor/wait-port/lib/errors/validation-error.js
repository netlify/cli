class ValidationError extends Error {
  constructor(message) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
    this.name = 'ValidationError';
  }
}

module.exports = ValidationError;
