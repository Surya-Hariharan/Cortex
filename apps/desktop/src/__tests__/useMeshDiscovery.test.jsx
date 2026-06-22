import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../services/api.js', () => ({
    mesh: {
        peers: vi.fn().mockResolvedValue({ peers: [] }),
    },
}));

vi.mock('../services/offline/offlineIdentity.js', () => ({
    getMeshConsent: vi.fn().mockReturnValue(false),
    setMeshConsent: vi.fn(),
}));

import { mesh } from '../services/api.js';
import { getMeshConsent } from '../services/offline/offlineIdentity.js';
import { useMeshDiscovery } from '../renderer/hooks/useMeshDiscovery.js';

function TestComponent() {
    const { nearbyPeers, isMeshAvailable } = useMeshDiscovery();
    return (
        <div>
            <span data-testid="peers">{nearbyPeers}</span>
            <span data-testid="available">{String(isMeshAvailable)}</span>
        </div>
    );
}

describe('useMeshDiscovery', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.electronAPI = undefined;
        getMeshConsent.mockReturnValue(false);
    });

    afterEach(() => {
        window.electronAPI = undefined;
    });

    it('returns 0 peers and isMeshAvailable=false when consent is disabled', async () => {
        getMeshConsent.mockReturnValue(false);
        render(<TestComponent />);
        expect(screen.getByTestId('peers').textContent).toBe('0');
        expect(screen.getByTestId('available').textContent).toBe('false');
    });

    it('starts polling when mesh consent is enabled', async () => {
        getMeshConsent.mockReturnValue(true);
        window.electronAPI = {
            getPeers: vi.fn().mockResolvedValue([{ id: 'peer1' }, { id: 'peer2' }]),
        };
        await act(async () => {
            render(<TestComponent />);
            await new Promise(r => setTimeout(r, 50));
        });
        expect(screen.getByTestId('peers').textContent).toBe('2');
        expect(screen.getByTestId('available').textContent).toBe('true');
    });

    it('filters out self (isMe=true) from peer count', async () => {
        getMeshConsent.mockReturnValue(true);
        window.electronAPI = {
            getPeers: vi.fn().mockResolvedValue([
                { id: 'peer1', isMe: false },
                { id: 'me', isMe: true },
            ]),
        };
        await act(async () => {
            render(<TestComponent />);
            await new Promise(r => setTimeout(r, 50));
        });
        expect(screen.getByTestId('peers').textContent).toBe('1');
    });

    it('falls back to mesh.peers() API when electronAPI.getPeers is absent', async () => {
        getMeshConsent.mockReturnValue(true);
        mesh.peers.mockResolvedValue({ peers: [{ id: 'api-peer' }] });
        window.electronAPI = {};

        await act(async () => {
            render(<TestComponent />);
            await new Promise(r => setTimeout(r, 50));
        });
        expect(screen.getByTestId('peers').textContent).toBe('1');
    });

    it('sets peers to 0 on discovery error', async () => {
        getMeshConsent.mockReturnValue(true);
        mesh.peers.mockRejectedValue(new Error('network error'));
        window.electronAPI = {};

        await act(async () => {
            render(<TestComponent />);
            await new Promise(r => setTimeout(r, 50));
        });
        expect(screen.getByTestId('peers').textContent).toBe('0');
    });

    it('updates when mesh-consent-updated event fires', async () => {
        getMeshConsent.mockReturnValue(false);
        window.electronAPI = {
            getPeers: vi.fn().mockResolvedValue([{ id: 'new-peer' }]),
        };

        await act(async () => {
            render(<TestComponent />);
        });
        expect(screen.getByTestId('peers').textContent).toBe('0');

        await act(async () => {
            window.dispatchEvent(new CustomEvent('mesh-consent-updated', { detail: { enabled: true } }));
            await new Promise(r => setTimeout(r, 50));
        });
        expect(screen.getByTestId('peers').textContent).toBe('1');
    });

    it('clears peers when consent is revoked', async () => {
        getMeshConsent.mockReturnValue(true);
        window.electronAPI = {
            getPeers: vi.fn().mockResolvedValue([{ id: 'peer1' }]),
        };

        await act(async () => {
            render(<TestComponent />);
            await new Promise(r => setTimeout(r, 50));
        });

        await act(async () => {
            window.dispatchEvent(new CustomEvent('mesh-consent-updated', { detail: { enabled: false } }));
        });
        expect(screen.getByTestId('peers').textContent).toBe('0');
    });

    it('handles array response from electronAPI.getPeers', async () => {
        getMeshConsent.mockReturnValue(true);
        window.electronAPI = {
            getPeers: vi.fn().mockResolvedValue([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]),
        };
        await act(async () => {
            render(<TestComponent />);
            await new Promise(r => setTimeout(r, 50));
        });
        expect(screen.getByTestId('peers').textContent).toBe('3');
    });
});
