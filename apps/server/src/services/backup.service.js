const backupRepo = require('../repositories/backup.repository');
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

// A backup is a cheap, named pointer at the user's current sync cursor —
// not a second copy of ciphertext. Content already lives durably in
// sync_blobs/sync_blob_versions from ongoing sync; this just records "this
// is a restore point" so it can be listed and later restored from.
async function createBackup(userId, { deviceId, kind = 'manual', label } = {}) {
    const summary = await syncRepo.getSummaryForUser(userId);
    const backup = await backupRepo.create({
        userId,
        deviceId,
        kind,
        label,
        syncCursor: summary.cursor,
        resourceCount: summary.resource_count,
        totalBytes: summary.total_bytes,
    });
    await activityLog.record(userId, 'backup_created', {
        resourceType: 'backup',
        resourceId: backup.id,
        metadata: { kind },
    });
    return backup;
}

async function listBackups(userId) {
    return backupRepo.listForUser(userId);
}

async function restoreBackup(backupId, userId) {
    const backup = await backupRepo.findById(backupId, userId);
    if (!backup) throw new ApiError(404, 'not_found', 'Backup not found.');

    const rows = await syncRepo.listAsOf(userId, backup.sync_cursor);
    await backupRepo.markRestored(backupId, userId);
    await activityLog.record(userId, 'backup_restored', { resourceType: 'backup', resourceId: backupId });

    return { backup, blobs: rows.map(blobToWire) };
}

module.exports = { createBackup, listBackups, restoreBackup };
