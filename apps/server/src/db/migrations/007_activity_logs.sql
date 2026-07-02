-- Audit log for security-relevant account/collaboration/sync events. Written
-- best-effort (a logging failure never blocks the action being logged) via
-- apps/server/src/services/activityLog.service.js.

CREATE TABLE IF NOT EXISTS activity_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action          TEXT NOT NULL, -- e.g. 'login', 'device_revoked', 'password_reset', 'invite_sent'
    resource_type   TEXT,
    resource_id     TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created ON activity_logs(user_id, created_at DESC);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_logs_self ON activity_logs
    FOR SELECT USING (user_id = auth.uid());
