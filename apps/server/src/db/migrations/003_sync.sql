-- Zero-knowledge sync storage. The server stores opaque ciphertext + the
-- metadata needed for incremental sync and conflict detection. It never
-- stores (and cannot derive) plaintext note/document content.

CREATE TABLE IF NOT EXISTS sync_blobs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    resource_type       TEXT NOT NULL,       -- e.g. 'note', 'page', 'task', 'whiteboard'
    resource_id         TEXT NOT NULL,       -- client-generated id, stable across devices
    ciphertext          BYTEA NOT NULL,
    nonce               BYTEA NOT NULL,
    server_version      INTEGER NOT NULL DEFAULT 1,
    updated_by_device_id UUID REFERENCES devices(id),
    deleted             BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, resource_type, resource_id)
);

-- Append-only history, written every time sync_blobs is overwritten.
-- Powers "version history" without needing the server to understand content,
-- and is what cloud backups replay from (see 004_backup.sql).
CREATE TABLE IF NOT EXISTS sync_blob_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blob_id         UUID NOT NULL REFERENCES sync_blobs(id) ON DELETE CASCADE,
    server_version  INTEGER NOT NULL,
    ciphertext      BYTEA NOT NULL,
    nonce           BYTEA NOT NULL,
    updated_by_device_id UUID REFERENCES devices(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-device, per-resource-type sync cursor/status bookkeeping. sync_blobs
-- above is content; this is "how far along is each device's sync."
CREATE TABLE IF NOT EXISTS sync_metadata (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    resource_type   TEXT NOT NULL,
    last_cursor     TIMESTAMPTZ,
    last_synced_at  TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'idle', -- idle | syncing | error
    last_error      TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (device_id, resource_type)
);

-- Monotonic per-user cursor for incremental pull (GET /sync/pull?since=).
CREATE INDEX IF NOT EXISTS idx_sync_blobs_user_updated ON sync_blobs(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_sync_blob_versions_blob_id ON sync_blob_versions(blob_id);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_user ON sync_metadata(user_id);

ALTER TABLE sync_blobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_blob_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY sync_blobs_self ON sync_blobs
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY sync_blob_versions_self ON sync_blob_versions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM sync_blobs b WHERE b.id = sync_blob_versions.blob_id AND b.user_id = auth.uid())
    );

CREATE POLICY sync_metadata_self ON sync_metadata
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
