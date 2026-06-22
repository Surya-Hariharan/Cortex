import { getAccessToken } from './storage/tokenStore.js';

const DEFAULT_BACKEND_URL = 'http://localhost:8080';

function resolveBaseUrl() {
    try {
        const stored = window?.localStorage?.getItem('cortex-backend-base-url');
        if (stored) return stored.replace(/\/+$/, '');
    } catch {
        // Ignore localStorage access errors in constrained contexts.
    }

    const envUrl = typeof process !== 'undefined' ? process?.env?.CORTEX_BACKEND_URL : null;
    if (envUrl) return String(envUrl).replace(/\/+$/, '');
    return DEFAULT_BACKEND_URL;
}

function createApiError(message, extras = {}) {
    const error = new Error(message);
    Object.assign(error, extras);
    return error;
}

async function parseResponseBody(response) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        return response.json();
    }
    const text = await response.text();
    return text ? { detail: text } : {};
}

export const apiClient = {
    baseURL: resolveBaseUrl(),
    async request(path, { method = 'GET', headers = {}, body, signal } = {}) {
        const url = `${this.baseURL}${path.startsWith('/') ? path : `/${path}`}`;
        const finalHeaders = { ...headers };

        let finalBody = body;
        if (body != null && typeof body === 'object' && !(body instanceof FormData)) {
            finalBody = JSON.stringify(body);
            if (!finalHeaders['Content-Type']) {
                finalHeaders['Content-Type'] = 'application/json';
            }
        }

        try {
            const response = await fetch(url, {
                method,
                headers: finalHeaders,
                body: finalBody,
                signal,
            });

            const data = await parseResponseBody(response);

            if (!response.ok) {
                throw createApiError(data?.error || data?.detail || `Request failed with status ${response.status}`, {
                    status: response.status,
                    data,
                    networkError: false,
                });
            }

            return data;
        } catch (error) {
            if (error?.networkError === false) throw error;
            throw createApiError('Network request failed', {
                cause: error,
                networkError: true,
            });
        }
    },
};

export function getUserId() {
    try {
        const raw = localStorage.getItem('cortex-auth-profile');
        if (!raw) return null;
        return JSON.parse(raw).id || null;
    } catch {
        return null;
    }
}

export const backendStatus = {
    online: false,
    _listeners: new Set(),
    _set(v) {
        if (this.online !== v) {
            this.online = v;
            this._listeners.forEach((fn) => fn(v));
        }
    },
    subscribe(fn) {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    },
    async check() {
        try {
            await apiClient.request('/health');
            this._set(true);
            return true;
        } catch {
            this._set(false);
            return false;
        }
    },
};

export const system = {
    health: () => apiClient.request('/health'),
};

export const auth = {
    signup: (payload) => apiClient.request('/auth/signup', { method: 'POST', body: payload }),
    login: (payload) => apiClient.request('/auth/login', { method: 'POST', body: payload }),
    refresh: (refreshToken) => apiClient.request('/auth/refresh', { method: 'POST', body: { refreshToken } }),
    logout: async (refreshToken) => {
        const accessToken = await getAccessToken();
        return apiClient.request('/auth/logout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken || ''}` },
            body: { refreshToken },
        });
    },
};

export const reference = {
    districts: () => apiClient.request('/reference/districts'),
    colleges: (districtId) =>
        apiClient.request(
            districtId ? `/reference/colleges?districtId=${encodeURIComponent(String(districtId))}` : '/reference/colleges'
        ),
    degrees: () => apiClient.request('/reference/degrees'),
    courses: (degreeId) =>
        apiClient.request(
            degreeId ? `/reference/courses?degreeId=${encodeURIComponent(String(degreeId))}` : '/reference/courses'
        ),
};

export async function isBackendReady() {
    return backendStatus.check();
}

const _notAvailable = (name) => () =>
    Promise.reject(Object.assign(new Error(`${name} is not available in this release.`), { notAvailable: true }));

// Future release: documents
export const documents = {
    upload: _notAvailable('documents.upload'),
    list: () => Promise.resolve([]),
    get: _notAvailable('documents.get'),
    update: _notAvailable('documents.update'),
    delete: _notAvailable('documents.delete'),
    reindex: _notAvailable('documents.reindex'),
};

// Future release: notes
export const notes = {
    create: _notAvailable('notes.create'),
    list: () => Promise.resolve([]),
    get: _notAvailable('notes.get'),
    update: _notAvailable('notes.update'),
    delete: _notAvailable('notes.delete'),
    setVisibility: _notAvailable('notes.setVisibility'),
    browsePublic: () => Promise.resolve([]),
    getShared: _notAvailable('notes.getShared'),
    save: _notAvailable('notes.save'),
};

// Future release: tasks
export const tasks = {
    create: _notAvailable('tasks.create'),
    list: () => Promise.resolve([]),
    get: _notAvailable('tasks.get'),
    update: _notAvailable('tasks.update'),
    delete: _notAvailable('tasks.delete'),
};

// Future release: projects
export const projects = {
    create: _notAvailable('projects.create'),
    list: () => Promise.resolve([]),
    get: _notAvailable('projects.get'),
    update: _notAvailable('projects.update'),
    delete: _notAvailable('projects.delete'),
};

// Future release: search
export const search = {
    query: () => Promise.resolve({ results: [] }),
};

// Future release: chat
export const chat = {
    stream(_request, _onToken, _onDone, onError) {
        const controller = new AbortController();
        setTimeout(() => {
            onError?.('Chat is not available in this release.');
        }, 0);
        return controller;
    },
    create: _notAvailable('chat.create'),
    list: () => Promise.resolve([]),
    get: _notAvailable('chat.get'),
    messages: () => Promise.resolve([]),
    delete: _notAvailable('chat.delete'),
};

// Future release: mesh
export const mesh = {
    peers: () => Promise.resolve({ peers: [] }),
    sync: _notAvailable('mesh.sync'),
};

// Future release: transcription
export const transcription = {
    transcribe: _notAvailable('transcription.transcribe'),
};

// Future release: groups
export const groups = {
    create: _notAvailable('groups.create'),
    list: () => Promise.resolve([]),
    get: _notAvailable('groups.get'),
    delete: _notAvailable('groups.delete'),
    join: _notAvailable('groups.join'),
    leave: _notAvailable('groups.leave'),
    updateSettings: _notAvailable('groups.updateSettings'),
    blockMember: _notAvailable('groups.blockMember'),
    removeMember: _notAvailable('groups.removeMember'),
    getMessages: () => Promise.resolve([]),
    sendMessage: _notAvailable('groups.sendMessage'),
};

// Future release: activity
export const activity = {
    stats: () => Promise.resolve({}),
    chart: () => Promise.resolve([]),
    feed: () => Promise.resolve([]),
};

// Future release: notifications
export const notifications = {
    list: () => Promise.resolve([]),
    create: _notAvailable('notifications.create'),
    markRead: _notAvailable('notifications.markRead'),
    markAllRead: _notAvailable('notifications.markAllRead'),
    deleteOne: _notAvailable('notifications.deleteOne'),
    deleteAll: _notAvailable('notifications.deleteAll'),
};

// Future release: engagement
export const engagement = {
    recordView: _notAvailable('engagement.recordView'),
    recordDownload: _notAvailable('engagement.recordDownload'),
    rate: _notAvailable('engagement.rate'),
    entityStats: () => Promise.resolve({}),
};
