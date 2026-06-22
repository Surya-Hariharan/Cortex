/**
 * Smoke tests for renderer components (SearchTab, NotesTab, Library,
 * StudyGroups, AcademicHub, NetworkTab, PerformanceTab, DocumentStatus,
 * MyContributions, Notifications, layout components).
 */
import React, { Suspense } from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Global mocks ───────────────────────────────────────────────────────────────

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
    activity: { stats: vi.fn().mockResolvedValue({ total_uploads: 0, total_chunks: 0, total_shared: 0, total_notes: 0, total_views: 0, total_downloads: 0, avg_rating: 0 }), chart: vi.fn().mockResolvedValue({ labels: [], values: [], max: 0, total: 0 }), feed: vi.fn().mockResolvedValue([]) },
    auth: { login: vi.fn(), signup: vi.fn(), refresh: vi.fn(), logout: vi.fn() },
    search: { query: vi.fn().mockResolvedValue({ results: [] }) },
    documents: {
        list: vi.fn().mockResolvedValue([]),
        upload: vi.fn().mockRejectedValue(Object.assign(new Error('not available'), { notAvailable: true })),
    },
    notes: {
        list: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockRejectedValue(Object.assign(new Error('not available'), { notAvailable: true })),
        update: vi.fn().mockRejectedValue(Object.assign(new Error('not available'), { notAvailable: true })),
        browsePublic: vi.fn().mockResolvedValue([]),
    },
    tasks: { list: vi.fn().mockResolvedValue([]) },
    projects: { list: vi.fn().mockResolvedValue([]) },
    groups: { list: vi.fn().mockResolvedValue([]) },
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
    localStorage.setItem('cortex-auth-profile', JSON.stringify({ id: 'u1', name: 'Test', email: 'test@test.com', stream: 'cse' }));
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
    };
    vi.clearAllMocks();
});

// ── SearchTab ──────────────────────────────────────────────────────────────────

describe('SearchTab', () => {
    it('renders without crashing', async () => {
        const { default: SearchTab } = await import('../renderer/components/SearchTab.jsx');
        await act(async () => {
            render(wrap(<SearchTab onToast={noop} onUploadPdf={noop} onFirstSearch={noop} onSearchComplete={noop} />));
        });
        expect(document.body).toBeTruthy();
    });
});

// ── NotesTab ───────────────────────────────────────────────────────────────────

describe('NotesTab', () => {
    it('renders without crashing', async () => {
        const { default: NotesTab } = await import('../renderer/components/NotesTab.jsx');
        await act(async () => {
            render(wrap(<NotesTab onToast={noop} />));
        });
        expect(document.body).toBeTruthy();
    });
});

// ── Library ────────────────────────────────────────────────────────────────────

describe('Library', () => {
    it('renders without crashing', async () => {
        const { default: Library } = await import('../renderer/components/Library.jsx');
        await act(async () => {
            render(wrap(<Library onToast={noop} onUploadPdf={noop} />));
        });
        expect(document.body).toBeTruthy();
    });
});

// ── StudyGroups ────────────────────────────────────────────────────────────────

describe('StudyGroups', () => {
    it('renders without crashing', async () => {
        const { default: StudyGroups } = await import('../renderer/components/StudyGroups.jsx');
        await act(async () => {
            render(wrap(<StudyGroups onToast={noop} />));
        });
        expect(document.body).toBeTruthy();
    });
});

// ── AcademicHub ────────────────────────────────────────────────────────────────

describe('AcademicHub', () => {
    it('renders without crashing', async () => {
        const { default: AcademicHub } = await import('../renderer/components/AcademicHub.jsx');
        await act(async () => {
            render(wrap(<AcademicHub userStream="cse" onToast={noop} />));
        });
        expect(document.body).toBeTruthy();
    });
});

// ── NetworkTab ─────────────────────────────────────────────────────────────────

describe('NetworkTab', () => {
    it('renders without crashing', async () => {
        const { default: NetworkTab } = await import('../renderer/components/NetworkTab.jsx');
        await act(async () => {
            render(wrap(<NetworkTab onToast={noop} />));
        });
        expect(document.body).toBeTruthy();
    });
});

// ── PerformanceTab ─────────────────────────────────────────────────────────────

describe('PerformanceTab', () => {
    it('renders without crashing', async () => {
        const { default: PerformanceTab } = await import('../renderer/components/PerformanceTab.jsx');
        await act(async () => {
            render(wrap(<PerformanceTab onToast={noop} />));
        });
        expect(document.body).toBeTruthy();
    });
});

// ── DocumentStatus ─────────────────────────────────────────────────────────────

describe('DocumentStatus', () => {
    it('renders without crashing', async () => {
        const { default: DocumentStatus } = await import('../renderer/components/DocumentStatus.jsx');
        await act(async () => {
            render(wrap(<DocumentStatus onToast={noop} />));
        });
        expect(document.body).toBeTruthy();
    });
});

// ── MyContributions ────────────────────────────────────────────────────────────

describe('MyContributions', () => {
    it('renders without crashing', async () => {
        const { default: MyContributions } = await import('../renderer/components/MyContributions.jsx');
        await act(async () => {
            render(wrap(<MyContributions onToast={noop} />));
        });
        expect(document.body).toBeTruthy();
    });
});

// ── Notifications ──────────────────────────────────────────────────────────────

describe('Notifications', () => {
    it('renders without crashing', async () => {
        const { default: Notifications } = await import('../renderer/components/Notifications.jsx');
        await act(async () => {
            render(wrap(<Notifications onToast={noop} onClose={noop} isOpen />));
        });
        expect(document.body).toBeTruthy();
    });
});

// ── ResultCard ─────────────────────────────────────────────────────────────────

describe('ResultCard', () => {
    it('renders without crashing', async () => {
        const { default: ResultCard } = await import('../renderer/components/shared/ResultCard.jsx');
        const result = { id: '1', title: 'Test Result', content: 'Some content', score: 0.9, type: 'document' };
        await act(async () => {
            render(<ResultCard result={result} onSave={noop} onToast={noop} />);
        });
        expect(document.body).toBeTruthy();
    });
});

// ── Layout components ──────────────────────────────────────────────────────────

describe('Toast', () => {
    it('renders message', async () => {
        const { default: Toast } = await import('../renderer/components/layout/Toast.jsx');
        render(<Toast message="Test toast" type="success" onClose={noop} />);
        expect(document.body.textContent).toContain('Test toast');
    });

    it('renders error type', async () => {
        const { default: Toast } = await import('../renderer/components/layout/Toast.jsx');
        render(<Toast message="Error!" type="error" onClose={noop} />);
        expect(document.body.textContent).toContain('Error!');
    });

    it('renders with no type (default)', async () => {
        const { default: Toast } = await import('../renderer/components/layout/Toast.jsx');
        render(<Toast message="Info" onClose={noop} />);
    });
});

describe('WindowControls', () => {
    it('renders without crashing', async () => {
        const { default: WindowControls } = await import('../renderer/components/layout/WindowControls.jsx');
        window.electronAPI = { windowMinimize: vi.fn(), windowMaximize: vi.fn(), windowClose: vi.fn() };
        render(<WindowControls />);
        expect(document.body).toBeTruthy();
    });
});

describe('CommandPalette', () => {
    it('renders when open', async () => {
        const { default: CommandPalette } = await import('../renderer/components/layout/CommandPalette.jsx');
        await act(async () => {
            render(wrap(<CommandPalette isOpen onClose={noop} onNavigate={noop} onUploadPdf={noop} onToast={noop} />));
        });
        expect(document.body).toBeTruthy();
    });

    it('renders when closed', async () => {
        const { default: CommandPalette } = await import('../renderer/components/layout/CommandPalette.jsx');
        await act(async () => {
            render(wrap(<CommandPalette isOpen={false} onClose={noop} onNavigate={noop} onUploadPdf={noop} onToast={noop} />));
        });
    });
});

describe('CreateProjectModal', () => {
    it('renders without crashing', async () => {
        const { default: CreateProjectModal } = await import('../renderer/components/layout/CreateProjectModal.jsx');
        await act(async () => {
            render(wrap(<CreateProjectModal onClose={noop} onCreate={noop} />));
        });
        expect(document.body).toBeTruthy();
    });
});

describe('StreamSelectorModal', () => {
    it('renders without crashing', async () => {
        const { default: StreamSelectorModal } = await import('../renderer/components/layout/StreamSelectorModal.jsx');
        await act(async () => {
            render(<StreamSelectorModal onSelect={noop} onSkip={noop} />);
        });
        expect(document.body).toBeTruthy();
    });
});

describe('Settings', () => {
    it('renders when open', async () => {
        const { default: Settings } = await import('../renderer/components/layout/Settings.jsx');
        await act(async () => {
            render(wrap(<Settings
                open
                onClose={noop}
                theme="system"
                setTheme={noop}
                username="Test"
                setUsername={noop}
                userStream="cse"
                setShowStreamSelector={noop}
                perfProvider="cpu"
                setPerfProvider={noop}
                onToast={noop}
                onLogout={noop}
            />));
        });
        expect(document.body).toBeTruthy();
    });

    it('renders when closed', async () => {
        const { default: Settings } = await import('../renderer/components/layout/Settings.jsx');
        await act(async () => {
            render(wrap(<Settings
                open={false}
                onClose={noop}
                theme="system"
                setTheme={noop}
                username={null}
                setUsername={noop}
                onToast={noop}
                onLogout={noop}
            />));
        });
    });
});
