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

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function req(path, options = {}) {
    const url = `${BASE}${path}`;
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    });
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
};

// ── Documents ─────────────────────────────────────────────────────────────────

export const documents = {
    upload(file, userId, projectId = null) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('user_id', userId);
        if (projectId) fd.append('project_id', projectId);
        return fetch(`${BASE}/documents/upload`, { method: 'POST', body: fd })
            .then(r => r.json());
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
        return req(`/documents/${id}/reindex`, { method: 'POST' });
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
                    } catch (_) {}
                }
            }
        }).catch((err) => {
            if (err.name !== 'AbortError') onError?.(err.message);
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
    try {
        const res = await fetch(`${BASE}/system/health`, { signal: AbortSignal.timeout(2000) });
        return res.ok;
    } catch {
        return false;
    }
}
