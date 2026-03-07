const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    search: (query) => ipcRenderer.invoke('search', query),
    uploadPdf: () => ipcRenderer.invoke('upload-pdf'),
    getStats: () => ipcRenderer.invoke('get-stats'),
    shareToNetwork: (docId) => ipcRenderer.invoke('share-to-network', docId),
    getPeers: () => ipcRenderer.invoke('get-peers'),
    getPerfStats: () => ipcRenderer.invoke('get-perf-stats'),
    addNote: (note) => ipcRenderer.invoke('add-note', note),
    getNotes: () => ipcRenderer.invoke('get-notes'),
    deleteNote: (id) => ipcRenderer.invoke('delete-note', id),
    toggleNoteComplete: (id) => ipcRenderer.invoke('toggle-note-complete', id),
    updateTitleBarOverlay: (settings) => ipcRenderer.send('update-titlebar-overlay', settings),
    // Window controls
    windowMinimize: () => ipcRenderer.send('window-minimize'),
    windowMaximize: () => ipcRenderer.send('window-maximize'),
    windowClose:    () => ipcRenderer.send('window-close'),
    windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
    onWindowMaximizeChange: (cb) => {
        ipcRenderer.on('window-maximize-change', (_e, val) => cb(val));
        return () => ipcRenderer.removeAllListeners('window-maximize-change');
    },
    // Zoom
    zoomIn:    () => ipcRenderer.send('zoom-in'),
    zoomOut:   () => ipcRenderer.send('zoom-out'),
    zoomReset: () => ipcRenderer.send('zoom-reset'),
    zoomSet:   (pct) => ipcRenderer.send('zoom-set', pct),
    zoomGet:   () => ipcRenderer.invoke('zoom-get'),
    onZoomChanged: (cb) => {
        ipcRenderer.on('zoom-changed', (_e, pct) => cb(pct));
        return () => ipcRenderer.removeAllListeners('zoom-changed');
    },
    launchApp: () => ipcRenderer.send('launch-app'),
    // Session management
    saveSession: (profile) => ipcRenderer.invoke('save-session', profile),
    getSession:  ()        => ipcRenderer.invoke('get-session'),
    logout:      ()        => ipcRenderer.send('logout'),
});
