/**
 * Cortex — Optional Cloud API Client
 *
 * Thin fetch wrapper around apps/server's public API. Every method rejects
 * with { notConfigured: true } unless CORTEX_CLOUD_API_URL is set — the
 * desktop app must keep working with zero network dependency, so this
 * module is never called on the local auth path (see AuthPortal.jsx /
 * main.js 'auth-login' handler, which are entirely unaffected by this file).
 *
 * Mirrors apps/server's route surface 1:1 — see apps/server/src/routes/*.
 */

function baseUrl() {
    return process.env.CORTEX_CLOUD_API_URL || null;
}

function isConfigured() {
    return !!baseUrl();
}

async function request(path, { method = 'GET', body, accessToken, query } = {}) {
    const url = baseUrl();
    if (!url) {
        throw Object.assign(new Error('Cloud sync is not configured.'), { notConfigured: true });
    }

    const qs = query
        ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString()
        : '';

    const res = await fetch(`${url}${path}${qs}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw Object.assign(new Error(data.detail || 'Cloud request failed.'), { status: res.status, data });
    }
    return data;
}

// ── Auth ─────────────────────────────────────────────────────────────────

function register({ email, password, full_name, device }) {
    return request('/api/v1/auth/register', { method: 'POST', body: { email, password, full_name, device } });
}

function login({ email, password, device }) {
    return request('/api/v1/auth/login', { method: 'POST', body: { email, password, device } });
}

function refresh(refreshToken, deviceId) {
    return request('/api/v1/auth/refresh', { method: 'POST', body: { refreshToken, deviceId } });
}

// Identifies the session via the bearer token itself — see
// apps/server/src/routes/auth.routes.js.
function logout(accessToken) {
    return request('/api/v1/auth/logout', { method: 'POST', accessToken });
}

function logoutAllDevices(accessToken) {
    return request('/api/v1/auth/logout-all', { method: 'POST', accessToken });
}

function requestEmailVerification(accessToken) {
    return request('/api/v1/auth/verify-email/request', { method: 'POST', accessToken });
}

function confirmEmailVerification(accessToken, token) {
    return request('/api/v1/auth/verify-email/confirm', { method: 'POST', accessToken, body: { token } });
}

function forgotPassword(email) {
    return request('/api/v1/auth/password/forgot', { method: 'POST', body: { email } });
}

function resetPassword({ email, token, new_password }) {
    return request('/api/v1/auth/password/reset', { method: 'POST', body: { email, token, new_password } });
}

function listDevices(accessToken) {
    return request('/api/v1/auth/devices', { accessToken });
}

function revokeDevice(accessToken, deviceId) {
    return request(`/api/v1/auth/devices/${deviceId}`, { method: 'DELETE', accessToken });
}

function deleteAccount(accessToken) {
    return request('/api/v1/auth/account', { method: 'DELETE', accessToken });
}

function setDeviceKey(accessToken, deviceId, wrappedUserKey) {
    return request(`/api/v1/auth/devices/${deviceId}/key`, { method: 'PUT', accessToken, body: { wrappedUserKey } });
}

// ── Profile ──────────────────────────────────────────────────────────────

function getMe(accessToken) {
    return request('/api/v1/users/me', { accessToken });
}

function updateMe(accessToken, patch) {
    return request('/api/v1/users/me', { method: 'PATCH', accessToken, body: patch });
}

function getPreferences(accessToken) {
    return request('/api/v1/users/me/preferences', { accessToken });
}

function setPreferences(accessToken, preferences) {
    return request('/api/v1/users/me/preferences', { method: 'PUT', accessToken, body: { preferences } });
}

function getSubscription(accessToken) {
    return request('/api/v1/users/me/subscription', { accessToken });
}

// ── Sync ─────────────────────────────────────────────────────────────────

function syncPush(accessToken, { deviceId, blobs }) {
    return request('/api/v1/sync/push', { method: 'POST', accessToken, body: { deviceId, blobs } });
}

function syncPull(accessToken, { since, limit, deviceId } = {}) {
    return request('/api/v1/sync/pull', { accessToken, query: { since, limit, deviceId } });
}

function syncVersions(accessToken, resourceType, resourceId) {
    return request(`/api/v1/sync/resource/${resourceType}/${resourceId}/versions`, { accessToken });
}

function syncStatus(accessToken) {
    return request('/api/v1/sync/status', { accessToken });
}

// ── Backup ───────────────────────────────────────────────────────────────

function createBackup(accessToken, { deviceId, kind, label } = {}) {
    return request('/api/v1/backups', { method: 'POST', accessToken, body: { deviceId, kind, label } });
}

function listBackups(accessToken) {
    return request('/api/v1/backups', { accessToken });
}

function restoreBackup(accessToken, backupId) {
    return request(`/api/v1/backups/${backupId}/restore`, { method: 'POST', accessToken });
}

// ── Collaboration: friends ──────────────────────────────────────────────

function sendFriendRequest(accessToken, addresseeEmail) {
    return request('/api/v1/friends/requests', { method: 'POST', accessToken, body: { addresseeEmail } });
}

function listFriendRequests(accessToken) {
    return request('/api/v1/friends/requests', { accessToken });
}

function respondToFriendRequest(accessToken, requestId, accept) {
    return request(`/api/v1/friends/requests/${requestId}/respond`, { method: 'POST', accessToken, body: { accept } });
}

function listFriends(accessToken) {
    return request('/api/v1/friends', { accessToken });
}

// ── Collaboration: workspaces ───────────────────────────────────────────

function createWorkspace(accessToken, { name, kind, organizationId }) {
    return request('/api/v1/workspaces', { method: 'POST', accessToken, body: { name, kind, organizationId } });
}

function listWorkspaces(accessToken) {
    return request('/api/v1/workspaces', { accessToken });
}

function getWorkspace(accessToken, workspaceId) {
    return request(`/api/v1/workspaces/${workspaceId}`, { accessToken });
}

function updateWorkspace(accessToken, workspaceId, { name }) {
    return request(`/api/v1/workspaces/${workspaceId}`, { method: 'PATCH', accessToken, body: { name } });
}

function deleteWorkspace(accessToken, workspaceId) {
    return request(`/api/v1/workspaces/${workspaceId}`, { method: 'DELETE', accessToken });
}

function listWorkspaceMembers(accessToken, workspaceId) {
    return request(`/api/v1/workspaces/${workspaceId}/members`, { accessToken });
}

function updateMemberRole(accessToken, workspaceId, userId, role) {
    return request(`/api/v1/workspaces/${workspaceId}/members/${userId}`, { method: 'PATCH', accessToken, body: { role } });
}

function removeMember(accessToken, workspaceId, userId) {
    return request(`/api/v1/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE', accessToken });
}

// ── Collaboration: invitations ──────────────────────────────────────────

function createInvitation(accessToken, workspaceId, { inviteeEmail, role }) {
    return request(`/api/v1/workspaces/${workspaceId}/invitations`, { method: 'POST', accessToken, body: { inviteeEmail, role } });
}

function listInvitations(accessToken, workspaceId) {
    return request(`/api/v1/workspaces/${workspaceId}/invitations`, { accessToken });
}

function acceptInvitation(accessToken, token, wrappedContentKey) {
    return request(`/api/v1/invitations/${token}/accept`, { method: 'POST', accessToken, body: { wrappedContentKey } });
}

function declineInvitation(accessToken, token) {
    return request(`/api/v1/invitations/${token}/decline`, { method: 'POST', accessToken });
}

// ── Collaboration: organizations ────────────────────────────────────────

function createOrganization(accessToken, name) {
    return request('/api/v1/organizations', { method: 'POST', accessToken, body: { name } });
}

function addOrganizationMember(accessToken, orgId, userId, role) {
    return request(`/api/v1/organizations/${orgId}/members`, { method: 'POST', accessToken, body: { userId, role } });
}

function removeOrganizationMember(accessToken, orgId, userId) {
    return request(`/api/v1/organizations/${orgId}/members/${userId}`, { method: 'DELETE', accessToken });
}

// ── Notifications ────────────────────────────────────────────────────────

function listNotifications(accessToken, unreadOnly) {
    return request('/api/v1/notifications', { accessToken, query: { unread: unreadOnly ? 'true' : undefined } });
}

function markNotificationRead(accessToken, id) {
    return request(`/api/v1/notifications/${id}/read`, { method: 'PATCH', accessToken });
}

function markAllNotificationsRead(accessToken) {
    return request('/api/v1/notifications/read-all', { method: 'PATCH', accessToken });
}

module.exports = {
    isConfigured,
    register,
    login,
    refresh,
    logout,
    logoutAllDevices,
    requestEmailVerification,
    confirmEmailVerification,
    forgotPassword,
    resetPassword,
    listDevices,
    revokeDevice,
    deleteAccount,
    setDeviceKey,
    getMe,
    updateMe,
    getPreferences,
    setPreferences,
    getSubscription,
    syncPush,
    syncPull,
    syncVersions,
    syncStatus,
    createBackup,
    listBackups,
    restoreBackup,
    sendFriendRequest,
    listFriendRequests,
    respondToFriendRequest,
    listFriends,
    createWorkspace,
    listWorkspaces,
    getWorkspace,
    updateWorkspace,
    deleteWorkspace,
    listWorkspaceMembers,
    updateMemberRole,
    removeMember,
    createInvitation,
    listInvitations,
    acceptInvitation,
    declineInvitation,
    createOrganization,
    addOrganizationMember,
    removeOrganizationMember,
    listNotifications,
    markNotificationRead,
    markAllNotificationsRead,
};
