import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const backupRepo = require('../../src/repositories/backup.repository.js');
const syncRepo = require('../../src/repositories/sync.repository.js');
const activityLog = require('../../src/services/activityLog.service.js');
const backupService = require('../../src/services/backup.service.js');

describe('backup.service', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('createBackup', () => {
        it('records a metadata-only restore point at the current sync cursor', async () => {
            vi.spyOn(syncRepo, 'getSummaryForUser').mockResolvedValue({
                resource_count: 12,
                total_bytes: 4096,
                cursor: '2026-06-01T00:00:00.000Z',
            });
            const createSpy = vi.spyOn(backupRepo, 'create').mockResolvedValue({ id: 'backup-1', kind: 'manual' });
            vi.spyOn(activityLog, 'record').mockResolvedValue(undefined);

            const result = await backupService.createBackup('user-1', { deviceId: 'device-1', kind: 'manual' });

            expect(createSpy).toHaveBeenCalledWith({
                userId: 'user-1',
                deviceId: 'device-1',
                kind: 'manual',
                label: undefined,
                syncCursor: '2026-06-01T00:00:00.000Z',
                resourceCount: 12,
                totalBytes: 4096,
            });
            expect(result).toEqual({ id: 'backup-1', kind: 'manual' });
            expect(activityLog.record).toHaveBeenCalledWith('user-1', 'backup_created', expect.any(Object));
        });
    });

    describe('restoreBackup', () => {
        it('rejects a backup that does not belong to this user', async () => {
            vi.spyOn(backupRepo, 'findById').mockResolvedValue(null);
            await expect(backupService.restoreBackup('backup-1', 'user-1')).rejects.toMatchObject({ status: 404, code: 'not_found' });
        });

        it('replays every blob at-or-before the backup cursor and marks it restored', async () => {
            vi.spyOn(backupRepo, 'findById').mockResolvedValue({ id: 'backup-1', sync_cursor: '2026-06-01T00:00:00.000Z' });
            vi.spyOn(syncRepo, 'listAsOf').mockResolvedValue([
                {
                    resource_type: 'note', resource_id: 'note-1',
                    ciphertext: Buffer.from('c'), nonce: Buffer.from('n'),
                    server_version: 3, deleted: false, updated_at: '2026-05-01T00:00:00.000Z',
                },
            ]);
            const markSpy = vi.spyOn(backupRepo, 'markRestored').mockResolvedValue({});
            vi.spyOn(activityLog, 'record').mockResolvedValue(undefined);

            const result = await backupService.restoreBackup('backup-1', 'user-1');

            expect(result.blobs).toHaveLength(1);
            expect(result.blobs[0].resourceId).toBe('note-1');
            expect(markSpy).toHaveBeenCalledWith('backup-1', 'user-1');
        });
    });
});
