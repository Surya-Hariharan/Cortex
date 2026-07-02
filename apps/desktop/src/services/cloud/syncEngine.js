/**
 * Cortex — Cloud Sync Engine
 *
 * Orchestrates push/pull of the local resource types that exist today
 * (notes, workspace_pages — see database.js) against apps/server's
 * zero-knowledge sync API. Everything here is additive and only runs when
 * cloud sync is enabled (isEnabled()); the local-first CRUD paths in
 * main.js behave identically whether or not this module ever runs, and
 * every entry point here degrades to a no-op rather than throwing when
 * disabled — see runSync().
 *
 * Content is encrypted client-side with the user's cloud content key
 * (contentKey.js) before it ever leaves the device; the server only ever
 * sees ciphertext (see apps/server/docs/SECURITY.md). Conflicts (a resource
 * changed on two devices before either synced) are never silently
 * overwritten — the push result's `conflicts` are left dirty locally and
 * reported back via getLastResult() for a future UI to surface; automatic
 * merging isn't attempted since the server can't read the content to merge
 * it, and this pass doesn't build a conflict-resolution UI.
 */

// Required as namespace objects (not destructured) so tests can
// vi.spyOn(mod, 'fn') and have it take effect here — see the same note in
// apps/server/src/services/auth.service.js.
const database = require('../storage/database');
const contentKey = require('./contentKey');
const cloudClient = require('./cloudClient');
const cloudTokenStore = require('../storage/cloudTokenStore');
const cloudSession = require('./cloudSession');

let _syncing = false;
let _lastResult = null;

function isEnabled() {
    return cloudClient.isConfigured() && !!cloudTokenStore.getCloudSession() && contentKey.hasContentKey();
}

function getLastResult() {
    return _lastResult;
}

function isSyncing() {
    return _syncing;
}

// Called once right after a successful cloud login/register — establishes
// this device's copy of the cloud content key so push/pull can run.
async function ensureDeviceEnrolled(device) {
    if (contentKey.hasContentKey()) return { enrolled: true, minted: false };

    if (device?.wrapped_user_key) {
        contentKey.adoptWrapped(device.wrapped_user_key);
        return { enrolled: true, minted: false };
    }

    // No wrapped copy exists for this device. Mint a fresh content key and
    // upload this device's wrapped copy — correct for the common case
    // (first device this account has ever enabled cloud sync on). If the
    // account already has a content key established on a *different*
    // device, that device would need to wrap a copy for this one; that
    // handshake isn't built in this pass (see module docblock) — this
    // device would need to be re-adopted once it is.
    const wrappedForSelf = contentKey.generateAndWrap();
    if (device?.id) {
        await cloudSession.withValidAccessToken((accessToken) => cloudClient.setDeviceKey(accessToken, device.id, wrappedForSelf)).catch(() => {
            // Best-effort: sync still works on this device even if the
            // upload fails now: retried by the caller next time isEnabled()
            // is re-checked, since the key is already persisted locally.
        });
    }
    return { enrolled: true, minted: true };
}

function collectDirtyBlobs(db) {
    const blobs = [];

    for (const note of db.getDirtyNotes()) {
        const { ciphertext, nonce } = contentKey.encryptResource({
            title: note.title,
            content: note.content,
            type: note.type,
            dueDate: note.dueDate,
            completed: note.completed,
        });
        blobs.push({
            resourceType: 'note',
            resourceId: note.syncId,
            ciphertext,
            nonce,
            baseVersion: db.getSyncVersion('note', note.syncId),
            deleted: false,
            _kind: 'note',
            _localId: note.id,
        });
    }

    for (const page of db.getDirtyPages()) {
        const { ciphertext, nonce } = contentKey.encryptResource({
            title: page.title,
            content: page.content,
            parentId: page.parentId,
        });
        blobs.push({
            resourceType: 'page',
            resourceId: page.id,
            ciphertext,
            nonce,
            baseVersion: db.getSyncVersion('page', page.id),
            deleted: false,
            _kind: 'page',
            _localId: page.id,
        });
    }

    for (const tombstone of db.getPendingTombstones()) {
        const { ciphertext, nonce } = contentKey.encryptResource({ deleted: true });
        blobs.push({
            resourceType: tombstone.resource_type,
            resourceId: tombstone.resource_id,
            ciphertext,
            nonce,
            baseVersion: db.getSyncVersion(tombstone.resource_type, tombstone.resource_id),
            deleted: true,
            _kind: 'tombstone',
        });
    }

    return blobs;
}

async function pushChanges(db) {
    const blobs = collectDirtyBlobs(db);
    if (!blobs.length) return { pushed: 0, conflicts: 0, conflictDetails: [] };

    const session = cloudTokenStore.getCloudSession();
    const wireBlobs = blobs.map(({ resourceType, resourceId, ciphertext, nonce, baseVersion, deleted }) => ({
        resourceType,
        resourceId,
        ciphertext,
        nonce,
        baseVersion,
        deleted,
    }));

    const result = await cloudSession.withValidAccessToken((accessToken) =>
        cloudClient.syncPush(accessToken, { deviceId: session.device?.id, blobs: wireBlobs })
    );

    const byKey = new Map(blobs.map((b) => [`${b.resourceType}:${b.resourceId}`, b]));
    for (const accepted of result.accepted) {
        db.setSyncVersion(accepted.resourceType, accepted.resourceId, accepted.version);
        const local = byKey.get(`${accepted.resourceType}:${accepted.resourceId}`);
        if (!local) continue;
        if (local._kind === 'note') db.markNoteSynced(local._localId);
        else if (local._kind === 'page') db.markPageSynced(local._localId);
        else if (local._kind === 'tombstone') db.markTombstoneSynced(accepted.resourceType, accepted.resourceId);
    }

    return { pushed: result.accepted.length, conflicts: result.conflicts.length, conflictDetails: result.conflicts };
}

function applyPulledBlob(db, blob) {
    db.setSyncVersion(blob.resourceType, blob.resourceId, blob.version);
    if (blob.deleted) {
        db.applyRemoteDelete(blob.resourceType, blob.resourceId);
        return;
    }
    const value = contentKey.decryptResource(blob);
    if (blob.resourceType === 'note') {
        db.upsertNoteFromCloud({
            syncId: blob.resourceId,
            title: value.title,
            content: value.content,
            type: value.type,
            dueDate: value.dueDate,
            completed: value.completed,
        });
    } else if (blob.resourceType === 'page') {
        db.upsertPageFromCloud({ id: blob.resourceId, title: value.title, content: value.content, parentId: value.parentId });
    }
    // Unknown resource types (future: task/whiteboard/mermaid diagrams)
    // are safely ignored rather than erroring — see docs/ARCHITECTURE.md.
}

async function pullChanges(db) {
    const session = cloudTokenStore.getCloudSession();
    let pulled = 0;
    let hasMore = true;

    while (hasMore) {
        const since = db.getSyncState('pull_cursor') || undefined;
        const result = await cloudSession.withValidAccessToken((accessToken) =>
            cloudClient.syncPull(accessToken, { since, limit: 500, deviceId: session.device?.id })
        );
        for (const blob of result.blobs) applyPulledBlob(db, blob);
        if (result.cursor) db.setSyncState('pull_cursor', result.cursor);
        pulled += result.blobs.length;
        hasMore = result.hasMore;
    }

    return { pulled };
}

// Entry point for both the manual "Sync now" action and the background
// interval in main.js. Safe to call whenever — no-ops with a `skipped`
// reason if cloud sync isn't enabled or a run is already in flight.
async function runSync({ trigger = 'manual' } = {}) {
    if (!isEnabled()) return { skipped: true, reason: 'not_enabled' };
    if (_syncing) return { skipped: true, reason: 'already_running' };

    _syncing = true;
    try {
        const db = database.getDatabase();
        if (!db) return { skipped: true, reason: 'no_local_db' };

        const pushResult = await pushChanges(db);
        const pullResult = await pullChanges(db);

        _lastResult = {
            ok: true,
            trigger,
            at: new Date().toISOString(),
            pushed: pushResult.pushed,
            conflicts: pushResult.conflicts,
            conflictDetails: pushResult.conflictDetails,
            pulled: pullResult.pulled,
        };
    } catch (err) {
        _lastResult = { ok: false, trigger, at: new Date().toISOString(), error: err.message };
    } finally {
        _syncing = false;
    }
    return _lastResult;
}

module.exports = { isEnabled, isSyncing, getLastResult, ensureDeviceEnrolled, runSync };
