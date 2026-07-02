const collaborationRepo = require('../repositories/collaboration.repository');

const RANK = { viewer: 0, editor: 1, owner: 2 };

// Usage: requireWorkspaceRole('editor') — requires req.user's role in
// req.params.workspaceId to be at least `minRole`.
function requireWorkspaceRole(minRole) {
    return async (req, res, next) => {
        try {
            const workspaceId = req.params.workspaceId || req.params.id;
            const role = await collaborationRepo.getMemberRole(workspaceId, req.user.id);
            if (!role) {
                return res.status(404).json({ error: 'not_found', detail: 'Workspace not found.' });
            }
            if (RANK[role] < RANK[minRole]) {
                return res.status(403).json({ error: 'forbidden', detail: `Requires ${minRole} role or higher.` });
            }
            req.workspaceRole = role;
            next();
        } catch (err) {
            next(err);
        }
    };
}

module.exports = { requireWorkspaceRole };
