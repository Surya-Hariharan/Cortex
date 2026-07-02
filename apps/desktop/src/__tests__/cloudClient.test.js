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
        vi.resetModules();
        cloudClient = require('../services/cloud/cloudClient');
    });

    afterEach(() => {
        if (originalEnv !== undefined) process.env.CORTEX_CLOUD_API_URL = originalEnv;
        else delete process.env.CORTEX_CLOUD_API_URL;
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    describe('isConfigured', () => {
        it('is false when CORTEX_CLOUD_API_URL is missing', () => {
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

            await expect(cloudClient.initSession({ id: 'd1' }, 'token')).rejects.toMatchObject({ notConfigured: true });
            expect(global.fetch).not.toHaveBeenCalled();
        });
    });

    describe('when configured', () => {
        beforeEach(() => {
            process.env.CORTEX_CLOUD_API_URL = 'http://localhost:4000';
        });

        it('initSession POSTs to /api/v1/session/init with the device payload and auth header', async () => {
            global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ device: { id: 'd1' } }) });

            const result = await cloudClient.initSession({ id: 'd1' }, 'token');

            expect(result.device.id).toBe('d1');
            const [url, opts] = global.fetch.mock.calls[0];
            expect(url).toBe('http://localhost:4000/api/v1/session/init');
            expect(opts.method).toBe('POST');
            expect(opts.headers.Authorization).toBe('Bearer token');
            expect(JSON.parse(opts.body)).toEqual({ device: { id: 'd1' } });
        });

        it('logout sends the access token as a bearer header, not a body param', async () => {
            global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
            await cloudClient.logout('access-token-123');

            const [url, opts] = global.fetch.mock.calls[0];
            expect(url).toBe('http://localhost:4000/api/v1/auth/logout');
            expect(opts.headers.Authorization).toBe('Bearer access-token-123');
            expect(opts.body).toBeUndefined();
        });

        it('syncPush POSTs to /api/v1/sync/push with a bearer token', async () => {
            global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
            await cloudClient.syncPush('at', 'd1', { notes: [] });

            const [url, opts] = global.fetch.mock.calls[0];
            expect(url).toBe('http://localhost:4000/api/v1/sync/push');
            expect(opts.headers.Authorization).toBe('Bearer at');
            expect(JSON.parse(opts.body)).toEqual({ deviceId: 'd1', payload: { notes: [] } });
        });

        it('syncPull issues a GET to /api/v1/sync/pull with query params', async () => {
            global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
            await cloudClient.syncPull('at', 'd1', 12345);

            const [url, opts] = global.fetch.mock.calls[0];
            expect(url).toContain('http://localhost:4000/api/v1/sync/pull?deviceId=d1&since=12345');
            expect(opts.method).toBe('GET');
            expect(opts.headers.Authorization).toBe('Bearer at');
        });

        it('throws with the server-provided status and detail on a non-2xx response', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 409,
                json: async () => ({ error: 'conflict', detail: 'Already exists.' }),
            });

            await expect(
                cloudClient.initSession({ id: 'd1' }, 'token')
            ).rejects.toMatchObject({ status: 409, message: 'Already exists.' });
        });

        it('gracefully handles non-JSON error responses (e.g. 502 Bad Gateway HTML)', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 502,
                statusText: 'Bad Gateway',
                text: async () => '<html>...</html>',
                json: async () => { throw new Error('Invalid JSON'); },
            });

            await expect(
                cloudClient.initSession({ id: 'd1' }, 'token')
            ).rejects.toMatchObject({ status: 502, message: 'Cloud service error: 502 Bad Gateway' });
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
