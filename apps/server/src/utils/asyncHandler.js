// Wraps an async route handler so rejected promises reach errorHandler
// instead of crashing the process or hanging the request.
function asyncHandler(fn) {
    return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { asyncHandler };
