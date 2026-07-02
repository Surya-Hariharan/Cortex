import { describe, it, expect, afterEach, vi } from 'vitest';

import {
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
    groups,
    activity,
    notifications,
} from '../services/api.js';

describe('api (local-first)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
        delete window.electronAPI;
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
        it('is online and check() resolves true in local-first mode', async () => {
            expect(backendStatus.online).toBe(true);
            expect(await backendStatus.check()).toBe(true);
        });

        it('subscribe() registers a listener and returns an unsubscribe fn', () => {
            const listener = vi.fn();
            const unsub = backendStatus.subscribe(listener);
            expect(unsub).toBeTypeOf('function');
            expect(backendStatus._listeners.has(listener)).toBe(true);
            unsub();
            expect(backendStatus._listeners.has(listener)).toBe(false);
        });
    });

    // ── system ─────────────────────────────────────────────────────────────
    describe('system.health', () => {
        it('resolves an ok status without any network call', async () => {
            expect(await system.health()).toEqual({ status: 'ok' });
        });
    });

    // ── auth (routed through electronAPI IPC) ───────────────────────────────
    describe('auth', () => {
        it('initSession delegates to electronAPI.cloudAuthInitSession and returns data', async () => {
            window.electronAPI = {
                cloudAuthInitSession: vi.fn().mockResolvedValue({ status: 200, data: { device: { id: 'd1' } } })
            };
            const payload = { device: { id: 'd1' } };
            const result = await auth.initSession(payload, 'token');
            expect(window.electronAPI.cloudAuthInitSession).toHaveBeenCalledWith(payload, 'token');
            expect(result).toEqual({ status: 200, data: { device: { id: 'd1' } } });
        });

        it('initSession throws with data on non-200 status', async () => {
            window.electronAPI = {
                cloudAuthInitSession: vi.fn().mockResolvedValue({ status: 400, data: { error: 'invalid' } })
            };
            await expect(auth.initSession({ device: { id: 'd1' } }, 'token')).rejects.toEqual({
                data: { error: 'invalid' },
            });
        });

        it('logout resolves successfully', async () => {
            expect(await auth.logout()).toEqual({ success: true });
        });
    });

    // ── reference (stubbed to empty arrays in local-first) ──────────────────
    describe('reference', () => {
        it('districts resolves an empty array', async () => {
            expect(await reference.districts()).toEqual([]);
        });

        it('colleges resolves an empty array', async () => {
            expect(await reference.colleges('d1')).toEqual([]);
        });

        it('degrees resolves an empty array', async () => {
            expect(await reference.degrees()).toEqual([]);
        });

        it('courses resolves an empty array', async () => {
            expect(await reference.courses('deg1')).toEqual([]);
        });
    });

    // ── isBackendReady ─────────────────────────────────────────────────────
    describe('isBackendReady', () => {
        it('resolves true in local-first mode', async () => {
            expect(await isBackendReady()).toBe(true);
        });
    });

    // ── stub namespaces (not-available / empty) ─────────────────────────────
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
});
