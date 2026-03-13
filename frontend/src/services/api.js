/**
 * Cortex API Client
 * Wraps all FastAPI backend endpoints (http://127.0.0.1:8765/api/v1).
 * The renderer calls these directly via fetch — no IPC hop needed.
 */

const BASE = 'http://127.0.0.1:8765/api/v1';

// ── Auth helpers ──────────────────────────────────────────────────────────────

export function getUserId() {
    try {
        const raw = localStorage.getItem('cortex-auth-profile');
        if (!raw) return null;
        return JSON.parse(raw).id || null;
    } catch {
        return null;
    }
}

// ── Backend status tracking ───────────────────────────────────────────────────

export const backendStatus = {
    online: true,
    _listeners: new Set(),
    _set(v) {
        if (this.online !== v) {
            this.online = v;
            this._listeners.forEach(fn => fn(v));
        }
    },
    subscribe(fn) {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    },
    async check() {
        try {
            const res = await fetch(`${BASE}/system/health`, { signal: AbortSignal.timeout(5000) });
            this._set(res.ok);
        } catch {
            this._set(false);
        }
        return this.online;
    },
};

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function req(path, options = {}) {
    const url = `${BASE}${path}`;
    const { headers: extraHeaders = {}, signal, ...restOptions } = options;
    // Only set Content-Type when there is a body — GET/DELETE requests without a body
    // must NOT send this header because it triggers a CORS preflight from Electron's
    // file:// renderer (Origin: null) which can fail in some Chromium builds.
    const hasBody = restOptions.body !== undefined;
    let res;
    try {
        res = await fetch(url, {
            headers: {
                ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
                ...extraHeaders,
            },
            signal: signal || AbortSignal.timeout(5000),
            ...restOptions,
        });
    } catch (err) {
        backendStatus._set(false);
        if (err.name === 'AbortError' || err.name === 'TimeoutError') {
            throw new Error('Request timed out. The backend may be busy or offline.');
        }
        throw new Error('Backend is offline. Your data is saved locally.');
    }
    backendStatus._set(true);
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({ detail: res.statusText }));
    if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
    return data;
}

// Build query string from an object, ignoring null/undefined values.
function qs(params) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== null && v !== undefined) p.append(k, v);
    }
    const s = p.toString();
    return s ? `?${s}` : '';
}

// ── System ────────────────────────────────────────────────────────────────────

export const system = {
    health: () => req('/system/health'),
    models: () => req('/system/models'),
    scheduler: () => req('/system/scheduler'),
    resources: () => req('/system/resources'),
    benchmark: () => req('/system/benchmark', { method: 'POST' }),
    loadModel: (modelName) => req(`/system/models/${modelName}/load`, { method: 'POST' }),
    unloadModel: (modelName) => req(`/system/models/${modelName}/unload`, { method: 'POST' }),
    pauseScheduler: () => req('/system/scheduler/pause', { method: 'POST' }),
    resumeScheduler: () => req('/system/scheduler/resume', { method: 'POST' }),
    setRuntime: (runtime, precision) => req('/system/runtime', { method: 'POST', body: JSON.stringify({ runtime, precision }) }),
    setInternetStatus: (online) => req('/system/internet-status', { method: 'POST', body: JSON.stringify({ online }) }),
    getMode: () => req('/system/mode'),
    setPrivacy: (enabled) => req('/system/privacy', { method: 'POST', body: JSON.stringify({ enabled }) }),
};

// ── Documents ─────────────────────────────────────────────────────────────────

export const documents = {
    async upload(file, userId, projectId = null, { stream = null, subject = null } = {}) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('user_id', userId);
        if (projectId) fd.append('project_id', projectId);
        if (stream)    fd.append('stream', stream);
        if (subject)   fd.append('subject', subject);
        let res;
        try {
            res = await fetch(`${BASE}/documents/upload`, {
                method: 'POST',
                body: fd,
                signal: AbortSignal.timeout(120000), // 2 min for large files
            });
        } catch (err) {
            backendStatus._set(false);
            throw new Error('Backend is offline. Please start the server and try again.');
        }
        backendStatus._set(true);
        const data = await res.json().catch(() => ({ detail: res.statusText }));
        if (!res.ok) throw new Error(data.detail || `Upload failed (HTTP ${res.status})`);
        return data;
    },

    list(userId, { projectId, status, limit = 50, offset = 0 } = {}) {
        return req(`/documents/${qs({ user_id: userId, project_id: projectId, status, limit, offset })}`);
    },

    get(id) {
        return req(`/documents/${id}`);
    },

    update(id, data) {
        return req(`/documents/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },

    delete(id) {
        return req(`/documents/${id}`, { method: 'DELETE' });
    },

    reindex(id) {
        return req(`/documents/${id}/ingest`, { method: 'POST' });
    },
};

// ── Notes ─────────────────────────────────────────────────────────────────────

export const notes = {
    create(data) {
        return req('/notes/', { method: 'POST', body: JSON.stringify(data) });
    },

    list(userId, { projectId, limit = 50, offset = 0 } = {}) {
        return req(`/notes/${qs({ user_id: userId, project_id: projectId, limit, offset })}`);
    },

    get(id) {
        return req(`/notes/${id}`);
    },

    update(id, data) {
        return req(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },

    delete(id) {
        return req(`/notes/${id}`, { method: 'DELETE' });
    },

    setVisibility(noteId, userId, visibility) {
        return req(`/notes/${noteId}/visibility?user_id=${userId}`, {
            method: 'PATCH',
            body: JSON.stringify({ visibility }),
        });
    },

    browsePublic({ limit = 50, offset = 0, tag } = {}) {
        return req(`/notes/public/browse${qs({ limit, offset, tag })}`);
    },

    getShared(noteId) {
        return req(`/notes/shared/${noteId}`);
    },

    save(sourceNoteId, saverId) {
        return req(`/notes/${sourceNoteId}/save?saver_id=${saverId}`, { method: 'POST' });
    },
};

// ── Tasks ─────────────────────────────────────────────────────────────────────

export const tasks = {
    create(data) {
        return req('/tasks/', { method: 'POST', body: JSON.stringify(data) });
    },

    list(userId, { projectId, status, limit = 100, offset = 0 } = {}) {
        return req(`/tasks/${qs({ user_id: userId, project_id: projectId, status, limit, offset })}`);
    },

    get(id) {
        return req(`/tasks/${id}`);
    },

    update(id, data) {
        return req(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },

    delete(id) {
        return req(`/tasks/${id}`, { method: 'DELETE' });
    },
};

// ── Projects ──────────────────────────────────────────────────────────────────

export const projects = {
    create(data) {
        return req('/projects/', { method: 'POST', body: JSON.stringify(data) });
    },

    list(userId, { limit = 50, offset = 0 } = {}) {
        return req(`/projects/${qs({ user_id: userId, limit, offset })}`);
    },

    get(id) {
        return req(`/projects/${id}`);
    },

    update(id, data) {
        return req(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },

    delete(id) {
        return req(`/projects/${id}`, { method: 'DELETE' });
    },
};

// ── Semantic Search ───────────────────────────────────────────────────────────

export const search = {
    query(query, { userId, topK = 10, scoreThreshold = 0.35, documentIds, projectId } = {}) {
        return req('/search/', {
            method: 'POST',
            body: JSON.stringify({
                query,
                user_id: userId || getUserId() || 'local-user',
                top_k: topK,
                score_threshold: scoreThreshold,
                document_ids: documentIds || null,
                project_id: projectId || null,
            }),
        });
    },
};

// ── RAG / Chat ────────────────────────────────────────────────────────────────

export const chat = {
    /**
     * Streaming RAG chat using Server-Sent Events.
     * @param {Object}   request    - { query, user_id, chat_id?, project_id? }
     * @param {Function} onToken    - called for each text token chunk
     * @param {Function} onDone     - called with { chat_id, citations, tokens_used }
     * @param {Function} onError    - called with error message string
     * @returns {AbortController}   - call .abort() to cancel
     */
    stream(request, onToken, onDone, onError) {
        const controller = new AbortController();

        fetch(`${BASE}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
            signal: controller.signal,
        }).then(async (res) => {
            backendStatus._set(true);
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: res.statusText }));
                onError?.(err.detail || `HTTP ${res.status}`);
                return;
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // keep incomplete last line

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const event = JSON.parse(line.slice(6));
                        if (event.type === 'token') onToken?.(event.content);
                        else if (event.type === 'done') onDone?.(event);
                        else if (event.type === 'error') onError?.(event.detail);
                    } catch (_) { }
                }
            }
        }).catch((err) => {
            if (err.name === 'AbortError') return;
            backendStatus._set(false);
            onError?.('Backend is offline. AI chat requires the server to be running.');
        });

        return controller;
    },

    create(data) {
        return req('/chats/', { method: 'POST', body: JSON.stringify(data) });
    },

    list(userId, { limit = 50, offset = 0 } = {}) {
        return req(`/chats/${qs({ user_id: userId, limit, offset })}`);
    },

    get(id) {
        return req(`/chats/${id}`);
    },

    messages(chatId, { limit = 100, offset = 0 } = {}) {
        return req(`/chats/${chatId}/messages${qs({ limit, offset })}`);
    },

    delete(id) {
        return req(`/chats/${id}`, { method: 'DELETE' });
    },
};

// ── Mesh ──────────────────────────────────────────────────────────────────────

export const mesh = {
    peers: () => req('/mesh/peers'),

    sync(targetPeerId, since = null) {
        return req('/mesh/sync', {
            method: 'POST',
            body: JSON.stringify({ target_peer_id: targetPeerId, since }),
        });
    },
};

// ── Transcription ─────────────────────────────────────────────────────────────

export const transcription = {
    transcribe(audioFile, language = null) {
        const fd = new FormData();
        fd.append('file', audioFile);
        if (language) fd.append('language', language);
        return fetch(`${BASE}/transcription/`, { method: 'POST', body: fd })
            .then(r => r.json());
    },
};

// ── Convenience: check if backend is reachable ────────────────────────────────

export async function isBackendReady() {
    return backendStatus.check();
}

// ── Groups ────────────────────────────────────────────────────────────────────

export const groups = {
    create(data) {
        return req('/groups/', { method: 'POST', body: JSON.stringify(data) });
    },

    list(userId) {
        return req(`/groups/${qs({ user_id: userId })}`);
    },

    get(groupId) {
        return req(`/groups/${groupId}`);
    },

    delete(groupId, userId) {
        return req(`/groups/${groupId}${qs({ user_id: userId })}`, { method: 'DELETE' });
    },

    join(inviteCode, userId, userName) {
        return req(`/groups/join${qs({ invite_code: inviteCode, user_id: userId, user_name: userName })}`, { method: 'POST' });
    },

    leave(groupId, userId) {
        return req(`/groups/${groupId}/leave${qs({ user_id: userId })}`, { method: 'DELETE' });
    },

    updateSettings(groupId, adminId, data) {
        return req(`/groups/${groupId}/settings${qs({ admin_id: adminId })}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    },

    blockMember(groupId, memberUserId, adminId) {
        return req(`/groups/${groupId}/members/${memberUserId}/block${qs({ admin_id: adminId })}`, { method: 'PATCH' });
    },

    removeMember(groupId, memberUserId, adminId) {
        return req(`/groups/${groupId}/members/${memberUserId}${qs({ admin_id: adminId })}`, { method: 'DELETE' });
    },

    getMessages(groupId, channel = 'general', limit = 100) {
        return req(`/groups/${groupId}/messages${qs({ channel, limit })}`);
    },

    sendMessage(groupId, data) {
        return req(`/groups/${groupId}/messages`, { method: 'POST', body: JSON.stringify(data) });
    },
};
