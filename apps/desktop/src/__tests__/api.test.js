import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock tokenStore so auth.logout can call getAccessToken without electronAPI
vi.mock('../services/storage/tokenStore.js', () => ({
    saveTokens: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
    getRefreshToken: vi.fn().mockResolvedValue(null),
    clearTokens: vi.fn(),
}));

import {
    apiClient,
    getUserId,
    backendStatus,
    system,
    auth,
    reference,
    isBackendReady,
    documents,
    notes,
    tasks,
    projects,
    search,
    chat,
    mesh,
    transcription,
    groups,
    activity,
    notifications,
} from '../services/api.js';

function mockFetch(status, body, contentType = 'application/json') {
    global.fetch = vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        headers: { get: () => contentType },
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
    });
}

describe('api', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
    });

    // ── apiClient.request ──────────────────────────────────────────────────
    describe('apiClient.request', () => {
        it('returns parsed JSON on 200 OK', async () => {
            mockFetch(200, { status: 'ok' });
            const result = await apiClient.request('/health');
            expect(result).toEqual({ status: 'ok' });
        });

        it('throws with status and data on non-OK response', async () => {
            mockFetch(401, { error: 'Unauthorized' });
            await expect(apiClient.request('/auth/me')).rejects.toMatchObject({
                message: 'Unauthorized',
                status: 401,
                networkError: false,
            });
        });

        it('throws networkError on fetch rejection', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('Network down'));
            await expect(apiClient.request('/health')).rejects.toMatchObject({
                networkError: true,
            });
        });

        it('serialises object body to JSON and sets Content-Type', async () => {
            mockFetch(200, {});
            await apiClient.request('/auth/signup', { method: 'POST', body: { email: 'a@b.com' } });
            const [, init] = global.fetch.mock.calls[0];
            expect(init.headers['Content-Type']).toBe('application/json');
            expect(JSON.parse(init.body)).toEqual({ email: 'a@b.com' });
        });

        it('does not serialise FormData body', async () => {
            mockFetch(200, {});
            const form = new FormData();
            await apiClient.request('/upload', { method: 'POST', body: form });
            const [, init] = global.fetch.mock.calls[0];
            expect(init.body).toBeInstanceOf(FormData);
        });

        it('handles non-JSON text response body', async () => {
            mockFetch(200, 'plain text', 'text/plain');
            const result = await apiClient.request('/something');
            expect(result).toEqual({ detail: 'plain text' });
        });

        it('handles empty text response', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 204,
                headers: { get: () => 'text/plain' },
                text: () => Promise.resolve(''),
            });
            const result = await apiClient.request('/logout');
            expect(result).toEqual({});
        });

        it('prepends slash to path if missing', async () => {
            mockFetch(200, {});
            await apiClient.request('health');
            const [url] = global.fetch.mock.calls[0];
            expect(url).toContain('/health');
        });
    });

    // ── getUserId ──────────────────────────────────────────────────────────
    describe('getUserId', () => {
        it('returns null when no auth profile in localStorage', () => {
            expect(getUserId()).toBeNull();
        });

        it('returns the user id when auth profile is stored', () => {
            localStorage.setItem('cortex-auth-profile', JSON.stringify({ id: 'user-123' }));
            expect(getUserId()).toBe('user-123');
        });

        it('returns null when auth profile has no id', () => {
            localStorage.setItem('cortex-auth-profile', JSON.stringify({ email: 'a@b.com' }));
            expect(getUserId()).toBeNull();
        });

        it('returns null when auth profile JSON is corrupted', () => {
            localStorage.setItem('cortex-auth-profile', 'bad-json');
            expect(getUserId()).toBeNull();
        });
    });

    // ── backendStatus ──────────────────────────────────────────────────────
    describe('backendStatus', () => {
        it('check() returns true and sets online when /health succeeds', async () => {
            mockFetch(200, { status: 'ok' });
            const result = await backendStatus.check();
            expect(result).toBe(true);
            expect(backendStatus.online).toBe(true);
        });

        it('check() returns false and sets offline when /health fails', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('down'));
            const result = await backendStatus.check();
            expect(result).toBe(false);
            expect(backendStatus.online).toBe(false);
        });

        it('subscribe() adds a listener and returns unsubscribe', async () => {
            const listener = vi.fn();
            const unsub = backendStatus.subscribe(listener);
            mockFetch(200, {});
            await backendStatus.check();
            expect(listener).toHaveBeenCalled();
            unsub();
            // After unsubscribe, listener should not be called again
            const callCount = listener.mock.calls.length;
            global.fetch = vi.fn().mockRejectedValue(new Error('x'));
            await backendStatus.check();
            expect(listener.mock.calls.length).toBe(callCount);
        });
    });

    // ── system ─────────────────────────────────────────────────────────────
    describe('system.health', () => {
        it('calls /health', async () => {
            mockFetch(200, { status: 'ok' });
            await system.health();
            expect(global.fetch).toHaveBeenCalledOnce();
        });
    });

    // ── auth ───────────────────────────────────────────────────────────────
    describe('auth', () => {
        it('signup POSTs to /auth/signup', async () => {
            mockFetch(200, { token: 'abc' });
            await auth.signup({ email: 'a@b.com', password: 'pw' });
            const [url, init] = global.fetch.mock.calls[0];
            expect(url).toContain('/auth/signup');
            expect(init.method).toBe('POST');
        });

        it('login POSTs to /auth/login', async () => {
            mockFetch(200, { accessToken: 'at', refreshToken: 'rt' });
            await auth.login({ email: 'a@b.com', password: 'pw' });
            const [url] = global.fetch.mock.calls[0];
            expect(url).toContain('/auth/login');
        });

        it('refresh POSTs to /auth/refresh', async () => {
            mockFetch(200, { accessToken: 'new-at' });
            await auth.refresh('old-refresh-token');
            const [url, init] = global.fetch.mock.calls[0];
            expect(url).toContain('/auth/refresh');
            expect(JSON.parse(init.body)).toHaveProperty('refreshToken', 'old-refresh-token');
        });

        it('logout POSTs to /auth/logout with Bearer token', async () => {
            mockFetch(200, {});
            await auth.logout('old-refresh-token');
            const [url, init] = global.fetch.mock.calls[0];
            expect(url).toContain('/auth/logout');
            expect(init.headers.Authorization).toBe('Bearer mock-access-token');
        });
    });

    // ── reference ─────────────────────────────────────────────────────────
    describe('reference', () => {
        it('districts calls /reference/districts', async () => {
            mockFetch(200, []);
            await reference.districts();
            expect(global.fetch.mock.calls[0][0]).toContain('/reference/districts');
        });

        it('colleges with districtId includes query param', async () => {
            mockFetch(200, []);
            await reference.colleges('d1');
            expect(global.fetch.mock.calls[0][0]).toContain('districtId=d1');
        });

        it('colleges without districtId omits query param', async () => {
            mockFetch(200, []);
            await reference.colleges(null);
            expect(global.fetch.mock.calls[0][0]).not.toContain('districtId');
        });

        it('degrees calls /reference/degrees', async () => {
            mockFetch(200, []);
            await reference.degrees();
            expect(global.fetch.mock.calls[0][0]).toContain('/reference/degrees');
        });

        it('courses with degreeId includes query param', async () => {
            mockFetch(200, []);
            await reference.courses('deg1');
            expect(global.fetch.mock.calls[0][0]).toContain('degreeId=deg1');
        });
    });

    // ── isBackendReady ─────────────────────────────────────────────────────
    describe('isBackendReady', () => {
        it('returns true when backend is reachable', async () => {
            mockFetch(200, {});
            expect(await isBackendReady()).toBe(true);
        });
    });

    // ── stub namespaces (not-available) ────────────────────────────────────
    describe('_notAvailable stubs', () => {
        it('documents.upload rejects with notAvailable error', async () => {
            await expect(documents.upload()).rejects.toMatchObject({ notAvailable: true });
        });

        it('documents.list resolves with []', async () => {
            expect(await documents.list()).toEqual([]);
        });

        it('notes.list resolves with []', async () => {
            expect(await notes.list()).toEqual([]);
        });

        it('notes.create rejects with notAvailable error', async () => {
            await expect(notes.create()).rejects.toMatchObject({ notAvailable: true });
        });

        it('tasks.list resolves with []', async () => {
            expect(await tasks.list()).toEqual([]);
        });

        it('projects.list resolves with []', async () => {
            expect(await projects.list()).toEqual([]);
        });

        it('search.query resolves with { results: [] }', async () => {
            expect(await search.query()).toEqual({ results: [] });
        });

        it('chat.list resolves with []', async () => {
            expect(await chat.list()).toEqual([]);
        });

        it('chat.stream calls onError asynchronously', async () => {
            const onError = vi.fn();
            chat.stream({}, vi.fn(), vi.fn(), onError);
            await new Promise(r => setTimeout(r, 10));
            expect(onError).toHaveBeenCalledWith('Chat is not available in this release.');
        });

        it('mesh.peers resolves with { peers: [] }', async () => {
            expect(await mesh.peers()).toEqual({ peers: [] });
        });

        it('groups.list resolves with []', async () => {
            expect(await groups.list()).toEqual([]);
        });

        it('activity.stats resolves with {}', async () => {
            expect(await activity.stats()).toEqual({});
        });

        it('notifications.list resolves with []', async () => {
            expect(await notifications.list()).toEqual([]);
        });
    });

    // ── localStorage base URL override ─────────────────────────────────────
    describe('resolveBaseUrl', () => {
        it('uses DEFAULT_BACKEND_URL when localStorage has no override', () => {
            expect(apiClient.baseURL).toContain('localhost:8080');
        });
    });
});
