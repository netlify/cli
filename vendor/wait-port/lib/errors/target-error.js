class TargetError extends Error {
  constructor(message) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
    this.name = 'TargetError';
  }
}

module.exports = TargetError;
