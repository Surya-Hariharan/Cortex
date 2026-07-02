const logger = require('../utils/logger');
const config = require('../config');

class ApiError extends Error {
    constructor(status, code, detail) {
        super(detail);
        this.status = status;
        this.code = code;
    }
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
    const status = err.status || 500;
    if (status >= 500) logger.error(err.stack || err.message);

    res.status(status).json({
        error: err.code || 'internal_error',
        detail: status >= 500 && config.env === 'production' ? 'Something went wrong.' : err.message,
    });
}

function notFoundHandler(req, res) {
    res.status(404).json({ error: 'not_found', detail: `No route for ${req.method} ${req.path}` });
}

module.exports = { errorHandler, notFoundHandler, ApiError };
