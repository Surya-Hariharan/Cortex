/**
 * Cortex — Middleware
 * Auth middleware + error handler, isolated from route logic.
 */

const { getDb } = require('../storage/dbInit');

/**
 * Auth middleware — validates session token from Authorization header.
 * Attaches req.user and req.sessionId on success.
 */
function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required.' });
    }

    const sessionId = header.slice(7);
    const db = getDb();
    if (!db) return res.status(500).json({ error: 'Database not ready.' });

    // Validate session
    const session = db.getSession(sessionId);
    if (!session) return res.status(401).json({ error: 'Invalid or expired session.' });

    // Load user
    const user = db.getUserById(session.userId);
    if (!user) return res.status(401).json({ error: 'User not found.' });

    req.user = user;
    req.sessionId = sessionId;
    next();
}

/**
 * Global error handler
 */
function errorHandler(err, req, res, _next) {
    console.error('[Cortex] Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error.' });
}

module.exports = { authMiddleware, errorHandler };
