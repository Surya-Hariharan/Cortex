import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { backendStatus, system as systemApi } from '../../services/api.js';

const CoreContext = createContext();

export const useCore = () => useContext(CoreContext);

export const CoreProvider = ({ children }) => {
    // ── Auth State ───────────────────────────────────────────────────────────
    const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('cortex-auth-session') === 'active');
    const [username, setUsername] = useState(() => {
        try {
            const savedProfile = localStorage.getItem('cortex-auth-profile');
            if (savedProfile) {
                const parsed = JSON.parse(savedProfile);
                return parsed.name || 'Surya Hariharan';
            }
        } catch { /* ignore */ }
        return 'Surya Hariharan';
    });

    // ── Theme State ──────────────────────────────────────────────────────────
    const [theme, setTheme] = useState(() => localStorage.getItem('cortex-theme') || 'system');

    // ── Connectivity State ───────────────────────────────────────────────────
    const [isOnline, setIsOnline] = useState(true);
    // navigator.onLine is unreliable in Electron (file:// renderer always returns false).
    // We keep it only to detect genuine network-loss events via the online/offline DOM events.
    const [isNetworkOnline, setIsNetworkOnline] = useState(
        // If running in Electron (no real HTTP origin), assume network is fine by default;
        // the online/offline events will correct this if it actually goes offline.
        window.location.protocol === 'file:' ? true : window.navigator.onLine
    );
    // Real internet check: pings external endpoint every 10s from Electron main process.
    // Unlike navigator.onLine, this actually confirms outbound internet access.
    const [isInternetOnline, setIsInternetOnline] = useState(true);

    // ── Privacy Mode ──────────────────────────────────────────────────────────
    const [privacyMode, setPrivacyModeState] = useState(false);

    // ── UI States ─────────────────────────────────────────────────────────────
    const [toast, setToast] = useState(null);
    const [userStream, setUserStream] = useState(localStorage.getItem('cortex-user-stream'));

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type, id: Date.now() });
    }, []);

    // Sync with main-process session
    useEffect(() => {
        if (isAuthenticated) return;
        window.electronAPI?.getSession?.().then((profile) => {
            if (profile) {
                localStorage.setItem('cortex-auth-session', 'active');
                localStorage.setItem('cortex-auth-profile', JSON.stringify(profile));
                if (profile.name) setUsername(profile.name);
                setIsAuthenticated(true);
            }
        }).catch(() => { });
    }, [isAuthenticated]);

    // Backend health polling
    useEffect(() => {
        const unsub = backendStatus.subscribe(v => setIsOnline(v));

        // Do immediate check first, then set up delayed check as backup
        const immediateCheck = () => {
            backendStatus.check().then(v => {
                setIsOnline(v);
                if (v) {
                    console.log('[Cortex] Backend connectivity established');
                }
            }).catch(() => {
                setIsOnline(false);
            });
        };

        // Check immediately on mount
        immediateCheck();

        // Backup delayed check (in case backend is still starting)
        const initialCheck = setTimeout(immediateCheck, 2000);

        // Regular health polling - more frequent to catch issues quickly
        const healthPoll = setInterval(() => backendStatus.check(), 10000);

        // React immediately when Electron's main process confirms backend is up
        // (fires once after waitForBackend() resolves in main.js).
        const unsubElectron = window.electronAPI?.onBackendStatus?.(({ ready }) => {
            console.log('[Cortex] Electron backend status:', ready);
            setIsOnline(ready);
            if (ready) backendStatus._set(true);
        });

        const handleOnline = () => {
            console.log('[Cortex] Network online');
            setIsNetworkOnline(true);
            // Recheck backend when network comes back online
            setTimeout(immediateCheck, 500);
        };
        const handleOffline = () => {
            console.log('[Cortex] Network offline');
            setIsNetworkOnline(false);
        };
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            unsub();
            clearTimeout(initialCheck);
            clearInterval(healthPoll);
            unsubElectron?.();
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Internet status from Electron main process (real connectivity check, updated every 10s)
    useEffect(() => {
        // Get initial status
        window.electronAPI?.getInternetStatus?.().then(online => {
            if (online !== undefined) setIsInternetOnline(online);
        });
        // Subscribe to live updates
        const unsubInternet = window.electronAPI?.onInternetStatus?.(({ online }) => {
            console.log('[Cortex] Internet status:', online ? 'online' : 'offline');
            setIsInternetOnline(online);
        });
        return () => unsubInternet?.();
    }, []);

    // Auto-switch backend mode when real internet connectivity changes
    useEffect(() => {
        systemApi.setInternetStatus(isInternetOnline).catch(() => { });
    }, [isInternetOnline]);

    // Theme injection
    useEffect(() => {
        const root = window.document.documentElement;
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const updateTheme = () => {
            const isDark = theme === 'dark' || (theme === 'system' && mediaQuery.matches);
            if (isDark) {
                root.classList.add('dark');
                window.electronAPI?.updateTitleBarOverlay?.({ color: '#171717', symbolColor: '#ececec', height: 32 });
            } else {
                root.classList.remove('dark');
                window.electronAPI?.updateTitleBarOverlay?.({ color: '#FFFFFF', symbolColor: '#475569', height: 32 });
            }
        };

        updateTheme();
        localStorage.setItem('cortex-theme', theme);
        mediaQuery.addEventListener('change', updateTheme);
        return () => mediaQuery.removeEventListener('change', updateTheme);
    }, [theme]);

    const login = (profile) => {
        if (profile?.name) setUsername(profile.name);
        localStorage.setItem('cortex-auth-session', 'active');
        window.electronAPI?.saveSession?.(profile ?? {});
        setIsAuthenticated(true);
    };

    const logout = () => {
        localStorage.removeItem('cortex-auth-session');
        localStorage.removeItem('cortex-auth-profile');
        window.electronAPI?.logout?.();
    };

    const togglePrivacyMode = async () => {
        try {
            const res = await systemApi.setPrivacy(!privacyMode);
            setPrivacyModeState(res.privacy_mode ?? !privacyMode);
        } catch {
            setPrivacyModeState(prev => !prev);
        }
    };

    const value = {
        isAuthenticated,
        username, setUsername,
        theme, setTheme,
        isOnline,
        isNetworkOnline,
        isInternetOnline,
        privacyMode, togglePrivacyMode,
        toast, setToast, showToast,
        userStream, setUserStream,
        login, logout
    };

    return <CoreContext.Provider value={value}>{children}</CoreContext.Provider>;
};
