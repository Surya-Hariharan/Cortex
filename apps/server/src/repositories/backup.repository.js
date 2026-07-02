const { query } = require('../db/pool');

async function create({ userId, deviceId, kind, label, syncCursor, resourceCount, totalBytes }) {
    const { rows } = await query(
        `INSERT INTO backup_metadata (user_id, device_id, kind, label, sync_cursor, resource_count, total_bytes, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'complete') RETURNING *`,
        [userId, deviceId ?? null, kind, label ?? null, syncCursor, resourceCount, totalBytes]
    );
    return rows[0];
}

async function listForUser(userId, { limit = 50 } = {}) {
    const { rows } = await query(
        'SELECT * FROM backup_metadata WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
        [userId, limit]
    );
    return rows;
}

async function findById(id, userId) {
    const { rows } = await query('SELECT * FROM backup_metadata WHERE id = $1 AND user_id = $2', [id, userId]);
    return rows[0] || null;
}

async function markRestored(id, userId) {
    const { rows } = await query(
        `UPDATE backup_metadata SET status = 'restored', restored_at = now() WHERE id = $1 AND user_id = $2 RETURNING *`,
        [id, userId]
    );
    return rows[0] || null;
}

module.exports = { create, listForUser, findById, markRestored };
