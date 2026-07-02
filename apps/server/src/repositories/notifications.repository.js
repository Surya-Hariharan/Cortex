const { query } = require('../db/pool');

async function create(userId, type, payload = {}) {
    const { rows } = await query(
        'INSERT INTO notifications (user_id, type, payload) VALUES ($1, $2, $3) RETURNING *',
        [userId, type, JSON.stringify(payload)]
    );
    return rows[0];
}

async function listForUser(userId, { unreadOnly = false, limit = 50 } = {}) {
    const clause = unreadOnly ? 'AND read_at IS NULL' : '';
    const { rows } = await query(
        `SELECT * FROM notifications WHERE user_id = $1 ${clause} ORDER BY created_at DESC LIMIT $2`,
        [userId, limit]
    );
    return rows;
}

async function markRead(id, userId) {
    const { rows } = await query(
        'UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 RETURNING *',
        [id, userId]
    );
    return rows[0] || null;
}

async function markAllRead(userId) {
    await query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [userId]);
}

async function registerPushToken({ userId, deviceId, platform, token }) {
    const { rows } = await query(
        `INSERT INTO push_tokens (user_id, device_id, platform, token) VALUES ($1, $2, $3, $4)
         ON CONFLICT (device_id, token) DO NOTHING RETURNING *`,
        [userId, deviceId, platform, token]
    );
    return rows[0] || null;
}

async function removePushToken(id, userId) {
    await query('DELETE FROM push_tokens WHERE id = $1 AND user_id = $2', [id, userId]);
}

module.exports = { create, listForUser, markRead, markAllRead, registerPushToken, removePushToken };
