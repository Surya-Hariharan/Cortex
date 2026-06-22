import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../services/api.js', () => ({
    backendStatus: {
        online: false,
        subscribe: vi.fn(() => () => {}),
        check: vi.fn().mockResolvedValue(true),
    },
    system: { health: vi.fn().mockResolvedValue({ status: 'ok' }) },
    auth: {
        login: vi.fn(),
        signup: vi.fn(),
        refresh: vi.fn(),
        logout: vi.fn(),
    },
    isBackendReady: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/offline/offlineIdentity.js', () => ({
    saveLocalIdentity: vi.fn().mockResolvedValue(undefined),
    clearLocalIdentity: vi.fn(),
    getMeshConsent: vi.fn().mockReturnValue(false),
    setMeshConsent: vi.fn(),
    hasLocalIdentity: vi.fn().mockReturnValue(false),
    getValidatedLocalIdentity: vi.fn().mockResolvedValue(null),
}));

vi.mock('../services/mesh/meshController.js', () => ({
    meshController: {
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        isRunning: vi.fn().mockReturnValue(false),
    },
}));

import { CoreProvider, useCore } from '../renderer/context/CoreContext.jsx';
import { getMeshConsent } from '../services/offline/offlineIdentity.js';
import { meshController } from '../services/mesh/meshController.js';

function TestConsumer() {
    const ctx = useCore();
    return (
        <div>
            <span data-testid="auth">{String(ctx.isAuthenticated)}</span>
            <span data-testid="theme">{ctx.theme}</span>
            <span data-testid="mesh">{String(ctx.meshEnabled)}</span>
            <span data-testid="mode">{ctx.appMode}</span>
        </div>
    );
}

describe('CoreContext', () => {
    beforeEach(() => {
        localStorage.clear();
        window.electronAPI = {
            getSystemInfo: vi.fn().mockResolvedValue({ ramGB: 8, cpuCores: 4 }),
            getOnnxProviders: vi.fn().mockResolvedValue([]),
        };
        getMeshConsent.mockReturnValue(false);
        vi.clearAllMocks();
    });

    it('renders children without crashing', async () => {
        await act(async () => {
            render(
                <CoreProvider>
                    <div data-testid="child">hello</div>
                </CoreProvider>
            );
        });
        expect(screen.getByTestId('child')).toBeDefined();
    });

    it('provides isAuthenticated=false when no session', async () => {
        await act(async () => {
            render(
                <CoreProvider>
                    <TestConsumer />
                </CoreProvider>
            );
        });
        expect(screen.getByTestId('auth').textContent).toBe('false');
    });

    it('provides isAuthenticated=true when session is active', async () => {
        localStorage.setItem('cortex-auth-session', 'active');
        await act(async () => {
            render(
                <CoreProvider>
                    <TestConsumer />
                </CoreProvider>
            );
        });
        expect(screen.getByTestId('auth').textContent).toBe('true');
    });

    it('provides default theme from localStorage', async () => {
        localStorage.setItem('cortex-theme', 'dark');
        await act(async () => {
            render(
                <CoreProvider>
                    <TestConsumer />
                </CoreProvider>
            );
        });
        expect(screen.getByTestId('theme').textContent).toBe('dark');
    });

    it('provides meshEnabled=false by default', async () => {
        getMeshConsent.mockReturnValue(false);
        await act(async () => {
            render(
                <CoreProvider>
                    <TestConsumer />
                </CoreProvider>
            );
        });
        expect(screen.getByTestId('mesh').textContent).toBe('false');
    });

    it('provides meshEnabled=true when consent is set', async () => {
        getMeshConsent.mockReturnValue(true);
        await act(async () => {
            render(
                <CoreProvider>
                    <TestConsumer />
                </CoreProvider>
            );
        });
        expect(screen.getByTestId('mesh').textContent).toBe('true');
        expect(meshController.start).toHaveBeenCalled();
    });

    it('provides default appMode of ONLINE', async () => {
        await act(async () => {
            render(
                <CoreProvider>
                    <TestConsumer />
                </CoreProvider>
            );
        });
        expect(screen.getByTestId('mode').textContent).toBe('ONLINE');
    });

    it('reads username from localStorage auth profile', async () => {
        localStorage.setItem('cortex-auth-profile', JSON.stringify({ name: 'Alice' }));
        function NameConsumer() {
            const { username } = useCore();
            return <span data-testid="name">{username || 'none'}</span>;
        }
        await act(async () => {
            render(<CoreProvider><NameConsumer /></CoreProvider>);
        });
        expect(screen.getByTestId('name').textContent).toBe('Alice');
    });
});
