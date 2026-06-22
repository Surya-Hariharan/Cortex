const { logger } = require('../utils/logger');

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  if (status < 500) {
    return res.status(status).json({ error: err.message || 'Bad request' });
  }
  logger.error({ err, correlationId: req.correlationId }, 'Unhandled server error');
  return res.status(500).json({ error: 'Internal server error' });
}

module.exports = { errorHandler };
