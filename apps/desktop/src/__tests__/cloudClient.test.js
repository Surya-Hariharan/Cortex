// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const _cjsRequire = createRequire(import.meta.url);
const cloudClient = _cjsRequire('../services/cloud/cloudClient.js');

describe('cloudClient', () => {
    let originalEnv;
    let originalFetch;

    beforeEach(() => {
        originalEnv = process.env.CORTEX_CLOUD_API_URL;
        originalFetch = global.fetch;
    });

    afterEach(() => {
        process.env.CORTEX_CLOUD_API_URL = originalEnv;
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    describe('isConfigured', () => {
        it('is false when CORTEX_CLOUD_API_URL is unset', () => {
            delete process.env.CORTEX_CLOUD_API_URL;
            expect(cloudClient.isConfigured()).toBe(false);
        });

        it('is true once set', () => {
            process.env.CORTEX_CLOUD_API_URL = 'http://localhost:4000';
            expect(cloudClient.isConfigured()).toBe(true);
        });
    });

    describe('when not configured', () => {
        it('every method rejects with notConfigured instead of touching the network', async () => {
            delete process.env.CORTEX_CLOUD_API_URL;
            global.fetch = vi.fn();

            await expect(cloudClient.login({ email: 'a@b.com', password: 'x', device: {} })).rejects.toMatchObject({ notConfigured: true });
            expect(global.fetch).not.toHaveBeenCalled();
        });
    });

    describe('when configured', () => {
        beforeEach(() => {
            process.env.CORTEX_CLOUD_API_URL = 'http://localhost:4000';
        });

        it('login POSTs to /api/v1/auth/login with the device payload, no auth header', async () => {
            global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user: { id: 'u1' }, accessToken: 'at', refreshToken: 'rt' }) });

            const result = await cloudClient.login({ email: 'a@b.com', password: 'pw', device: { fingerprint: 'f1' } });

            expect(result.accessToken).toBe('at');
            const [url, opts] = global.fetch.mock.calls[0];
            expect(url).toBe('http://localhost:4000/api/v1/auth/login');
            expect(opts.method).toBe('POST');
            expect(opts.headers.Authorization).toBeUndefined();
            expect(JSON.parse(opts.body)).toEqual({ email: 'a@b.com', password: 'pw', device: { fingerprint: 'f1' } });
        });

        it('logout sends the access token as a bearer header, not a body param', async () => {
            global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

            await cloudClient.logout('access-token-123');

            const [url, opts] = global.fetch.mock.calls[0];
            expect(url).toBe('http://localhost:4000/api/v1/auth/logout');
            expect(opts.headers.Authorization).toBe('Bearer access-token-123');
            expect(opts.body).toBeUndefined();
        });

        it('syncPull encodes since/limit/deviceId as query params and omits unset ones', async () => {
            global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ blobs: [], cursor: 'c', hasMore: false }) });

            await cloudClient.syncPull('at', { since: '2026-01-01T00:00:00.000Z', deviceId: 'device-1' });

            const [url] = global.fetch.mock.calls[0];
            expect(url).toContain('/api/v1/sync/pull?');
            expect(url).toContain('since=2026-01-01T00%3A00%3A00.000Z');
            expect(url).toContain('deviceId=device-1');
            expect(url).not.toContain('limit=');
        });

        it('throws with the server-provided status and detail on a non-2xx response', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 409,
                json: async () => ({ error: 'email_taken', detail: 'An account with this email already exists.' }),
            });

            await expect(
                cloudClient.register({ email: 'a@b.com', password: 'pw', full_name: 'A', device: {} })
            ).rejects.toMatchObject({ status: 409, message: 'An account with this email already exists.' });
        });

        it('revokeDevice issues a DELETE to the device-scoped path', async () => {
            global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
            await cloudClient.revokeDevice('at', 'device-9');
            const [url, opts] = global.fetch.mock.calls[0];
            expect(url).toBe('http://localhost:4000/api/v1/auth/devices/device-9');
            expect(opts.method).toBe('DELETE');
        });
    });
});
