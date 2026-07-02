// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const _cjsRequire = createRequire(import.meta.url);
const database = _cjsRequire('../services/storage/database.js');
const contentKey = _cjsRequire('../services/cloud/contentKey.js');
const cloudClient = _cjsRequire('../services/cloud/cloudClient.js');
const cloudTokenStore = _cjsRequire('../services/storage/cloudTokenStore.js');
const cloudSession = _cjsRequire('../services/cloud/cloudSession.js');
const syncEngine = _cjsRequire('../services/cloud/syncEngine.js');

const SESSION = { accessToken: 'at-1', refreshToken: 'rt-1', device: { id: 'device-1' }, user: { id: 'user-1' } };

function fakeDb(overrides = {}) {
    return {
        getDirtyNotes: vi.fn(() => []),
        getDirtyPages: vi.fn(() => []),
        getPendingTombstones: vi.fn(() => []),
        getSyncVersion: vi.fn(() => 0),
        setSyncVersion: vi.fn(),
        markNoteSynced: vi.fn(),
        markPageSynced: vi.fn(),
        markTombstoneSynced: vi.fn(),
        upsertNoteFromCloud: vi.fn(),
        upsertPageFromCloud: vi.fn(),
        applyRemoteDelete: vi.fn(),
        getSyncState: vi.fn(() => null),
        setSyncState: vi.fn(),
        ...overrides,
    };
}

describe('syncEngine', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('isEnabled', () => {
        it('requires configured + a session + an established content key, all three', () => {
            vi.spyOn(cloudClient, 'isConfigured').mockReturnValue(true);
            vi.spyOn(cloudTokenStore, 'getCloudSession').mockReturnValue(SESSION);
            vi.spyOn(contentKey, 'hasContentKey').mockReturnValue(true);
            expect(syncEngine.isEnabled()).toBe(true);

            vi.spyOn(contentKey, 'hasContentKey').mockReturnValue(false);
            expect(syncEngine.isEnabled()).toBe(false);

            vi.spyOn(contentKey, 'hasContentKey').mockReturnValue(true);
            vi.spyOn(cloudTokenStore, 'getCloudSession').mockReturnValue(null);
            expect(syncEngine.isEnabled()).toBe(false);

            vi.spyOn(cloudTokenStore, 'getCloudSession').mockReturnValue(SESSION);
            vi.spyOn(cloudClient, 'isConfigured').mockReturnValue(false);
            expect(syncEngine.isEnabled()).toBe(false);
        });
    });

    describe('runSync', () => {
        beforeEach(() => {
            vi.spyOn(cloudClient, 'isConfigured').mockReturnValue(true);
            vi.spyOn(cloudTokenStore, 'getCloudSession').mockReturnValue(SESSION);
            vi.spyOn(contentKey, 'hasContentKey').mockReturnValue(true);
        });

        it('skips with a reason when not enabled', async () => {
            vi.spyOn(contentKey, 'hasContentKey').mockReturnValue(false);
            const result = await syncEngine.runSync();
            expect(result).toEqual({ skipped: true, reason: 'not_enabled' });
        });

        it('encrypts dirty notes/pages/tombstones and pushes them, then marks accepted ones synced', async () => {
            const db = fakeDb({
                getDirtyNotes: vi.fn(() => [{ id: 1, syncId: 'note-uuid-1', title: 'A', content: 'body', type: 'note', dueDate: null, completed: false }]),
                getDirtyPages: vi.fn(() => [{ id: 'page-1', title: 'P', content: 'c', parentId: null }]),
                getPendingTombstones: vi.fn(() => [{ resource_type: 'note', resource_id: 'note-uuid-old' }]),
            });
            vi.spyOn(database, 'getDatabase').mockReturnValue(db);
            vi.spyOn(contentKey, 'encryptResource').mockReturnValue({ ciphertext: 'CIPH', nonce: 'NONCE' });
            vi.spyOn(cloudClient, 'syncPush').mockResolvedValue({
                accepted: [
                    { resourceType: 'note', resourceId: 'note-uuid-1', version: 2 },
                    { resourceType: 'page', resourceId: 'page-1', version: 1 },
                    { resourceType: 'note', resourceId: 'note-uuid-old', version: 9 },
                ],
                conflicts: [],
            });
            vi.spyOn(cloudClient, 'syncPull').mockResolvedValue({ blobs: [], cursor: 'c1', hasMore: false });
            vi.spyOn(cloudSession, 'withValidAccessToken').mockImplementation((fn) => fn('at-1'));

            const result = await syncEngine.runSync({ trigger: 'manual' });

            expect(result.ok).toBe(true);
            expect(result.pushed).toBe(3);
            expect(result.conflicts).toBe(0);

            expect(cloudClient.syncPush).toHaveBeenCalledWith('at-1', {
                deviceId: 'device-1',
                blobs: [
                    { resourceType: 'note', resourceId: 'note-uuid-1', ciphertext: 'CIPH', nonce: 'NONCE', baseVersion: 0, deleted: false },
                    { resourceType: 'page', resourceId: 'page-1', ciphertext: 'CIPH', nonce: 'NONCE', baseVersion: 0, deleted: false },
                    { resourceType: 'note', resourceId: 'note-uuid-old', ciphertext: 'CIPH', nonce: 'NONCE', baseVersion: 0, deleted: true },
                ],
            });
            expect(db.markNoteSynced).toHaveBeenCalledWith(1);
            expect(db.markPageSynced).toHaveBeenCalledWith('page-1');
            expect(db.markTombstoneSynced).toHaveBeenCalledWith('note', 'note-uuid-old');
            expect(db.setSyncVersion).toHaveBeenCalledWith('note', 'note-uuid-1', 2);
        });

        it('leaves conflicting resources dirty and reports them, without applying local writes for them', async () => {
            const db = fakeDb({
                getDirtyNotes: vi.fn(() => [{ id: 1, syncId: 'note-uuid-1', title: 'A', content: 'body', type: 'note', dueDate: null, completed: false }]),
            });
            vi.spyOn(database, 'getDatabase').mockReturnValue(db);
            vi.spyOn(contentKey, 'encryptResource').mockReturnValue({ ciphertext: 'C', nonce: 'N' });
            vi.spyOn(cloudClient, 'syncPush').mockResolvedValue({
                accepted: [],
                conflicts: [{ resourceType: 'note', resourceId: 'note-uuid-1', server: { version: 5 } }],
            });
            vi.spyOn(cloudClient, 'syncPull').mockResolvedValue({ blobs: [], cursor: 'c', hasMore: false });
            vi.spyOn(cloudSession, 'withValidAccessToken').mockImplementation((fn) => fn('at-1'));

            const result = await syncEngine.runSync();

            expect(result.pushed).toBe(0);
            expect(result.conflicts).toBe(1);
            expect(db.markNoteSynced).not.toHaveBeenCalled();
        });

        it('decrypts pulled blobs and applies them locally, and persists the pull cursor', async () => {
            const db = fakeDb();
            vi.spyOn(database, 'getDatabase').mockReturnValue(db);
            vi.spyOn(cloudClient, 'syncPush').mockResolvedValue({ accepted: [], conflicts: [] }); // nothing dirty locally
            vi.spyOn(cloudClient, 'syncPull').mockResolvedValueOnce({
                blobs: [
                    { resourceType: 'note', resourceId: 'note-uuid-2', version: 3, deleted: false, ciphertext: 'C', nonce: 'N' },
                    { resourceType: 'note', resourceId: 'note-uuid-3', version: 1, deleted: true, ciphertext: 'C', nonce: 'N' },
                ],
                cursor: '2026-03-01T00:00:00.000Z',
                hasMore: false,
            });
            vi.spyOn(contentKey, 'decryptResource').mockReturnValue({ title: 'Remote', content: 'body', type: 'note', dueDate: null, completed: false });
            vi.spyOn(cloudSession, 'withValidAccessToken').mockImplementation((fn) => fn('at-1'));

            const result = await syncEngine.runSync();

            expect(result.pulled).toBe(2);
            expect(db.upsertNoteFromCloud).toHaveBeenCalledWith(expect.objectContaining({ syncId: 'note-uuid-2', title: 'Remote' }));
            expect(db.applyRemoteDelete).toHaveBeenCalledWith('note', 'note-uuid-3');
            expect(db.setSyncState).toHaveBeenCalledWith('pull_cursor', '2026-03-01T00:00:00.000Z');
        });

        it('records a failed result instead of throwing when the network call rejects', async () => {
            const db = fakeDb();
            vi.spyOn(database, 'getDatabase').mockReturnValue(db);
            vi.spyOn(cloudSession, 'withValidAccessToken').mockRejectedValue(new Error('network down'));
            // getDirtyNotes empty means pushChanges short-circuits before calling withValidAccessToken,
            // so force a pull attempt to hit the failing path.
            db.getSyncState.mockReturnValue(null);

            const result = await syncEngine.runSync();

            expect(result.ok).toBe(false);
            expect(result.error).toBe('network down');
            expect(syncEngine.isSyncing()).toBe(false); // the in-flight guard is always released
        });
    });

    describe('ensureDeviceEnrolled', () => {
        afterEach(() => vi.restoreAllMocks());

        it('does nothing when a content key is already established', async () => {
            vi.spyOn(contentKey, 'hasContentKey').mockReturnValue(true);
            const adoptSpy = vi.spyOn(contentKey, 'adoptWrapped');
            const result = await syncEngine.ensureDeviceEnrolled({ wrapped_user_key: 'ignored' });
            expect(result).toEqual({ enrolled: true, minted: false });
            expect(adoptSpy).not.toHaveBeenCalled();
        });

        it('adopts an existing wrapped key when this device already has one server-side', async () => {
            vi.spyOn(contentKey, 'hasContentKey').mockReturnValue(false);
            const adoptSpy = vi.spyOn(contentKey, 'adoptWrapped').mockImplementation(() => {});
            const result = await syncEngine.ensureDeviceEnrolled({ id: 'device-1', wrapped_user_key: 'wrapped-blob' });
            expect(adoptSpy).toHaveBeenCalledWith('wrapped-blob');
            expect(result).toEqual({ enrolled: true, minted: false });
        });

        it('mints a new content key and uploads this device\'s wrapped copy when none exists anywhere', async () => {
            vi.spyOn(contentKey, 'hasContentKey').mockReturnValue(false);
            vi.spyOn(contentKey, 'generateAndWrap').mockReturnValue('freshly-wrapped');
            const setDeviceKeySpy = vi.spyOn(cloudClient, 'setDeviceKey').mockResolvedValue({ success: true });
            vi.spyOn(cloudSession, 'withValidAccessToken').mockImplementation((fn) => fn('at-1'));

            const result = await syncEngine.ensureDeviceEnrolled({ id: 'device-1' });

            expect(result).toEqual({ enrolled: true, minted: true });
            expect(setDeviceKeySpy).toHaveBeenCalledWith('at-1', 'device-1', 'freshly-wrapped');
        });
    });
});
