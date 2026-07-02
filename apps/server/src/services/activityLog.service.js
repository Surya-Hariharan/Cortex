const { query } = require('../db/pool');
const logger = require('../utils/logger');

// Best-effort audit trail: a logging failure must never break the action
// being logged (e.g. a DB hiccup while recording "login" must not fail the
// login itself), so failures are swallowed here, not propagated.
async function record(userId, action, { resourceType = null, resourceId = null, metadata = {} } = {}) {
    try {
        await query(
            `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, metadata)
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, action, resourceType, resourceId, JSON.stringify(metadata)]
        );
    } catch (err) {
        logger.warn(`[activityLog] failed to record "${action}" for user ${userId}: ${err.message}`);
    }
}

async function listForUser(userId, { limit = 100 } = {}) {
    const { rows } = await query(
        'SELECT * FROM activity_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
        [userId, limit]
    );
    return rows;
}

module.exports = { record, listForUser };
