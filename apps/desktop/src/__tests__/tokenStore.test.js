import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveTokens, getAccessToken, getRefreshToken, clearTokens } from '../services/storage/tokenStore.js';

describe('tokenStore', () => {
    beforeEach(() => {
        window.electronAPI = undefined;
    });

    describe('saveTokens', () => {
        it('calls electronAPI.tokenSave with access and refresh tokens', () => {
            const tokenSave = vi.fn().mockResolvedValue(undefined);
            window.electronAPI = { tokenSave };
            saveTokens('access-123', 'refresh-abc');
            expect(tokenSave).toHaveBeenCalledWith('access-123', 'refresh-abc');
        });

        it('returns undefined when electronAPI is not available', () => {
            expect(saveTokens('a', 'b')).toBeUndefined();
        });
    });

    describe('getAccessToken', () => {
        it('calls electronAPI.tokenGetAccess and returns the result', async () => {
            window.electronAPI = { tokenGetAccess: vi.fn().mockResolvedValue('access-token') };
            const token = await getAccessToken();
            expect(token).toBe('access-token');
        });

        it('returns null when electronAPI is not available', async () => {
            const token = await getAccessToken();
            expect(token).toBeNull();
        });
    });

    describe('getRefreshToken', () => {
        it('calls electronAPI.tokenGetRefresh and returns the result', async () => {
            window.electronAPI = { tokenGetRefresh: vi.fn().mockResolvedValue('refresh-token') };
            const token = await getRefreshToken();
            expect(token).toBe('refresh-token');
        });

        it('returns null when electronAPI is not available', async () => {
            const token = await getRefreshToken();
            expect(token).toBeNull();
        });
    });

    describe('clearTokens', () => {
        it('calls electronAPI.tokenClear', () => {
            const tokenClear = vi.fn();
            window.electronAPI = { tokenClear };
            clearTokens();
            expect(tokenClear).toHaveBeenCalledOnce();
        });

        it('returns undefined when electronAPI is not available', () => {
            expect(clearTokens()).toBeUndefined();
        });
    });
});
