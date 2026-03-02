const API_BASE = '/api';

async function jsonPost(url, body = {}) {
    const res = await fetch(`${API_BASE}${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return res.json();
}

async function jsonGet(url) {
    const res = await fetch(`${API_BASE}${url}`);
    return res.json();
}

async function jsonDelete(url) {
    const res = await fetch(`${API_BASE}${url}`, { method: 'DELETE' });
    return res.json();
}

async function jsonPatch(url, body = {}) {
    const res = await fetch(`${API_BASE}${url}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return res.json();
}

const api = {
    // Search & Documents
    search: (query, onToken) => {
        return new Promise((resolve, reject) => {
            const eventSource = new EventSource(`${API_BASE}/search?_method=POST`);

            // SSE doesn't support POST natively, so we use fetch with streaming
            fetch(`${API_BASE}/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                },
                body: JSON.stringify({ query }),
            }).then(async (response) => {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6).trim();
                            if (data === '[DONE]') continue;
                            try {
                                const parsed = JSON.parse(data);
                                if (parsed.type === 'token' && onToken) {
                                    onToken(parsed.text);
                                } else if (parsed.type === 'results') {
                                    resolve(parsed);
                                }
                            } catch { }
                        }
                    }
                }

                // If we never got results through SSE, resolve with empty
                resolve({ results: [] });
            }).catch(reject);
        });
    },

    // Non-streaming search fallback
    searchSimple: (query) => jsonPost('/search', { query }),

    uploadPdf: async (file) => {
        const formData = new FormData();
        formData.append('pdf', file);
        const res = await fetch(`${API_BASE}/upload-pdf`, {
            method: 'POST',
            body: formData,
        });
        return res.json();
    },

    getStats: () => jsonGet('/stats'),

    // Network
    shareToNetwork: (docId) => jsonPost('/network/share', { docId }),
    getPeers: () => jsonGet('/network/peers'),
    getPeerDocuments: (peerId) => jsonGet(`/network/peer-documents/${peerId}`),
    requestPeerDocument: (peerId, docId) => jsonPost('/network/request-document', { peerId, docId }),
    getMeshStatus: () => jsonGet('/network/mesh-status'),

    // Performance
    getPerfStats: () => jsonGet('/perf-stats'),

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
    searchChats: (query) => jsonGet(`/chats/search?q=${encodeURIComponent(query)}`),

    // Chat Messages
    getChatMessages: (chatId) => jsonGet(`/chats/${chatId}/messages`),
    addChatMessage: (chatId, role, content) => jsonPost(`/chats/${chatId}/messages`, { role, content }),
};

export default api;
