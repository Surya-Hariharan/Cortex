const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // ── Legacy IPC (kept for compatibility) ───────────────────────────────────
    search: (query) => ipcRenderer.invoke('search', query),
    uploadPdf: (userId) => ipcRenderer.invoke('upload-pdf', userId),
    getStats: () => ipcRenderer.invoke('get-stats'),
    shareToNetwork: (docId) => ipcRenderer.invoke('share-to-network', docId),
    getPeers: () => ipcRenderer.invoke('get-peers'),
    meshStart: () => ipcRenderer.invoke('mesh-start'),
    meshStop: () => ipcRenderer.invoke('mesh-stop'),
    getPerfStats: () => ipcRenderer.invoke('get-perf-stats'),
    addNote: (note) => ipcRenderer.invoke('add-note', note),
    getNotes: () => ipcRenderer.invoke('get-notes'),
    deleteNote: (id) => ipcRenderer.invoke('delete-note', id),
    toggleNoteComplete: (id) => ipcRenderer.invoke('toggle-note-complete', id),
    // ── Workspace Pages ───────────────────────────────────────────────────────
    createPage: (id, title, content, parentId) => ipcRenderer.invoke('create-page', id, title, content, parentId),
    updatePage: (id, title, content) => ipcRenderer.invoke('update-page', id, title, content),
    getPage: (id) => ipcRenderer.invoke('get-page', id),
    getPages: () => ipcRenderer.invoke('get-pages'),
    deletePage: (id) => ipcRenderer.invoke('delete-page', id),
    // ── Backend status ────────────────────────────────────────────────────────
    backendReady: () => ipcRenderer.invoke('backend-ready'),
    getOfflineEngineStatus: () => ipcRenderer.invoke('get-offline-engine-status'),
    onOfflineEngineReady: (cb) => {
        ipcRenderer.on('offline-engine-ready', (_e, status) => cb(status));
        return () => ipcRenderer.removeAllListeners('offline-engine-ready');
    },
    onBackendStatus: (cb) => {
        ipcRenderer.on('backend-status', (_e, status) => cb(status));
        return () => ipcRenderer.removeAllListeners('backend-status');
    },
    // ── Internet status ───────────────────────────────────────────────────────
    getInternetStatus: () => ipcRenderer.invoke('get-internet-status'),
    onInternetStatus: (cb) => {
        ipcRenderer.on('internet-status', (_e, status) => cb(status));
        return () => ipcRenderer.removeAllListeners('internet-status');
    },
    updateTitleBarOverlay: (settings) => ipcRenderer.send('update-titlebar-overlay', settings),
    // Window controls
    windowMinimize: () => ipcRenderer.send('window-minimize'),
    windowMaximize: () => ipcRenderer.send('window-maximize'),
    windowClose: () => ipcRenderer.send('window-close'),
    windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
    onWindowMaximizeChange: (cb) => {
        ipcRenderer.on('window-maximize-change', (_e, val) => cb(val));
        return () => ipcRenderer.removeAllListeners('window-maximize-change');
    },
    // Zoom
    zoomIn: () => ipcRenderer.send('zoom-in'),
    zoomOut: () => ipcRenderer.send('zoom-out'),
    zoomReset: () => ipcRenderer.send('zoom-reset'),
    zoomSet: (pct) => ipcRenderer.send('zoom-set', pct),
    zoomGet: () => ipcRenderer.invoke('zoom-get'),
    onZoomChanged: (cb) => {
        ipcRenderer.on('zoom-changed', (_e, pct) => cb(pct));
        return () => ipcRenderer.removeAllListeners('zoom-changed');
    },
    launchApp: () => ipcRenderer.send('launch-app'),
    // Session management
    saveSession: (profile) => ipcRenderer.invoke('save-session', profile),
    getSession: () => ipcRenderer.invoke('get-session'),
    logout: () => ipcRenderer.send('logout'),
    // Auth API
    authRegister: (data) => ipcRenderer.invoke('auth-register', data),
    authLogin: (data) => ipcRenderer.invoke('auth-login', data),
    authForgotPassword: (data) => ipcRenderer.invoke('auth-forgot-password', data),
    authResetPassword: (data) => ipcRenderer.invoke('auth-reset-password', data),
    // ── Optional cloud account (apps/server, backed by Supabase) ────────────────
    // Entirely separate from the local auth* calls above.
    cloudAuthInitSession: (data, token) => ipcRenderer.invoke('cloud-auth-init-session', data, token),
    cloudAuthLogout: () => ipcRenderer.invoke('cloud-auth-logout'),
    cloudAuthLogoutAll: () => ipcRenderer.invoke('cloud-auth-logout-all'),
    cloudAccountDelete: () => ipcRenderer.invoke('cloud-account-delete'),
    cloudVerifyEmailRequest: () => ipcRenderer.invoke('cloud-verify-email-request'),
    cloudVerifyEmailConfirm: (token) => ipcRenderer.invoke('cloud-verify-email-confirm', token),
    cloudForgotPassword: (email) => ipcRenderer.invoke('cloud-forgot-password', email),
    cloudResetPassword: (payload) => ipcRenderer.invoke('cloud-reset-password', payload),
    cloudDevicesList: () => ipcRenderer.invoke('cloud-devices-list'),
    cloudDevicesRevoke: (deviceId) => ipcRenderer.invoke('cloud-devices-revoke', deviceId),
    cloudProfileGet: () => ipcRenderer.invoke('cloud-profile-get'),
    cloudProfileUpdate: (patch) => ipcRenderer.invoke('cloud-profile-update', patch),
    cloudPreferencesGet: () => ipcRenderer.invoke('cloud-preferences-get'),
    cloudPreferencesSet: (preferences) => ipcRenderer.invoke('cloud-preferences-set', preferences),
    cloudSubscriptionGet: () => ipcRenderer.invoke('cloud-subscription-get'),
    // Sync
    cloudSyncNow: () => ipcRenderer.invoke('cloud-sync-now'),
    cloudSyncStatus: () => ipcRenderer.invoke('cloud-sync-status'),
    // Backup
    cloudBackupNow: (opts) => ipcRenderer.invoke('cloud-backup-now', opts),
    cloudBackupList: () => ipcRenderer.invoke('cloud-backup-list'),
    cloudBackupRestore: (backupId) => ipcRenderer.invoke('cloud-backup-restore', backupId),
    // Collaboration
    cloudFriendsSendRequest: (addresseeEmail) => ipcRenderer.invoke('cloud-friends-send-request', addresseeEmail),
    cloudFriendsListRequests: () => ipcRenderer.invoke('cloud-friends-list-requests'),
    cloudFriendsRespond: (requestId, accept) => ipcRenderer.invoke('cloud-friends-respond', requestId, accept),
    cloudFriendsList: () => ipcRenderer.invoke('cloud-friends-list'),
    cloudWorkspacesCreate: (payload) => ipcRenderer.invoke('cloud-workspaces-create', payload),
    cloudWorkspacesList: () => ipcRenderer.invoke('cloud-workspaces-list'),
    cloudWorkspacesGet: (workspaceId) => ipcRenderer.invoke('cloud-workspaces-get', workspaceId),
    cloudWorkspacesUpdate: (workspaceId, patch) => ipcRenderer.invoke('cloud-workspaces-update', workspaceId, patch),
    cloudWorkspacesDelete: (workspaceId) => ipcRenderer.invoke('cloud-workspaces-delete', workspaceId),
    cloudWorkspacesMembers: (workspaceId) => ipcRenderer.invoke('cloud-workspaces-members', workspaceId),
    cloudWorkspacesUpdateMember: (workspaceId, userId, role) => ipcRenderer.invoke('cloud-workspaces-update-member', workspaceId, userId, role),
    cloudWorkspacesRemoveMember: (workspaceId, userId) => ipcRenderer.invoke('cloud-workspaces-remove-member', workspaceId, userId),
    cloudInvitationsCreate: (workspaceId, payload) => ipcRenderer.invoke('cloud-invitations-create', workspaceId, payload),
    cloudInvitationsList: (workspaceId) => ipcRenderer.invoke('cloud-invitations-list', workspaceId),
    cloudInvitationsAccept: (token) => ipcRenderer.invoke('cloud-invitations-accept', token),
    cloudInvitationsDecline: (token) => ipcRenderer.invoke('cloud-invitations-decline', token),
    cloudOrganizationsCreate: (name) => ipcRenderer.invoke('cloud-organizations-create', name),
    cloudOrganizationsAddMember: (orgId, userId, role) => ipcRenderer.invoke('cloud-organizations-add-member', orgId, userId, role),
    cloudOrganizationsRemoveMember: (orgId, userId) => ipcRenderer.invoke('cloud-organizations-remove-member', orgId, userId),
    // Notifications
    cloudNotificationsList: (unreadOnly) => ipcRenderer.invoke('cloud-notifications-list', unreadOnly),
    cloudNotificationsMarkRead: (id) => ipcRenderer.invoke('cloud-notifications-mark-read', id),
    cloudNotificationsMarkAllRead: () => ipcRenderer.invoke('cloud-notifications-mark-all-read'),
    // Auth token sync
    cloudUpdateToken: (token) => ipcRenderer.send('cloud-update-token', token),
});
