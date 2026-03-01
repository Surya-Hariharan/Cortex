const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Search & Documents
    search: (query) => ipcRenderer.invoke('search', query),
    uploadPdf: () => ipcRenderer.invoke('upload-pdf'),
    getStats: () => ipcRenderer.invoke('get-stats'),
    // Network
    shareToNetwork: (docId) => ipcRenderer.invoke('share-to-network', docId),
    getPeers: () => ipcRenderer.invoke('get-peers'),
    // Performance
    getPerfStats: () => ipcRenderer.invoke('get-perf-stats'),
    // Notes
    addNote: (note) => ipcRenderer.invoke('add-note', note),
    getNotes: () => ipcRenderer.invoke('get-notes'),
    deleteNote: (id) => ipcRenderer.invoke('delete-note', id),
    toggleNoteComplete: (id) => ipcRenderer.invoke('toggle-note-complete', id),
    // Chat — Projects
    createProject: (name) => ipcRenderer.invoke('create-project', name),
    getProjects: () => ipcRenderer.invoke('get-projects'),
    deleteProject: (id) => ipcRenderer.invoke('delete-project', id),
    renameProject: (id, name) => ipcRenderer.invoke('rename-project', id, name),
    // Chat — Chats
    createChat: (projectId) => ipcRenderer.invoke('create-chat', projectId),
    getChats: (projectId) => ipcRenderer.invoke('get-chats', projectId),
    deleteChat: (id) => ipcRenderer.invoke('delete-chat', id),
    searchChats: (query) => ipcRenderer.invoke('search-chats', query),
    // Chat — Messages
    getChatMessages: (chatId) => ipcRenderer.invoke('get-chat-messages', chatId),
    addChatMessage: (chatId, role, content) => ipcRenderer.invoke('add-chat-message', chatId, role, content),
});
