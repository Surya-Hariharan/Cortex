const API = '/api';

async function jsonPost(url, body = {}) {
    const res = await fetch(`${API}${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return res.json();
}
async function jsonGet(url) { return (await fetch(`${API}${url}`)).json(); }
async function jsonDelete(url) { return (await fetch(`${API}${url}`, { method: 'DELETE' })).json(); }
async function jsonPatch(url, body = {}) {
    return (await fetch(`${API}${url}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })).json();
}

const api = {
    // Search
    search: async (query, onToken) => {
        const res = await fetch(`${API}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
            body: JSON.stringify({ query }),
        });
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '', result = { results: [] };
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6).trim();
                if (data === '[DONE]') continue;
                try {
                    const p = JSON.parse(data);
                    if (p.type === 'token' && onToken) onToken(p.text);
                    else if (p.type === 'results') result = p;
                } catch { }
            }
        }
        return result;
    },
    searchSimple: (q) => jsonPost('/search', { query: q }),

    uploadPdf: async (file) => {
        const fd = new FormData();
        fd.append('pdf', file);
        return (await fetch(`${API}/upload-pdf`, { method: 'POST', body: fd })).json();
    },

    getStats: () => jsonGet('/stats'),
    getPerfStats: () => jsonGet('/perf-stats'),

    // Network
    shareToNetwork: (docId) => jsonPost('/network/share', { docId }),
    getPeers: () => jsonGet('/network/peers'),
    getPeerDocuments: (peerId) => jsonGet(`/network/peer-documents/${peerId}`),
    requestPeerDocument: (peerId, docId) => jsonPost('/network/request-document', { peerId, docId }),
    getMeshStatus: () => jsonGet('/network/mesh-status'),

    // Notes
    addNote: (note) => jsonPost('/notes', note),
    getNotes: () => jsonGet('/notes'),
    deleteNote: (id) => jsonDelete(`/notes/${id}`),
    toggleNoteComplete: (id) => jsonPatch(`/notes/${id}/toggle`),

    // Projects
    createProject: (name) => jsonPost('/projects', { name }),
    getProjects: () => jsonGet('/projects'),
    deleteProject: (id) => jsonDelete(`/projects/${id}`),
    renameProject: (id, name) => jsonPatch(`/projects/${id}`, { name }),

    // Chats
    createChat: (projectId) => jsonPost('/chats', { projectId }),
    getChats: (projectId) => jsonGet(`/chats${projectId ? `?projectId=${projectId}` : ''}`),
    deleteChat: (id) => jsonDelete(`/chats/${id}`),
    searchChats: (q) => jsonGet(`/chats/search?q=${encodeURIComponent(q)}`),
    getChatMessages: (chatId) => jsonGet(`/chats/${chatId}/messages`),
    addChatMessage: (chatId, role, content) => jsonPost(`/chats/${chatId}/messages`, { role, content }),
};

export default api;
