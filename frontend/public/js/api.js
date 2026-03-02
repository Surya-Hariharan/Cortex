const API = '/api';

function getToken() { return localStorage.getItem('cortex_token'); }

function authHeaders(extra = {}) {
    const token = getToken();
    const h = { 'Content-Type': 'application/json', ...extra };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
}

async function jsonPost(url, body = {}) {
    const res = await fetch(`${API}${url}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
    });
    if (res.status === 401) { handleUnauth(); throw new Error('Session expired'); }
    return res.json();
}
async function jsonGet(url) {
    const res = await fetch(`${API}${url}`, { headers: authHeaders() });
    if (res.status === 401) { handleUnauth(); throw new Error('Session expired'); }
    return res.json();
}
async function jsonDelete(url) {
    const res = await fetch(`${API}${url}`, { method: 'DELETE', headers: authHeaders() });
    if (res.status === 401) { handleUnauth(); throw new Error('Session expired'); }
    return res.json();
}
async function jsonPatch(url, body = {}) {
    const res = await fetch(`${API}${url}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(body),
    });
    if (res.status === 401) { handleUnauth(); throw new Error('Session expired'); }
    return res.json();
}

function handleUnauth() {
    localStorage.removeItem('cortex_token');
    localStorage.removeItem('cortex_user');
    window.location.reload();
}

const api = {
    // Auth (public — no token needed)
    authRegister: (data) => {
        return fetch(`${API}/auth/register`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }).then(r => r.json());
    },
    authVerifyOtp: (email, otp) => {
        return fetch(`${API}/auth/verify-otp`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp }),
        }).then(r => r.json());
    },
    authResendOtp: (email) => {
        return fetch(`${API}/auth/resend-otp`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        }).then(r => r.json());
    },
    authLogin: (email, password) => {
        return fetch(`${API}/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        }).then(r => r.json());
    },
    authMe: () => jsonGet('/auth/me'),
    getAcademicOptions: () => fetch(`${API}/auth/academic-options`).then(r => r.json()),
    checkConnectivity: () => fetch(`${API}/connectivity`).then(r => r.json()).catch(() => ({ online: false })),

    // Search
    search: async (query, onToken) => {
        const res = await fetch(`${API}/search`, {
            method: 'POST',
            headers: authHeaders({ Accept: 'text/event-stream' }),
            body: JSON.stringify({ query }),
        });
        if (res.status === 401) { handleUnauth(); throw new Error('Session expired'); }
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
                } catch {}
            }
        }
        return result;
    },
    searchSimple: (q) => jsonPost('/search', { query: q }),

    uploadPdf: async (file) => {
        const fd = new FormData();
        fd.append('pdf', file);
        const h = {};
        const token = getToken();
        if (token) h['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`${API}/upload-pdf`, { method: 'POST', headers: h, body: fd });
        if (res.status === 401) { handleUnauth(); throw new Error('Session expired'); }
        return res.json();
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

    // Utility
    getToken,
    isAuthenticated: () => !!getToken(),
    logout: () => { localStorage.removeItem('cortex_token'); localStorage.removeItem('cortex_user'); window.location.reload(); },
    getUser: () => { try { return JSON.parse(localStorage.getItem('cortex_user')); } catch { return null; } },
};

export default api;
