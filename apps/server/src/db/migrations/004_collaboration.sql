-- Friends, shared workspaces (notebooks/projects), invitations, and orgs.
-- `notebook_permissions.wrapped_content_key` holds the workspace's symmetric
-- content key, encrypted client-side to that member's device public key
-- before it is ever sent here — the server stores it but cannot unwrap it.

CREATE TABLE IF NOT EXISTS friend_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    addressee_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | declined | blocked
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (requester_id, addressee_id)
);

CREATE TABLE IF NOT EXISTS organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_members (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role            TEXT NOT NULL DEFAULT 'member', -- admin | member
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS workspaces (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    name            TEXT NOT NULL,
    kind            TEXT NOT NULL DEFAULT 'notebook', -- notebook | project
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-member role + wrapped content key for a workspace ("notebook").
CREATE TABLE IF NOT EXISTS notebook_permissions (
    workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role                TEXT NOT NULL DEFAULT 'viewer', -- owner | editor | viewer
    wrapped_content_key TEXT,
    joined_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS collaboration_invites (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    inviter_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invitee_email   TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'viewer',
    token_hash      TEXT NOT NULL UNIQUE,
    status          TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | declined | expired | revoked
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_addressee ON friend_requests(addressee_id, status);
CREATE INDEX IF NOT EXISTS idx_notebook_permissions_user ON notebook_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_invites_workspace ON collaboration_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_invites_email ON collaboration_invites(invitee_email);

ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY friend_requests_participant ON friend_requests
    FOR ALL USING (requester_id = auth.uid() OR addressee_id = auth.uid());

CREATE POLICY organizations_member ON organizations
    FOR ALL USING (
        owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM organization_members m WHERE m.organization_id = organizations.id AND m.user_id = auth.uid())
    );

CREATE POLICY organization_members_self_org ON organization_members
    FOR ALL USING (
        EXISTS (SELECT 1 FROM organization_members m WHERE m.organization_id = organization_members.organization_id AND m.user_id = auth.uid())
    );

CREATE POLICY workspaces_member ON workspaces
    FOR ALL USING (
        owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM notebook_permissions p WHERE p.workspace_id = workspaces.id AND p.user_id = auth.uid())
    );

CREATE POLICY notebook_permissions_member ON notebook_permissions
    FOR ALL USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM notebook_permissions p WHERE p.workspace_id = notebook_permissions.workspace_id AND p.user_id = auth.uid())
    );

CREATE POLICY collaboration_invites_workspace_member ON collaboration_invites
    FOR ALL USING (
        inviter_id = auth.uid()
        OR EXISTS (SELECT 1 FROM notebook_permissions p WHERE p.workspace_id = collaboration_invites.workspace_id AND p.user_id = auth.uid())
    );
