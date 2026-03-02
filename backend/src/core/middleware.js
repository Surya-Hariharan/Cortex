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
    const session = db.prepare('SELECT * FROM sessions WHERE session_id = ? AND expires_at > ?').get(sessionId, Date.now());
    if (!session) return res.status(401).json({ error: 'Invalid or expired session.' });

    // Load user
    const row = db.prepare('SELECT * FROM users WHERE user_id = ?').get(session.user_id);
    if (!row) return res.status(401).json({ error: 'User not found.' });

    req.user = {
        userId: row.user_id, fullName: row.full_name, email: row.email,
        collegeName: row.college_name, rollNumber: row.roll_number,
        degree: row.degree, courseName: row.course_name,
        academicLevel: row.academic_level, phoneNumber: row.phone_number,
        isVerified: !!row.is_verified, authMode: row.auth_mode,
    };
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
