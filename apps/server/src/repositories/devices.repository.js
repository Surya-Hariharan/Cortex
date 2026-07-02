const { query } = require('../db/pool');

async function upsertDevice({ userId, name, fingerprint, platform, publicKey }) {
    const { rows } = await query(
        `INSERT INTO devices (user_id, name, fingerprint, platform, public_key)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, fingerprint) DO UPDATE SET
            name = EXCLUDED.name,
            platform = EXCLUDED.platform,
            public_key = COALESCE(EXCLUDED.public_key, devices.public_key),
            last_seen_at = now(),
            revoked_at = NULL
         RETURNING *`,
        [userId, name, fingerprint, platform ?? null, publicKey ?? null]
    );
    return rows[0];
}

async function findById(deviceId) {
    const { rows } = await query('SELECT * FROM devices WHERE id = $1', [deviceId]);
    return rows[0] || null;
}

async function findByFingerprint(userId, fingerprint) {
    const { rows } = await query('SELECT * FROM devices WHERE user_id = $1 AND fingerprint = $2', [userId, fingerprint]);
    return rows[0] || null;
}

async function listForUser(userId) {
    const { rows } = await query(
        `SELECT id, name, platform, last_seen_at, created_at, revoked_at
         FROM devices WHERE user_id = $1 ORDER BY last_seen_at DESC`,
        [userId]
    );
    return rows;
}

async function revoke(deviceId, userId) {
    await query('UPDATE devices SET revoked_at = now() WHERE id = $1 AND user_id = $2', [deviceId, userId]);
}

async function revokeAllForUser(userId) {
    await query('UPDATE devices SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
}

async function touchLastSeen(deviceId) {
    await query('UPDATE devices SET last_seen_at = now() WHERE id = $1', [deviceId]);
}

// Stores this device's wrapped copy of the user's symmetric cloud content
// key (RSA-OAEP-wrapped client-side to the device's public_key — see
// apps/desktop/src/services/cloud/contentKey.js). The server persists it but
// can never unwrap it.
async function setWrappedUserKey(deviceId, userId, wrappedUserKey) {
    const { rows } = await query(
        'UPDATE devices SET wrapped_user_key = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
        [wrappedUserKey, deviceId, userId]
    );
    return rows[0] || null;
}

module.exports = {
    upsertDevice,
    findById,
    findByFingerprint,
    listForUser,
    revoke,
    revokeAllForUser,
    touchLastSeen,
    setWrappedUserKey,
};
