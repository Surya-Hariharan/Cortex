const { query, withTransaction } = require('../db/pool');

// ── Friends ──────────────────────────────────────────────────────────────

async function createFriendRequest(requesterId, addresseeId) {
    const { rows } = await query(
        `INSERT INTO friend_requests (requester_id, addressee_id) VALUES ($1, $2)
         ON CONFLICT (requester_id, addressee_id) DO UPDATE SET updated_at = now()
         RETURNING *`,
        [requesterId, addresseeId]
    );
    return rows[0];
}

async function listFriendRequests(userId, status = 'pending') {
    const { rows } = await query(
        `SELECT * FROM friend_requests WHERE addressee_id = $1 AND status = $2 ORDER BY created_at DESC`,
        [userId, status]
    );
    return rows;
}

async function respondToFriendRequest(requestId, addresseeId, status) {
    const { rows } = await query(
        `UPDATE friend_requests SET status = $1, updated_at = now()
         WHERE id = $2 AND addressee_id = $3 RETURNING *`,
        [status, requestId, addresseeId]
    );
    return rows[0] || null;
}

async function listFriends(userId) {
    const { rows } = await query(
        `SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END AS friend_id, created_at
         FROM friend_requests
         WHERE (requester_id = $1 OR addressee_id = $1) AND status = 'accepted'`,
        [userId]
    );
    return rows;
}

// ── Workspaces ───────────────────────────────────────────────────────────

async function createWorkspace({ ownerId, name, kind, organizationId = null }) {
    return withTransaction(async (client) => {
        const { rows } = await client.query(
            `INSERT INTO workspaces (owner_id, name, kind, organization_id) VALUES ($1, $2, $3, $4) RETURNING *`,
            [ownerId, name, kind, organizationId]
        );
        const workspace = rows[0];
        await client.query(
            `INSERT INTO notebook_permissions (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`,
            [workspace.id, ownerId]
        );
        return workspace;
    });
}

async function findWorkspaceById(id) {
    const { rows } = await query('SELECT * FROM workspaces WHERE id = $1', [id]);
    return rows[0] || null;
}

async function listWorkspacesForUser(userId) {
    const { rows } = await query(
        `SELECT w.*, p.role FROM workspaces w
         JOIN notebook_permissions p ON p.workspace_id = w.id
         WHERE p.user_id = $1 ORDER BY w.updated_at DESC`,
        [userId]
    );
    return rows;
}

async function updateWorkspace(id, { name }) {
    const { rows } = await query(
        `UPDATE workspaces SET name = COALESCE($2, name), updated_at = now() WHERE id = $1 RETURNING *`,
        [id, name ?? null]
    );
    return rows[0];
}

async function deleteWorkspace(id) {
    await query('DELETE FROM workspaces WHERE id = $1', [id]);
}

async function getMemberRole(workspaceId, userId) {
    const { rows } = await query(
        'SELECT role FROM notebook_permissions WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, userId]
    );
    return rows[0]?.role || null;
}

async function listMembers(workspaceId) {
    const { rows } = await query(
        `SELECT p.user_id, p.role, p.joined_at, u.email, u.raw_user_meta_data->>'full_name' AS full_name
         FROM notebook_permissions p JOIN auth.users u ON u.id = p.user_id
         WHERE p.workspace_id = $1 ORDER BY p.joined_at ASC`,
        [workspaceId]
    );
    return rows;
}

async function addMember(workspaceId, userId, role, wrappedContentKey) {
    const { rows } = await query(
        `INSERT INTO notebook_permissions (workspace_id, user_id, role, wrapped_content_key)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role
         RETURNING *`,
        [workspaceId, userId, role, wrappedContentKey ?? null]
    );
    return rows[0];
}

async function updateMemberRole(workspaceId, userId, role) {
    const { rows } = await query(
        `UPDATE notebook_permissions SET role = $3 WHERE workspace_id = $1 AND user_id = $2 RETURNING *`,
        [workspaceId, userId, role]
    );
    return rows[0] || null;
}

async function removeMember(workspaceId, userId) {
    await query('DELETE FROM notebook_permissions WHERE workspace_id = $1 AND user_id = $2', [workspaceId, userId]);
}

// ── Invitations ──────────────────────────────────────────────────────────

async function createInvitation({ workspaceId, inviterId, inviteeEmail, role, tokenHash, expiresAt }) {
    const { rows } = await query(
        `INSERT INTO collaboration_invites (workspace_id, inviter_id, invitee_email, role, token_hash, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [workspaceId, inviterId, inviteeEmail, role, tokenHash, expiresAt]
    );
    return rows[0];
}

async function findInvitationByTokenHash(tokenHash) {
    const { rows } = await query('SELECT * FROM collaboration_invites WHERE token_hash = $1', [tokenHash]);
    return rows[0] || null;
}

async function listInvitationsForWorkspace(workspaceId) {
    const { rows } = await query(
        `SELECT id, invitee_email, role, status, expires_at, created_at
         FROM collaboration_invites WHERE workspace_id = $1 ORDER BY created_at DESC`,
        [workspaceId]
    );
    return rows;
}

async function setInvitationStatus(id, status) {
    const { rows } = await query(
        'UPDATE collaboration_invites SET status = $2 WHERE id = $1 RETURNING *',
        [id, status]
    );
    return rows[0] || null;
}

// ── Organizations ────────────────────────────────────────────────────────

async function createOrganization({ name, ownerId }) {
    return withTransaction(async (client) => {
        const { rows } = await client.query(
            'INSERT INTO organizations (name, owner_id) VALUES ($1, $2) RETURNING *',
            [name, ownerId]
        );
        const org = rows[0];
        await client.query(
            `INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, 'admin')`,
            [org.id, ownerId]
        );
        return org;
    });
}

async function findOrganizationById(id) {
    const { rows } = await query('SELECT * FROM organizations WHERE id = $1', [id]);
    return rows[0] || null;
}

async function addOrganizationMember(orgId, userId, role = 'member') {
    const { rows } = await query(
        `INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, $3)
         ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role RETURNING *`,
        [orgId, userId, role]
    );
    return rows[0];
}

async function removeOrganizationMember(orgId, userId) {
    await query('DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2', [orgId, userId]);
}

async function getOrganizationMemberRole(orgId, userId) {
    const { rows } = await query(
        'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
        [orgId, userId]
    );
    return rows[0]?.role || null;
}

module.exports = {
    createFriendRequest,
    listFriendRequests,
    respondToFriendRequest,
    listFriends,
    createWorkspace,
    findWorkspaceById,
    listWorkspacesForUser,
    updateWorkspace,
    deleteWorkspace,
    getMemberRole,
    listMembers,
    addMember,
    updateMemberRole,
    removeMember,
    createInvitation,
    findInvitationByTokenHash,
    listInvitationsForWorkspace,
    setInvitationStatus,
    createOrganization,
    findOrganizationById,
    addOrganizationMember,
    removeOrganizationMember,
    getOrganizationMemberRole,
};
