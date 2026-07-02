import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// require()'d rather than import'd — see the comment in auth.service.test.js
// for why this matters for vi.spyOn() to actually take effect.
const syncRepo = require('../../src/repositories/sync.repository.js');
const activityLog = require('../../src/services/activityLog.service.js');
const syncService = require('../../src/services/sync.service.js');

function blobRow(overrides = {}) {
    return {
        resource_type: 'note',
        resource_id: 'note-1',
        ciphertext: Buffer.from('cipher'),
        nonce: Buffer.from('nonce'),
        server_version: 2,
        deleted: false,
        updated_at: new Date().toISOString(),
        ...overrides,
    };
}

describe('sync.service', () => {
    let repo;

    beforeEach(() => {
        repo = {
            upsertBlob: vi.spyOn(syncRepo, 'upsertBlob'),
            listChangedSince: vi.spyOn(syncRepo, 'listChangedSince'),
            upsertSyncMetadata: vi.spyOn(syncRepo, 'upsertSyncMetadata').mockResolvedValue({}),
        };
        vi.spyOn(activityLog, 'record').mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('push', () => {
        it('accepts a blob with a matching base version', async () => {
            repo.upsertBlob.mockResolvedValue({ conflict: false, blob: blobRow() });

            const result = await syncService.push('user-1', {
                deviceId: 'device-1',
                blobs: [{ resourceType: 'note', resourceId: 'note-1', ciphertext: 'AAAA', nonce: 'BBBB', baseVersion: 1 }],
            });

            expect(result.accepted).toHaveLength(1);
            expect(result.conflicts).toHaveLength(0);
            expect(result.accepted[0].version).toBe(2);
            expect(repo.upsertSyncMetadata).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', deviceId: 'device-1', resourceType: 'note' }));
            expect(activityLog.record).toHaveBeenCalledWith('user-1', 'sync_push', expect.any(Object));
        });

        it('reports a conflict without throwing, carrying the server copy for client-side merge', async () => {
            repo.upsertBlob.mockResolvedValue({ conflict: true, current: blobRow({ server_version: 5 }) });

            const result = await syncService.push('user-1', {
                deviceId: 'device-1',
                blobs: [{ resourceType: 'note', resourceId: 'note-1', ciphertext: 'AAAA', nonce: 'BBBB', baseVersion: 1 }],
            });

            expect(result.accepted).toHaveLength(0);
            expect(result.conflicts).toHaveLength(1);
            expect(result.conflicts[0].server.version).toBe(5);
        });

        it('processes each blob in a batch independently', async () => {
            repo.upsertBlob
                .mockResolvedValueOnce({ conflict: false, blob: blobRow({ resource_id: 'note-1' }) })
                .mockResolvedValueOnce({ conflict: true, current: blobRow({ resource_id: 'note-2', server_version: 9 }) });

            const result = await syncService.push('user-1', {
                deviceId: 'device-1',
                blobs: [
                    { resourceType: 'note', resourceId: 'note-1', ciphertext: 'AAAA', nonce: 'BBBB', baseVersion: 1 },
                    { resourceType: 'note', resourceId: 'note-2', ciphertext: 'CCCC', nonce: 'DDDD', baseVersion: 3 },
                ],
            });

            expect(result.accepted).toHaveLength(1);
            expect(result.conflicts).toHaveLength(1);
        });
    });

    describe('pull', () => {
        it('returns an empty page and echoes the cursor when nothing changed', async () => {
            repo.listChangedSince.mockResolvedValue([]);
            const result = await syncService.pull('user-1', { since: '2026-01-01T00:00:00.000Z' });
            expect(result.blobs).toEqual([]);
            expect(result.cursor).toBe('2026-01-01T00:00:00.000Z');
        });

        it('advances the cursor to the last row returned', async () => {
            repo.listChangedSince.mockResolvedValue([blobRow({ updated_at: '2026-02-01T00:00:00.000Z' })]);
            const result = await syncService.pull('user-1', {});
            expect(result.cursor).toBe('2026-02-01T00:00:00.000Z');
            expect(result.blobs).toHaveLength(1);
        });

        it('records the device sync cursor once a page fully drains', async () => {
            repo.listChangedSince.mockResolvedValue([blobRow({ updated_at: '2026-02-01T00:00:00.000Z' })]);
            await syncService.pull('user-1', { deviceId: 'device-1' });
            expect(repo.upsertSyncMetadata).toHaveBeenCalledWith(
                expect.objectContaining({ userId: 'user-1', deviceId: 'device-1', resourceType: '_all' })
            );
        });
    });

    describe('status', () => {
        it('delegates to the repository', async () => {
            const listSpy = vi.spyOn(syncRepo, 'listSyncMetadata').mockResolvedValue([{ resource_type: 'note' }]);
            const result = await syncService.status('user-1');
            expect(listSpy).toHaveBeenCalledWith('user-1');
            expect(result).toEqual([{ resource_type: 'note' }]);
        });
    });
});
