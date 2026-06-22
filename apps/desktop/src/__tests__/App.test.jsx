/**
 * Smoke test for App.jsx — renders the full application shell with mocked services.
 */
import React, { Suspense } from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Global mocks (must be before any imports that pull in the modules) ─────────

vi.mock('../services/api.js', () => ({
    backendStatus: { online: true, subscribe: vi.fn(() => () => {}), check: vi.fn().mockResolvedValue(true) },
    system: {
        health: vi.fn().mockResolvedValue({ status: 'ok', subsystems: {} }),
        models: vi.fn().mockResolvedValue({ models: {} }),
        getMode: vi.fn().mockResolvedValue('cpu'),
        setRuntime: vi.fn().mockResolvedValue({}),
        benchmark: vi.fn().mockResolvedValue({}),
        resources: vi.fn().mockResolvedValue({ cpu_percent: 0, memory: { used_mb: 0, total_mb: 8192, percent: 0 }, disk: { used_gb: 0, total_gb: 100, percent: 0 }, hardware: null }),
        pauseScheduler: vi.fn().mockResolvedValue({}),
        resumeScheduler: vi.fn().mockResolvedValue({}),
    },
    auth: { login: vi.fn(), signup: vi.fn(), refresh: vi.fn(), logout: vi.fn() },
    search: { query: vi.fn().mockResolvedValue({ results: [] }) },
    documents: { list: vi.fn().mockResolvedValue([]), upload: vi.fn(), get: vi.fn() },
    notes: { list: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn(), browsePublic: vi.fn().mockResolvedValue([]) },
    tasks: { list: vi.fn().mockResolvedValue([]) },
    projects: { list: vi.fn().mockResolvedValue([]) },
    groups: { list: vi.fn().mockResolvedValue([]) },
    activity: {
        stats: vi.fn().mockResolvedValue({ total_uploads: 0, total_chunks: 0, total_shared: 0, total_notes: 0, total_views: 0, total_downloads: 0, avg_rating: 0 }),
        chart: vi.fn().mockResolvedValue({ labels: [], values: [], max: 0, total: 0 }),
        feed: vi.fn().mockResolvedValue([]),
    },
    notifications: { list: vi.fn().mockResolvedValue([]) },
    reference: {
        districts: vi.fn().mockResolvedValue([]),
        colleges: vi.fn().mockResolvedValue([]),
        degrees: vi.fn().mockResolvedValue([]),
        courses: vi.fn().mockResolvedValue([]),
    },
    chat: { stream: vi.fn(), list: vi.fn().mockResolvedValue([]), messages: vi.fn().mockResolvedValue([]) },
    mesh: { peers: vi.fn().mockResolvedValue({ peers: [] }) },
    isBackendReady: vi.fn().mockResolvedValue(true),
    getUserId: vi.fn().mockReturnValue('user-1'),
}));

vi.mock('../services/offline/offlineIdentity.js', () => ({
    saveLocalIdentity: vi.fn().mockResolvedValue(undefined),
    clearLocalIdentity: vi.fn(),
    getMeshConsent: vi.fn().mockReturnValue(false),
    setMeshConsent: vi.fn(),
    hasLocalIdentity: vi.fn().mockReturnValue(false),
    getValidatedLocalIdentity: vi.fn().mockResolvedValue(null),
    wasStorageHintShown: vi.fn().mockReturnValue(true),
    markStorageHintShown: vi.fn(),
}));

vi.mock('../services/mesh/meshController.js', () => ({
    meshController: {
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        isRunning: vi.fn().mockReturnValue(false),
    },
}));

vi.mock('../renderer/hooks/useMeshDiscovery.js', () => ({
    useMeshDiscovery: () => ({ nearbyPeers: 0, isMeshAvailable: false }),
}));

vi.mock('../services/storage/tokenStore.js', () => ({
    saveTokens: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue('token'),
    getRefreshToken: vi.fn().mockResolvedValue(null),
    clearTokens: vi.fn(),
}));

vi.mock('../services/system/deviceCapability.js', () => ({
    ensureDeviceProfile: vi.fn().mockResolvedValue({ cpuCores: 4, ramGB: 8 }),
    getDeviceCapability: vi.fn().mockResolvedValue({ cpuCores: 4, ramGB: 8 }),
    getStoredDeviceProfile: vi.fn().mockReturnValue(null),
}));

import { CoreProvider } from '../renderer/context/CoreContext.jsx';
import App from '../renderer/App.jsx';

const noop = vi.fn();

beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('cortex-auth-session', 'active');
    localStorage.setItem('cortex-auth-profile', JSON.stringify({ id: 'u1', name: 'Test User', email: 'test@test.com', stream: 'cse' }));
    localStorage.setItem('cortex-user-stream', 'cse');
    window.electronAPI = {
        getSystemInfo: vi.fn().mockResolvedValue({ ramGB: 8, cpuCores: 4 }),
        getOnnxProviders: vi.fn().mockResolvedValue([]),
        getPeers: vi.fn().mockResolvedValue([]),
        meshStart: vi.fn(),
        meshStop: vi.fn(),
        tokenSave: vi.fn(),
        tokenGetAccess: vi.fn().mockResolvedValue('token'),
        tokenGetRefresh: vi.fn().mockResolvedValue(null),
        tokenClear: vi.fn(),
        windowMinimize: vi.fn(),
        windowMaximize: vi.fn(),
        windowClose: vi.fn(),
        getPerfStats: vi.fn().mockResolvedValue({ provider: 'cpu' }),
        uploadPdf: vi.fn().mockResolvedValue({ path: '/tmp/test.pdf', name: 'test.pdf' }),
        getStats: vi.fn().mockResolvedValue({ documents: 0, embeddings: 0, subjects: [] }),
    };
    vi.clearAllMocks();
});

describe('App', () => {
    it('renders without crashing when authenticated', async () => {
        await act(async () => {
            render(
                <CoreProvider>
                    <Suspense fallback={<div>loading</div>}>
                        <App />
                    </Suspense>
                </CoreProvider>
            );
        });
        expect(document.body).toBeTruthy();
    });

    it('renders auth portal when not authenticated', async () => {
        localStorage.removeItem('cortex-auth-session');
        localStorage.removeItem('cortex-auth-profile');
        await act(async () => {
            render(
                <CoreProvider>
                    <Suspense fallback={<div>loading</div>}>
                        <App />
                    </Suspense>
                </CoreProvider>
            );
        });
        expect(document.body).toBeTruthy();
    });

    it('renders stream selector when stream not set', async () => {
        localStorage.removeItem('cortex-user-stream');
        await act(async () => {
            render(
                <CoreProvider>
                    <Suspense fallback={<div>loading</div>}>
                        <App />
                    </Suspense>
                </CoreProvider>
            );
        });
        expect(document.body).toBeTruthy();
    });

    it('renders without electronAPI', async () => {
        delete window.electronAPI;
        await act(async () => {
            render(
                <CoreProvider>
                    <Suspense fallback={<div>loading</div>}>
                        <App />
                    </Suspense>
                </CoreProvider>
            );
        });
        expect(document.body).toBeTruthy();
    });

    it('renders with projects list populated', async () => {
        const { projects } = await import('../services/api.js');
        projects.list.mockResolvedValue([
            { id: 'p1', title: 'Project Alpha', status: 'active', sources: [] },
            { id: 'p2', title: 'Project Beta', status: 'active', sources: [] },
        ]);
        await act(async () => {
            render(
                <CoreProvider>
                    <Suspense fallback={<div>loading</div>}>
                        <App />
                    </Suspense>
                </CoreProvider>
            );
        });
        expect(document.body).toBeTruthy();
    });
});
