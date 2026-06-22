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

function disabled(message = 'Backend API is disabled during redesign.') {
    return Promise.resolve({ disabled: true, detail: message });
}

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
    models: () => disabled(),
    scheduler: () => disabled(),
    resources: () => disabled(),
    benchmark: () => disabled(),
    loadModel: () => disabled(),
    unloadModel: () => disabled(),
    pauseScheduler: () => disabled(),
    resumeScheduler: () => disabled(),
    setRuntime: () => disabled(),
    setInternetStatus: () => disabled(),
    getMode: () => Promise.resolve({ mode: 'redesign_baseline' }),
    setPrivacy: () => disabled(),
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

export const documents = {
    upload: () => disabled(),
    list: () => Promise.resolve([]),
    get: () => disabled(),
    update: () => disabled(),
    delete: () => disabled(),
    reindex: () => disabled(),
};

export const notes = {
    create: () => disabled(),
    list: () => Promise.resolve([]),
    get: () => disabled(),
    update: () => disabled(),
    delete: () => disabled(),
    setVisibility: () => disabled(),
    browsePublic: () => Promise.resolve([]),
    getShared: () => disabled(),
    save: () => disabled(),
};

export const tasks = {
    create: () => disabled(),
    list: () => Promise.resolve([]),
    get: () => disabled(),
    update: () => disabled(),
    delete: () => disabled(),
};

export const projects = {
    create: () => disabled(),
    list: () => Promise.resolve([]),
    get: () => disabled(),
    update: () => disabled(),
    delete: () => disabled(),
};

export const search = {
    query: () => Promise.resolve({ results: [] }),
};

export const chat = {
    stream(_request, _onToken, _onDone, onError) {
        const controller = new AbortController();
        setTimeout(() => {
            onError?.('Chat backend is disabled during redesign.');
        }, 0);
        return controller;
    },
    create: () => disabled(),
    list: () => Promise.resolve([]),
    get: () => disabled(),
    messages: () => Promise.resolve([]),
    delete: () => disabled(),
};

export const mesh = {
    peers: () => Promise.resolve({ peers: [] }),
    sync: () => disabled(),
};

export const transcription = {
    transcribe: () => disabled(),
};

export async function isBackendReady() {
    return backendStatus.check();
}

export const groups = {
    create: () => disabled(),
    list: () => Promise.resolve([]),
    get: () => disabled(),
    delete: () => disabled(),
    join: () => disabled(),
    leave: () => disabled(),
    updateSettings: () => disabled(),
    blockMember: () => disabled(),
    removeMember: () => disabled(),
    getMessages: () => Promise.resolve([]),
    sendMessage: () => disabled(),
};

export const activity = {
    stats: () => Promise.resolve({}),
    chart: () => Promise.resolve([]),
    feed: () => Promise.resolve([]),
};

export const notifications = {
    list: () => Promise.resolve([]),
    create: () => disabled(),
    markRead: () => disabled(),
    markAllRead: () => disabled(),
    deleteOne: () => disabled(),
    deleteAll: () => disabled(),
};

export const engagement = {
    recordView: () => disabled(),
    recordDownload: () => disabled(),
    rate: () => disabled(),
    entityStats: () => Promise.resolve({}),
};
