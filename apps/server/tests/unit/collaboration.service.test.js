import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// require()'d rather than import'd — see the comment in auth.service.test.js
// for why this matters for vi.spyOn() to actually take effect.
const collaborationRepo = require('../../src/repositories/collaboration.repository.js');
const usersRepo = require('../../src/repositories/users.repository.js');
const notificationsRepo = require('../../src/repositories/notifications.repository.js');
const collaborationService = require('../../src/services/collaboration.service.js');

function spyAll(mod, methods) {
    const spies = {};
    for (const name of methods) {
        spies[name] = vi.spyOn(mod, name).mockResolvedValue(undefined);
    }
    return spies;
}

describe('collaboration.service', () => {
    let collaboration;
    let users;
    let notifications;

    beforeEach(() => {
        collaboration = spyAll(collaborationRepo, [
            'createFriendRequest', 'respondToFriendRequest', 'updateMemberRole',
            'findInvitationByTokenHash', 'addMember', 'setInvitationStatus',
        ]);
        users = spyAll(usersRepo, ['findByEmail']);
        notifications = spyAll(notificationsRepo, ['create']);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('sendFriendRequest', () => {
        it('rejects when the addressee does not exist', async () => {
            users.findByEmail.mockResolvedValue(null);
            await expect(collaborationService.sendFriendRequest('user-1', 'ghost@b.com')).rejects.toMatchObject({ status: 404 });
        });

        it('rejects friending yourself', async () => {
            users.findByEmail.mockResolvedValue({ id: 'user-1' });
            await expect(collaborationService.sendFriendRequest('user-1', 'me@b.com')).rejects.toMatchObject({ status: 400 });
        });

        it('creates the request and notifies the addressee', async () => {
            users.findByEmail.mockResolvedValue({ id: 'user-2' });
            collaboration.createFriendRequest.mockResolvedValue({ id: 'req-1' });

            await collaborationService.sendFriendRequest('user-1', 'friend@b.com');

            expect(notifications.create).toHaveBeenCalledWith('user-2', 'friend_request', expect.objectContaining({ requesterId: 'user-1' }));
        });
    });

    describe('respondToFriendRequest', () => {
        it('rejects when the request does not belong to this user', async () => {
            collaboration.respondToFriendRequest.mockResolvedValue(null);
            await expect(collaborationService.respondToFriendRequest('req-1', 'user-2', true)).rejects.toMatchObject({ status: 404 });
        });

        it('notifies the requester on acceptance', async () => {
            collaboration.respondToFriendRequest.mockResolvedValue({ requester_id: 'user-1' });
            await collaborationService.respondToFriendRequest('req-1', 'user-2', true);
            expect(notifications.create).toHaveBeenCalledWith('user-1', 'friend_request_accepted', expect.any(Object));
        });
    });

    describe('updateMemberRole', () => {
        it('rejects when the member is not part of the workspace', async () => {
            collaboration.updateMemberRole.mockResolvedValue(null);
            await expect(collaborationService.updateMemberRole('ws-1', 'user-9', 'editor')).rejects.toMatchObject({ status: 404 });
        });
    });

    describe('invitations', () => {
        it('rejects accepting an invitation with a token that does not resolve', async () => {
            collaboration.findInvitationByTokenHash.mockResolvedValue(null);
            await expect(collaborationService.acceptInvitation('bad-token', 'user-2', 'wrapped-key')).rejects.toMatchObject({ status: 400, code: 'invalid_invitation' });
        });

        it('rejects accepting an expired invitation', async () => {
            collaboration.findInvitationByTokenHash.mockResolvedValue({
                id: 'inv-1', status: 'pending', workspace_id: 'ws-1', role: 'editor', expires_at: new Date(Date.now() - 1000).toISOString(),
            });
            await expect(collaborationService.acceptInvitation('expired-token', 'user-2', 'wrapped-key')).rejects.toMatchObject({ status: 400, code: 'invalid_invitation' });
        });

        it('adds the member with their wrapped content key on success', async () => {
            collaboration.findInvitationByTokenHash.mockResolvedValue({
                id: 'inv-1', status: 'pending', workspace_id: 'ws-1', role: 'editor', expires_at: new Date(Date.now() + 100000).toISOString(),
            });

            const result = await collaborationService.acceptInvitation('good-token', 'user-2', 'wrapped-key-blob');

            expect(collaboration.addMember).toHaveBeenCalledWith('ws-1', 'user-2', 'editor', 'wrapped-key-blob');
            expect(collaboration.setInvitationStatus).toHaveBeenCalledWith('inv-1', 'accepted');
            expect(result).toEqual({ workspaceId: 'ws-1', role: 'editor' });
        });
    });
});
