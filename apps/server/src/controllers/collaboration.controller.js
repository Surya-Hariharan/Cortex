const collaborationService = require('../services/collaboration.service');
const { asyncHandler } = require('../utils/asyncHandler');

// ── Friends ──────────────────────────────────────────────────────────────

const sendFriendRequest = asyncHandler(async (req, res) => {
    const result = await collaborationService.sendFriendRequest(req.user.id, req.body.addresseeEmail);
    res.status(201).json(result);
});

const listFriendRequests = asyncHandler(async (req, res) => {
    res.status(200).json({ requests: await collaborationService.listIncomingFriendRequests(req.user.id) });
});

const respondToFriendRequest = asyncHandler(async (req, res) => {
    const result = await collaborationService.respondToFriendRequest(req.params.id, req.user.id, req.body.accept);
    res.status(200).json(result);
});

const listFriends = asyncHandler(async (req, res) => {
    res.status(200).json({ friends: await collaborationService.listFriends(req.user.id) });
});

// ── Workspaces ───────────────────────────────────────────────────────────

const createWorkspace = asyncHandler(async (req, res) => {
    const workspace = await collaborationService.createWorkspace(req.user.id, req.body);
    res.status(201).json(workspace);
});

const listWorkspaces = asyncHandler(async (req, res) => {
    res.status(200).json({ workspaces: await collaborationService.listWorkspaces(req.user.id) });
});

const getWorkspace = asyncHandler(async (req, res) => {
    res.status(200).json(await collaborationService.getWorkspace(req.params.id));
});

const updateWorkspace = asyncHandler(async (req, res) => {
    res.status(200).json(await collaborationService.updateWorkspace(req.params.id, req.body));
});

const deleteWorkspace = asyncHandler(async (req, res) => {
    res.status(200).json(await collaborationService.deleteWorkspace(req.params.id));
});

const listMembers = asyncHandler(async (req, res) => {
    res.status(200).json({ members: await collaborationService.listMembers(req.params.id) });
});

const updateMemberRole = asyncHandler(async (req, res) => {
    res.status(200).json(await collaborationService.updateMemberRole(req.params.id, req.params.userId, req.body.role));
});

const removeMember = asyncHandler(async (req, res) => {
    res.status(200).json(await collaborationService.removeMember(req.params.id, req.params.userId));
});

// ── Invitations ──────────────────────────────────────────────────────────

const createInvitation = asyncHandler(async (req, res) => {
    const invitation = await collaborationService.createInvitation(req.params.id, req.user.id, req.body);
    res.status(201).json(invitation);
});

const listInvitations = asyncHandler(async (req, res) => {
    res.status(200).json({ invitations: await collaborationService.listInvitations(req.params.id) });
});

const acceptInvitation = asyncHandler(async (req, res) => {
    const result = await collaborationService.acceptInvitation(req.params.token, req.user.id, req.body.wrappedContentKey);
    res.status(200).json(result);
});

const declineInvitation = asyncHandler(async (req, res) => {
    res.status(200).json(await collaborationService.declineInvitation(req.params.token));
});

// ── Organizations ────────────────────────────────────────────────────────

const createOrganization = asyncHandler(async (req, res) => {
    const org = await collaborationService.createOrganization(req.user.id, req.body.name);
    res.status(201).json(org);
});

const addOrganizationMember = asyncHandler(async (req, res) => {
    res.status(201).json(await collaborationService.addOrganizationMember(req.params.id, req.body.userId, req.body.role));
});

const removeOrganizationMember = asyncHandler(async (req, res) => {
    res.status(200).json(await collaborationService.removeOrganizationMember(req.params.id, req.params.userId));
});

module.exports = {
    sendFriendRequest,
    listFriendRequests,
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
