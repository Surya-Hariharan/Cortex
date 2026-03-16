/**
 * useMeshDiscovery — React hook for mesh peer detection.
 *
 * Polls for nearby Cortex peers every 5 seconds via Electron IPC
 * (backed by the existing PeerDiscovery UDP service).
 *
 * Exposes:
 *   nearbyPeers  — number of discovered peers (excluding self)
 *   isMeshAvailable — true when nearbyPeers > 0
 */

import { useState, useEffect, useRef } from 'react';
import { mesh } from '../services/api.js';
import { getMeshConsent } from '../offline/offlineIdentity.js';

const POLL_INTERVAL = 5000;

export function useMeshDiscovery() {
    const [nearbyPeers, setNearbyPeers] = useState(0);
    const [meshEnabled, setMeshEnabled] = useState(() => getMeshConsent());
    const intervalRef = useRef(null);
    const pollingRef = useRef(false);

    useEffect(() => {
        const onConsentUpdated = (event) => {
            setMeshEnabled(!!event.detail?.enabled);
        };
        window.addEventListener('mesh-consent-updated', onConsentUpdated);
        return () => window.removeEventListener('mesh-consent-updated', onConsentUpdated);
    }, []);

    useEffect(() => {
        if (!meshEnabled) {
            pollingRef.current = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            setNearbyPeers(0);
            return;
        }

        if (pollingRef.current) return;
        pollingRef.current = true;

        let cancelled = false;

        const runDiscovery = async () => {
            try {
                // Try Electron IPC first (real UDP discovery)
                if (window.electronAPI?.getPeers) {
                    const peers = await window.electronAPI.getPeers();
                    if (!cancelled) {
                        const list = Array.isArray(peers) ? peers : (peers?.peers ?? []);
                        // Exclude self
                        setNearbyPeers(list.filter(p => p.id !== 'me' && !p.isMe).length);
                        return;
                    }
                }

                // Fallback to API shim
                const res = await mesh.peers();
                if (!cancelled) {
                    const list = Array.isArray(res) ? res : (res?.peers ?? []);
                    setNearbyPeers(list.filter(p => p.id !== 'me' && !p.isMe).length);
                }
            } catch {
                // Fail silently — mesh is optional
                if (!cancelled) setNearbyPeers(0);
            }
        };

        runDiscovery();
        intervalRef.current = setInterval(runDiscovery, POLL_INTERVAL);

        return () => {
            cancelled = true;
            pollingRef.current = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [meshEnabled]);

    return {
        nearbyPeers,
        isMeshAvailable: nearbyPeers > 0,
    };
}
