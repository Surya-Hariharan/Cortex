/**
 * Cortex API shim (backend connectivity disabled).
 *
 * This module preserves the renderer import contract while returning safe,
 * offline-friendly defaults during backend/database redesign.
 */

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
        this._set(false);
        return false;
    },
};

export const system = {
    health: () => Promise.resolve({ status: 'ok', mode: 'redesign_baseline', services: {} }),
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
    backendStatus._set(false);
    return false;
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
