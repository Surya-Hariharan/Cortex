const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // ── Legacy IPC (kept for compatibility) ───────────────────────────────────
    search: (query) => ipcRenderer.invoke('search', query),
    uploadPdf: (userId) => ipcRenderer.invoke('upload-pdf', userId),
    getStats: () => ipcRenderer.invoke('get-stats'),
    shareToNetwork: (docId) => ipcRenderer.invoke('share-to-network', docId),
    getPeers: () => ipcRenderer.invoke('get-peers'),
    meshStart: () => ipcRenderer.invoke('mesh-start'),
    meshStop: () => ipcRenderer.invoke('mesh-stop'),
    getPerfStats: () => ipcRenderer.invoke('get-perf-stats'),
    addNote: (note) => ipcRenderer.invoke('add-note', note),
    getNotes: () => ipcRenderer.invoke('get-notes'),
    deleteNote: (id) => ipcRenderer.invoke('delete-note', id),
    toggleNoteComplete: (id) => ipcRenderer.invoke('toggle-note-complete', id),
    // ── Backend status ────────────────────────────────────────────────────────
    backendReady: () => ipcRenderer.invoke('backend-ready'),
    getOfflineEngineStatus: () => ipcRenderer.invoke('get-offline-engine-status'),
    onOfflineEngineReady: (cb) => {
        ipcRenderer.on('offline-engine-ready', (_e, status) => cb(status));
        return () => ipcRenderer.removeAllListeners('offline-engine-ready');
    },
    onBackendStatus: (cb) => {
        ipcRenderer.on('backend-status', (_e, status) => cb(status));
        return () => ipcRenderer.removeAllListeners('backend-status');
    },
    // ── Internet status ───────────────────────────────────────────────────────
    getInternetStatus: () => ipcRenderer.invoke('get-internet-status'),
    onInternetStatus: (cb) => {
        ipcRenderer.on('internet-status', (_e, status) => cb(status));
        return () => ipcRenderer.removeAllListeners('internet-status');
    },
    updateTitleBarOverlay: (settings) => ipcRenderer.send('update-titlebar-overlay', settings),
    // Window controls
    windowMinimize: () => ipcRenderer.send('window-minimize'),
    windowMaximize: () => ipcRenderer.send('window-maximize'),
    windowClose: () => ipcRenderer.send('window-close'),
    windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
    onWindowMaximizeChange: (cb) => {
        ipcRenderer.on('window-maximize-change', (_e, val) => cb(val));
        return () => ipcRenderer.removeAllListeners('window-maximize-change');
    },
    // Zoom
    zoomIn: () => ipcRenderer.send('zoom-in'),
    zoomOut: () => ipcRenderer.send('zoom-out'),
    zoomReset: () => ipcRenderer.send('zoom-reset'),
    zoomSet: (pct) => ipcRenderer.send('zoom-set', pct),
    zoomGet: () => ipcRenderer.invoke('zoom-get'),
    onZoomChanged: (cb) => {
        ipcRenderer.on('zoom-changed', (_e, pct) => cb(pct));
        return () => ipcRenderer.removeAllListeners('zoom-changed');
    },
    launchApp: () => ipcRenderer.send('launch-app'),
    // Session management
    saveSession: (profile) => ipcRenderer.invoke('save-session', profile),
    getSession: () => ipcRenderer.invoke('get-session'),
    logout: () => ipcRenderer.send('logout'),
    // Auth API
    authRegister: (data) => ipcRenderer.invoke('auth-register', data),
    authLogin: (data) => ipcRenderer.invoke('auth-login', data),
    authForgotPassword: (data) => ipcRenderer.invoke('auth-forgot-password', data),
    authResetPassword: (data) => ipcRenderer.invoke('auth-reset-password', data),
    // Token store (electron-store backed, encrypted on disk)
    tokenSave: (access, refresh) => ipcRenderer.invoke('token-save', access, refresh),
    tokenGetAccess: () => ipcRenderer.invoke('token-get-access'),
    tokenGetRefresh: () => ipcRenderer.invoke('token-get-refresh'),
    tokenClear: () => ipcRenderer.invoke('token-clear'),
});
