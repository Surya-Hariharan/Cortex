import { getAccessToken } from './storage/tokenStore.js';

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
    online: true,
    _listeners: new Set(),
    subscribe(fn) {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    },
    async check() {
        return true;
    },
};

export const system = {
    health: () => Promise.resolve({ status: 'ok' }),
};

export const auth = {
    signup: async (payload) => {
        const res = await window.electronAPI.authRegister(payload);
        if (res.status !== 200) throw { data: res.data };
        return res.data;
    },
    login: async (payload) => {
        const res = await window.electronAPI.authLogin(payload);
        if (res.status !== 200) throw { data: res.data };
        return res.data;
    },
    refresh: async () => ({}),
    logout: async () => {
        return { success: true };
    },
};

// Reference data is not used in local-first, return empty arrays to avoid breaking the UI temporarily
export const reference = {
    districts: () => Promise.resolve([]),
    colleges: () => Promise.resolve([]),
    degrees: () => Promise.resolve([]),
    courses: () => Promise.resolve([]),
};

export const workspacePages = {
    create: async (id, title, content = '{}', parentId = null) => {
        if (!window.electronAPI) return null;
        const res = await window.electronAPI.createPage(id, title, content, parentId);
        if (res.error) throw new Error(res.error);
        return res;
    },
    update: async (id, title, content) => {
        if (!window.electronAPI) return null;
        const res = await window.electronAPI.updatePage(id, title, content);
        if (res.error) throw new Error(res.error);
        return res;
    },
    get: async (id) => {
        if (!window.electronAPI) return null;
        const res = await window.electronAPI.getPage(id);
        if (res.error) throw new Error(res.error);
        return res.page;
    },
    list: async () => {
        if (!window.electronAPI) return [];
        const res = await window.electronAPI.getPages();
        if (res.error) throw new Error(res.error);
        return res.pages;
    },
    delete: async (id) => {
        if (!window.electronAPI) return null;
        const res = await window.electronAPI.deletePage(id);
        if (res.error) throw new Error(res.error);
        return res;
    }
};

export async function isBackendReady() {
    return true;
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
