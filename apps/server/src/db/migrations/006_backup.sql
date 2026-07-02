-- Cloud backup. A backup is a cheap, named restore point — a pointer at the
-- user's sync cursor at a point in time — not a second copy of ciphertext.
-- Restoring replays sync_blob_versions at-or-before the recorded cursor.
-- See apps/server/src/services/backup.service.js.

CREATE TABLE IF NOT EXISTS backup_metadata (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id       UUID REFERENCES devices(id) ON DELETE SET NULL,
    kind            TEXT NOT NULL DEFAULT 'manual', -- manual | automatic
    label           TEXT,
    sync_cursor     TIMESTAMPTZ NOT NULL,
    resource_count  INTEGER NOT NULL DEFAULT 0,
    total_bytes     BIGINT NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'complete', -- pending | complete | failed | restored
    restored_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backup_metadata_user_created ON backup_metadata(user_id, created_at DESC);

ALTER TABLE backup_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY backup_metadata_self ON backup_metadata
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
