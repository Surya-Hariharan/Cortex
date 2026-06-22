const { v4: uuidv4 } = require('uuid');

function correlationId(req, res, next) {
  req.correlationId = uuidv4();
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
}

module.exports = { correlationId };
