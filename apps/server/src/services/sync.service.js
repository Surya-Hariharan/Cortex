const syncRepo = require('../repositories/sync.repository');
const activityLog = require('./activityLog.service');
const { ApiError } = require('../middleware/errorHandler');

function blobToWire(row) {
    return {
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        ciphertext: row.ciphertext.toString('base64'),
        nonce: row.nonce.toString('base64'),
        version: row.server_version,
        deleted: row.deleted,
        updatedAt: row.updated_at,
    };
}

// Batch upsert with optimistic concurrency. Each blob in the batch is
// applied independently so one conflict doesn't fail the whole push —
// the server can't merge encrypted content, so conflicts are surfaced
// back to the client to resolve after it decrypts both sides.
async function push(userId, { deviceId, blobs }) {
    const accepted = [];
    const conflicts = [];
    const touchedResourceTypes = new Set();

    for (const blob of blobs) {
        const result = await syncRepo.upsertBlob({
            userId,
            deviceId,
            resourceType: blob.resourceType,
            resourceId: blob.resourceId,
            ciphertext: Buffer.from(blob.ciphertext, 'base64'),
            nonce: Buffer.from(blob.nonce, 'base64'),
            baseVersion: blob.baseVersion,
            deleted: blob.deleted,
        });

        if (result.conflict) {
            conflicts.push({
                resourceType: blob.resourceType,
                resourceId: blob.resourceId,
                server: result.current ? blobToWire(result.current) : null,
            });
        } else {
            accepted.push(blobToWire(result.blob));
            touchedResourceTypes.add(blob.resourceType);
        }
    }

    await Promise.all(
        [...touchedResourceTypes].map((resourceType) =>
            syncRepo.upsertSyncMetadata({ userId, deviceId, resourceType, cursor: new Date(), status: 'idle' })
        )
    );
    await activityLog.record(userId, 'sync_push', {
        resourceType: 'sync',
        metadata: { accepted: accepted.length, conflicts: conflicts.length, deviceId },
    });

    return { accepted, conflicts };
}

async function pull(userId, { since, limit, deviceId }) {
    const sinceIso = since || '1970-01-01T00:00:00.000Z';
    const rows = await syncRepo.listChangedSince(userId, sinceIso, limit);
    const blobs = rows.map(blobToWire);
    const cursor = rows.length ? rows[rows.length - 1].updated_at : sinceIso;
    const hasMore = rows.length === (limit || 500);

    if (deviceId && !hasMore) {
        // '_all' is a wildcard sentinel — pull sweeps every resource type at
        // once, unlike push which knows exactly which types it touched.
        await syncRepo.upsertSyncMetadata({ userId, deviceId, resourceType: '_all', cursor, status: 'idle' });
    }

    return { blobs, cursor, hasMore };
}

async function versions(userId, resourceType, resourceId) {
    const existing = await syncRepo.findBlob(userId, resourceType, resourceId);
    if (!existing) throw new ApiError(404, 'not_found', 'No sync history for this resource.');

    const rows = await syncRepo.listVersions(userId, resourceType, resourceId);
    return rows.map((r) => ({
        version: r.server_version,
        ciphertext: r.ciphertext.toString('base64'),
        nonce: r.nonce.toString('base64'),
        createdAt: r.created_at,
    }));
}

async function status(userId) {
    return syncRepo.listSyncMetadata(userId);
}

module.exports = { push, pull, versions, status };
