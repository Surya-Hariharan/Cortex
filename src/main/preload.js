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
});
