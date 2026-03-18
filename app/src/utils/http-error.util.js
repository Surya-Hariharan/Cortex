class HttpError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = options.code || 'ERROR';
    this.field = options.field || null;
    this.details = options.details || null;
    this.expose = options.expose !== false;
  }
}

function badRequest(message, options = {}) {
  return new HttpError(400, message, { ...options, code: options.code || 'BAD_REQUEST' });
}

function unauthorized(message, options = {}) {
  return new HttpError(401, message, { ...options, code: options.code || 'UNAUTHORIZED' });
}

function forbidden(message, options = {}) {
  return new HttpError(403, message, { ...options, code: options.code || 'FORBIDDEN' });
}

function tooManyRequests(message, options = {}) {
  return new HttpError(429, message, { ...options, code: options.code || 'TOO_MANY_REQUESTS' });
}

module.exports = {
  HttpError,
  badRequest,
  unauthorized,
  forbidden,
  tooManyRequests,
};
