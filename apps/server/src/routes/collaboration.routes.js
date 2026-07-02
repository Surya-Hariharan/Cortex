const { Router } = require('express');
const controller = require('../controllers/collaboration.controller');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const { requireWorkspaceRole } = require('../middleware/requireWorkspaceRole');
const schemas = require('../models/collaboration.schemas');

const router = Router();

// `authenticate` is applied per-route (not via a blanket router.use) because
// this router is mounted at the bare '/api/v1' root alongside other domains'
// routers — a catch-all router.use(authenticate) here would intercept every
// unmatched path under /api/v1 and return 401 instead of letting it fall
// through to the global 404 handler.

// Friends
router.post('/friends/requests', authenticate, validate(schemas.createFriendRequestSchema), controller.sendFriendRequest);
router.get('/friends/requests', authenticate, controller.listFriendRequests);
router.post('/friends/requests/:id/respond', authenticate, validate(schemas.respondFriendRequestSchema), controller.respondToFriendRequest);
router.get('/friends', authenticate, controller.listFriends);

// Workspaces
router.post('/workspaces', authenticate, validate(schemas.createWorkspaceSchema), controller.createWorkspace);
router.get('/workspaces', authenticate, controller.listWorkspaces);
router.get('/workspaces/:id', authenticate, requireWorkspaceRole('viewer'), controller.getWorkspace);
router.patch('/workspaces/:id', authenticate, requireWorkspaceRole('owner'), validate(schemas.updateWorkspaceSchema), controller.updateWorkspace);
router.delete('/workspaces/:id', authenticate, requireWorkspaceRole('owner'), controller.deleteWorkspace);

router.get('/workspaces/:id/members', authenticate, requireWorkspaceRole('viewer'), controller.listMembers);
router.patch('/workspaces/:id/members/:userId', authenticate, requireWorkspaceRole('owner'), validate(schemas.updateMemberRoleSchema), controller.updateMemberRole);
router.delete('/workspaces/:id/members/:userId', authenticate, requireWorkspaceRole('owner'), controller.removeMember);

router.post('/workspaces/:id/invitations', authenticate, requireWorkspaceRole('editor'), validate(schemas.createInvitationSchema), controller.createInvitation);
router.get('/workspaces/:id/invitations', authenticate, requireWorkspaceRole('editor'), controller.listInvitations);

// Invitations are accepted/declined by token, not by workspace membership
// (the invitee isn't a member yet), so these live outside the :id-scoped block.
router.post('/invitations/:token/accept', authenticate, controller.acceptInvitation);
router.post('/invitations/:token/decline', authenticate, controller.declineInvitation);

// Organizations
router.post('/organizations', authenticate, validate(schemas.createOrganizationSchema), controller.createOrganization);
router.post('/organizations/:id/members', authenticate, validate(schemas.addOrganizationMemberSchema), controller.addOrganizationMember);
router.delete('/organizations/:id/members/:userId', authenticate, controller.removeOrganizationMember);

module.exports = router;
