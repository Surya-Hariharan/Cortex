-- ============================================================
-- Cortex — Row Level Security Policies  (Supabase / PostgreSQL)
-- 003_rls_policies.sql
--
-- Run AFTER 001_initial_schema.sql.
-- Every user-owned table: only the owning user may read/write
-- their own rows.  Operational tables (app_settings,
-- background_jobs) are service_role-only — no RLS policy means
-- every JWT-authenticated request is blocked.
-- ============================================================

SET search_path = public, pg_catalog;

-- ── profiles ─────────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE  ROW LEVEL SECURITY;

-- The trigger handle_new_auth_user runs as SECURITY DEFINER and bypasses RLS.
CREATE POLICY "profiles: owner can read"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "profiles: owner can update"
    ON profiles FOR UPDATE
    USING     (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Direct INSERT is only allowed when the row belongs to the caller
-- (the trigger does this automatically, so manual inserts won't conflict)
CREATE POLICY "profiles: owner can insert"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Hard-delete is intentionally disallowed for normal users;
-- deletion flows through the auth.users CASCADE.

-- ── devices ──────────────────────────────────────────────────────────────────
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices FORCE  ROW LEVEL SECURITY;

CREATE POLICY "devices: owner full access"
    ON devices FOR ALL
    USING     (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ── projects ─────────────────────────────────────────────────────────────────
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE  ROW LEVEL SECURITY;

CREATE POLICY "projects: owner full access"
    ON projects FOR ALL
    USING     (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ── documents ────────────────────────────────────────────────────────────────
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE  ROW LEVEL SECURITY;

CREATE POLICY "documents: owner full access"
    ON documents FOR ALL
    USING     (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ── document_chunks ──────────────────────────────────────────────────────────
-- Ownership is transitive through the parent document.
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks FORCE  ROW LEVEL SECURITY;

CREATE POLICY "doc_chunks: owner full access via document"
    ON document_chunks FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM documents d
            WHERE  d.id      = document_chunks.document_id
               AND d.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM documents d
            WHERE  d.id      = document_chunks.document_id
               AND d.user_id = auth.uid()
        )
    );

-- ── notes ─────────────────────────────────────────────────────────────────────
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes FORCE  ROW LEVEL SECURITY;

CREATE POLICY "notes: owner full access"
    ON notes FOR ALL
    USING     (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ── tasks ─────────────────────────────────────────────────────────────────────
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE  ROW LEVEL SECURITY;

CREATE POLICY "tasks: owner full access"
    ON tasks FOR ALL
    USING     (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ── chats ─────────────────────────────────────────────────────────────────────
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats FORCE  ROW LEVEL SECURITY;

CREATE POLICY "chats: owner full access"
    ON chats FOR ALL
    USING     (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ── messages ─────────────────────────────────────────────────────────────────
-- Ownership is transitive through the parent chat.
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE  ROW LEVEL SECURITY;

CREATE POLICY "messages: owner full access via chat"
    ON messages FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM chats c
            WHERE  c.id      = messages.chat_id
               AND c.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chats c
            WHERE  c.id      = messages.chat_id
               AND c.user_id = auth.uid()
        )
    );

-- ── sync_events ───────────────────────────────────────────────────────────────
-- Scoped through the devices table (device_id → user_id).
ALTER TABLE sync_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_events FORCE  ROW LEVEL SECURITY;

CREATE POLICY "sync_events: owner full access via device"
    ON sync_events FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM devices d
            WHERE  d.id      = sync_events.device_id
               AND d.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM devices d
            WHERE  d.id      = sync_events.device_id
               AND d.user_id = auth.uid()
        )
    );

-- ── sync_queue ────────────────────────────────────────────────────────────────
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue FORCE  ROW LEVEL SECURITY;

CREATE POLICY "sync_queue: owner full access via event→device"
    ON sync_queue FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM   sync_events se
            JOIN   devices     d  ON d.id = se.device_id
            WHERE  se.id      = sync_queue.event_id
               AND d.user_id  = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM   sync_events se
            JOIN   devices     d  ON d.id = se.device_id
            WHERE  se.id      = sync_queue.event_id
               AND d.user_id  = auth.uid()
        )
    );

-- ── audit_logs ───────────────────────────────────────────────────────────────
-- Users may only READ their own entries.
-- Inserts come exclusively from the audit trigger (SECURITY DEFINER).
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE  ROW LEVEL SECURITY;

CREATE POLICY "audit_logs: owner can read own entries"
    ON audit_logs FOR SELECT
    USING (actor_id = auth.uid());

-- ── Operational tables — service_role only (no user policies) ────────────────
-- No CREATE POLICY → every JWT request is denied; only service_role bypasses RLS.
ALTER TABLE app_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings   FORCE  ROW LEVEL SECURITY;

ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE background_jobs FORCE  ROW LEVEL SECURITY;
