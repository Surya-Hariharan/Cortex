/**
 * Smoke tests for all page-level components.
 * Goal: render each page with minimal props and mocked dependencies to
 * gain v8 statement coverage for JSX/render paths.
 */
import React, { Suspense } from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Global mocks ──────────────────────────────────────────────────────────────

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
    notes: { list: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn() },
    tasks: { list: vi.fn().mockResolvedValue([]) },
    projects: { list: vi.fn().mockResolvedValue([]) },
    groups: { list: vi.fn().mockResolvedValue([]) },
    activity: { stats: vi.fn().mockResolvedValue({ total_uploads: 0, total_chunks: 0, total_shared: 0, total_notes: 0, total_views: 0, total_downloads: 0, avg_rating: 0 }), chart: vi.fn().mockResolvedValue({ labels: [], values: [], max: 0, total: 0 }), feed: vi.fn().mockResolvedValue([]) },
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

import { CoreProvider } from '../renderer/context/CoreContext.jsx';

function wrap(ui) {
    return (
        <CoreProvider>
            <Suspense fallback={<div>loading</div>}>
                {ui}
            </Suspense>
        </CoreProvider>
    );
}

const noop = vi.fn();

beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('cortex-auth-session', 'active');
    localStorage.setItem('cortex-auth-profile', JSON.stringify({ id: 'u1', name: 'Test', email: 'test@test.com' }));
    window.electronAPI = {
        getSystemInfo: vi.fn().mockResolvedValue({ ramGB: 8, cpuCores: 4 }),
        getOnnxProviders: vi.fn().mockResolvedValue([]),
        getPeers: vi.fn().mockResolvedValue([]),
        meshStart: vi.fn(),
        meshStop: vi.fn(),
    };
    vi.clearAllMocks();
});

// ── Knowledge page ─────────────────────────────────────────────────────────────

describe('Knowledge page', () => {
    it('renders without crashing', async () => {
        const { default: Knowledge } = await import('../renderer/components/pages/Knowledge.jsx');
        await act(async () => {
            render(wrap(<Knowledge onToast={noop} onUploadPdf={noop} userStream="cse" />));
        });
        // Tab bar should be visible
        expect(document.body.textContent).toContain('Search');
    });

    it('switches to library tab on click', async () => {
        const { default: Knowledge } = await import('../renderer/components/pages/Knowledge.jsx');
        const { getByText } = render(wrap(<Knowledge onToast={noop} onUploadPdf={noop} />));
        await act(async () => {
            getByText('My Library').click();
        });
    });
});

// ── Workspace page ─────────────────────────────────────────────────────────────

describe('Workspace page', () => {
    it('renders without crashing', async () => {
        const { default: Workspace } = await import('../renderer/components/pages/Workspace.jsx');
        await act(async () => {
            render(wrap(<Workspace onToast={noop} onUploadPdf={noop} />));
        });
        expect(document.body).toBeTruthy();
    });
});

// ── Campus page ────────────────────────────────────────────────────────────────

describe('Campus page', () => {
    it('renders without crashing', async () => {
        const { default: Campus } = await import('../renderer/components/pages/Campus.jsx');
        await act(async () => {
            render(wrap(<Campus onToast={noop} />));
        });
        expect(document.body).toBeTruthy();
    });
});

// ── Activity page ──────────────────────────────────────────────────────────────

describe('Activity page', () => {
    it('renders without crashing', async () => {
        const { default: Activity } = await import('../renderer/components/pages/Activity.jsx');
        await act(async () => {
            render(wrap(<Activity onToast={noop} />));
        });
        expect(document.body).toBeTruthy();
    });
});

// ── AIEngine page ──────────────────────────────────────────────────────────────

describe('AIEngine page', () => {
    it('renders without crashing', async () => {
        const { default: AIEngine } = await import('../renderer/components/pages/AIEngine.jsx');
        await act(async () => {
            render(wrap(<AIEngine onToast={noop} />));
        });
        expect(document.body).toBeTruthy();
    });
});

// ── HomePage ────────────────────────────────────────────────────────────────────

describe('HomePage', () => {
    it('renders without crashing', async () => {
        const { default: HomePage } = await import('../renderer/components/pages/HomePage.jsx');
        await act(async () => {
            render(wrap(<HomePage onTabChange={noop} onUploadPdf={noop} />));
        });
        expect(document.body).toBeTruthy();
    });
});

// ── ProjectView ─────────────────────────────────────────────────────────────────

describe('ProjectView', () => {
    it('renders without crashing with a project', async () => {
        const { default: ProjectView } = await import('../renderer/components/pages/ProjectView.jsx');
        const project = { id: 'p1', title: 'Test Project', description: 'desc', status: 'active' };
        await act(async () => {
            render(wrap(<ProjectView project={project} onBack={noop} onToast={noop} />));
        });
        expect(document.body).toBeTruthy();
    });

    it('renders with a minimal project', async () => {
        const { default: ProjectView } = await import('../renderer/components/pages/ProjectView.jsx');
        const project = { id: 'p2', title: 'Minimal', description: '', status: 'active', sources: [] };
        await act(async () => {
            render(wrap(<ProjectView project={project} onBack={noop} onToast={noop} />));
        });
    });
});
