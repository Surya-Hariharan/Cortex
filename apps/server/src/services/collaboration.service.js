const collaborationRepo = require('../repositories/collaboration.repository');
const usersRepo = require('../repositories/users.repository');
const notificationsRepo = require('../repositories/notifications.repository');
const { generateOpaqueToken, hashToken } = require('../utils/tokens');
const emailService = require('./email.service');
const { ApiError } = require('../middleware/errorHandler');

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ── Friends ──────────────────────────────────────────────────────────────

async function sendFriendRequest(requesterId, addresseeEmail) {
    const addressee = await usersRepo.findByEmail(addresseeEmail);
    if (!addressee) throw new ApiError(404, 'not_found', 'No user with that email.');
    if (addressee.id === requesterId) throw new ApiError(400, 'invalid_request', "You can't friend yourself.");

    const request = await collaborationRepo.createFriendRequest(requesterId, addressee.id);
    await notificationsRepo.create(addressee.id, 'friend_request', { requesterId, requestId: request.id });
    return request;
}

async function listIncomingFriendRequests(userId) {
    return collaborationRepo.listFriendRequests(userId, 'pending');
}

async function respondToFriendRequest(requestId, userId, accept) {
    const status = accept ? 'accepted' : 'declined';
    const updated = await collaborationRepo.respondToFriendRequest(requestId, userId, status);
    if (!updated) throw new ApiError(404, 'not_found', 'Friend request not found.');
    if (accept) {
        await notificationsRepo.create(updated.requester_id, 'friend_request_accepted', { by: userId });
    }
    return updated;
}

async function listFriends(userId) {
    return collaborationRepo.listFriends(userId);
}

// ── Workspaces ───────────────────────────────────────────────────────────

async function createWorkspace(ownerId, { name, kind, organizationId }) {
    return collaborationRepo.createWorkspace({ ownerId, name, kind, organizationId });
}

async function listWorkspaces(userId) {
    return collaborationRepo.listWorkspacesForUser(userId);
}

async function getWorkspace(workspaceId) {
    const workspace = await collaborationRepo.findWorkspaceById(workspaceId);
    if (!workspace) throw new ApiError(404, 'not_found', 'Workspace not found.');
    return workspace;
}

async function updateWorkspace(workspaceId, patch) {
    return collaborationRepo.updateWorkspace(workspaceId, patch);
}

async function deleteWorkspace(workspaceId) {
    await collaborationRepo.deleteWorkspace(workspaceId);
    return { success: true };
}

async function listMembers(workspaceId) {
    return collaborationRepo.listMembers(workspaceId);
}

async function updateMemberRole(workspaceId, targetUserId, role) {
    const updated = await collaborationRepo.updateMemberRole(workspaceId, targetUserId, role);
    if (!updated) throw new ApiError(404, 'not_found', 'Member not found in this workspace.');
    return updated;
}

async function removeMember(workspaceId, targetUserId) {
    await collaborationRepo.removeMember(workspaceId, targetUserId);
    return { success: true };
}

// ── Invitations ──────────────────────────────────────────────────────────

async function createInvitation(workspaceId, inviterId, { inviteeEmail, role }) {
    const workspace = await getWorkspace(workspaceId);
    const token = generateOpaqueToken();
    const invitation = await collaborationRepo.createInvitation({
        workspaceId,
        inviterId,
        inviteeEmail,
        role,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    });

    const invitee = await usersRepo.findByEmail(inviteeEmail);
    if (invitee) {
        await notificationsRepo.create(invitee.id, 'workspace_invite', { workspaceId, invitationId: invitation.id });
    }
    // The invite link/token is only ever emailed — never returned in the
    // API response — so a compromised "list invitations" endpoint can't
    // leak usable invite tokens.
    await emailService.sendWorkspaceInvitationEmail(inviteeEmail, workspace.name, `cortex://invite/${token}`);

    return { id: invitation.id, inviteeEmail, role, status: invitation.status, expiresAt: invitation.expires_at };
}

async function listInvitations(workspaceId) {
    return collaborationRepo.listInvitationsForWorkspace(workspaceId);
}

async function acceptInvitation(token, userId, wrappedContentKey) {
    const record = await collaborationRepo.findInvitationByTokenHash(hashToken(token));
    if (!record || record.status !== 'pending' || new Date(record.expires_at) < new Date()) {
        throw new ApiError(400, 'invalid_invitation', 'This invitation is invalid or has expired.');
    }
    await collaborationRepo.addMember(record.workspace_id, userId, record.role, wrappedContentKey);
    await collaborationRepo.setInvitationStatus(record.id, 'accepted');
    return { workspaceId: record.workspace_id, role: record.role };
}

async function declineInvitation(token) {
    const record = await collaborationRepo.findInvitationByTokenHash(hashToken(token));
    if (!record) throw new ApiError(404, 'not_found', 'Invitation not found.');
    await collaborationRepo.setInvitationStatus(record.id, 'declined');
    return { success: true };
}

// ── Organizations ────────────────────────────────────────────────────────

async function createOrganization(ownerId, name) {
    return collaborationRepo.createOrganization({ name, ownerId });
}

async function addOrganizationMember(orgId, userId, role) {
    return collaborationRepo.addOrganizationMember(orgId, userId, role);
}

async function removeOrganizationMember(orgId, userId) {
    await collaborationRepo.removeOrganizationMember(orgId, userId);
    return { success: true };
}

module.exports = {
    sendFriendRequest,
    listIncomingFriendRequests,
    respondToFriendRequest,
    listFriends,
    createWorkspace,
    listWorkspaces,
    getWorkspace,
    updateWorkspace,
    deleteWorkspace,
    listMembers,
    updateMemberRole,
    removeMember,
    createInvitation,
    listInvitations,
    acceptInvitation,
    declineInvitation,
    createOrganization,
    addOrganizationMember,
    removeOrganizationMember,
};
