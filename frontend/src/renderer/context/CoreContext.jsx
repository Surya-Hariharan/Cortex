import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { backendStatus } from '../services/api.js';

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
    const [isNetworkOnline, setIsNetworkOnline] = useState(window.navigator.onLine);

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
        backendStatus.check().then(v => setIsOnline(v));
        const healthPoll = setInterval(() => backendStatus.check(), 30000);

        const handleOnline = () => setIsNetworkOnline(true);
        const handleOffline = () => setIsNetworkOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            unsub();
            clearInterval(healthPoll);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

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

    const value = {
        isAuthenticated,
        username, setUsername,
        theme, setTheme,
        isOnline,
        isNetworkOnline,
        toast, setToast, showToast,
        userStream, setUserStream,
        login, logout
    };

    return <CoreContext.Provider value={value}>{children}</CoreContext.Provider>;
};
