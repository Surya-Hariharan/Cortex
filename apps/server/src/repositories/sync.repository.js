const { query, withTransaction } = require('../db/pool');

async function findBlob(userId, resourceType, resourceId) {
    const { rows } = await query(
        'SELECT * FROM sync_blobs WHERE user_id = $1 AND resource_type = $2 AND resource_id = $3',
        [userId, resourceType, resourceId]
    );
    return rows[0] || null;
}

// Optimistic-concurrency upsert: caller supplies the version they last saw
// (baseVersion). If it doesn't match the current server_version, the write
// is rejected (caller/service turns this into a 409) instead of silently
// overwriting a concurrent change the server can't read to merge.
async function upsertBlob({ userId, resourceType, resourceId, ciphertext, nonce, baseVersion, deviceId, deleted = false }) {
    return withTransaction(async (client) => {
        const { rows: existingRows } = await client.query(
            'SELECT * FROM sync_blobs WHERE user_id = $1 AND resource_type = $2 AND resource_id = $3 FOR UPDATE',
            [userId, resourceType, resourceId]
        );
        const existing = existingRows[0];

        if (existing) {
            if (baseVersion !== existing.server_version) {
                return { conflict: true, current: existing };
            }
            await client.query(
                `INSERT INTO sync_blob_versions (blob_id, server_version, ciphertext, nonce, updated_by_device_id)
                 VALUES ($1, $2, $3, $4, $5)`,
                [existing.id, existing.server_version, existing.ciphertext, existing.nonce, existing.updated_by_device_id]
            );
            const { rows } = await client.query(
                `UPDATE sync_blobs SET ciphertext = $1, nonce = $2, server_version = server_version + 1,
                    updated_by_device_id = $3, deleted = $4, updated_at = now()
                 WHERE id = $5 RETURNING *`,
                [ciphertext, nonce, deviceId, deleted, existing.id]
            );
            return { conflict: false, blob: rows[0] };
        }

        if (baseVersion !== 0) {
            // Client thinks a version exists server-side but it doesn't (deleted/never synced) — conflict.
            return { conflict: true, current: null };
        }

        const { rows } = await client.query(
            `INSERT INTO sync_blobs (user_id, resource_type, resource_id, ciphertext, nonce, updated_by_device_id, deleted)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [userId, resourceType, resourceId, ciphertext, nonce, deviceId, deleted]
        );
        return { conflict: false, blob: rows[0] };
    });
}

async function listChangedSince(userId, sinceIso, limit = 500) {
    const { rows } = await query(
        `SELECT * FROM sync_blobs WHERE user_id = $1 AND updated_at > $2
         ORDER BY updated_at ASC LIMIT $3`,
        [userId, sinceIso, limit]
    );
    return rows;
}

async function listVersions(userId, resourceType, resourceId) {
    const { rows } = await query(
        `SELECT v.server_version, v.ciphertext, v.nonce, v.created_at, v.updated_by_device_id
         FROM sync_blob_versions v
         JOIN sync_blobs b ON b.id = v.blob_id
         WHERE b.user_id = $1 AND b.resource_type = $2 AND b.resource_id = $3
         ORDER BY v.server_version DESC`,
        [userId, resourceType, resourceId]
    );
    return rows;
}

// Per-device, per-resource-type sync cursor bookkeeping — see
// sync_metadata in db/migrations/003_sync.sql. `resourceType` may be the
// literal wildcard '_all' for pull, which sweeps every resource type at once.
async function upsertSyncMetadata({ userId, deviceId, resourceType, cursor, status = 'idle', error = null }) {
    const { rows } = await query(
        `INSERT INTO sync_metadata (user_id, device_id, resource_type, last_cursor, last_synced_at, status, last_error)
         VALUES ($1, $2, $3, $4, now(), $5, $6)
         ON CONFLICT (device_id, resource_type) DO UPDATE SET
            last_cursor = EXCLUDED.last_cursor,
            last_synced_at = now(),
            status = EXCLUDED.status,
            last_error = EXCLUDED.last_error,
            updated_at = now()
         RETURNING *`,
        [userId, deviceId, resourceType, cursor, status, error]
    );
    return rows[0];
}

async function listSyncMetadata(userId) {
    const { rows } = await query('SELECT * FROM sync_metadata WHERE user_id = $1 ORDER BY resource_type', [userId]);
    return rows;
}

// Used by backup.service.js to record a cheap, metadata-only restore point.
async function getSummaryForUser(userId) {
    const { rows } = await query(
        `SELECT count(*)::int AS resource_count,
                COALESCE(sum(octet_length(ciphertext)), 0)::bigint AS total_bytes,
                COALESCE(max(updated_at), now()) AS cursor
         FROM sync_blobs WHERE user_id = $1 AND deleted = false`,
        [userId]
    );
    return rows[0];
}

// Everything at-or-before a point in time — what a backup restores. Note
// this returns each resource's *current* row if it hasn't changed since
// `cursorIso`; resources edited after the backup was taken are excluded
// rather than time-travelled back to an old version (full point-in-time
// reconstruction across every resource is a larger feature than this
// covers — see apps/server/docs/TESTING.md).
async function listAsOf(userId, cursorIso, limit = 10000) {
    const { rows } = await query(
        `SELECT * FROM sync_blobs WHERE user_id = $1 AND updated_at <= $2 ORDER BY updated_at ASC LIMIT $3`,
        [userId, cursorIso, limit]
    );
    return rows;
}

module.exports = {
    findBlob,
    upsertBlob,
    listChangedSince,
    listVersions,
    upsertSyncMetadata,
    listSyncMetadata,
    getSummaryForUser,
    listAsOf,
};
