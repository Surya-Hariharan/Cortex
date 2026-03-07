-- ============================================================
-- Cortex — Initial Schema  (Supabase / PostgreSQL)
-- Run in: Supabase dashboard → SQL Editor  (or psql)
--
-- Prerequisites: none (extensions in file 002 add pgvector)
-- Idempotent: every statement uses IF NOT EXISTS / OR REPLACE.
-- ============================================================

-- Prevent accidental schema pollution
SET search_path = public, pg_catalog;

-- ── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- gen_random_uuid(), crypt()

-- ── Shared updated_at trigger function ───────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- PROFILES  (public extension of auth.users)
-- Supabase handles sign-up / sign-in in auth.users.
-- This table holds the app-level fields for each user.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profiles (
    id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT        NOT NULL DEFAULT ''
                                 CHECK (char_length(display_name) <= 200),
    email        TEXT        UNIQUE
                                 CHECK (email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'),
    avatar_url   TEXT        CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 2048),
    stream       TEXT        CHECK (stream IS NULL OR char_length(stream) <= 200),
    plan         TEXT        NOT NULL DEFAULT 'free'
                                 CHECK (plan IN ('free','pro','enterprise')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ
);

COMMENT ON TABLE profiles IS 'App-level user profiles linked 1:1 to auth.users';

-- Auto-create a profile row when Supabase creates a new auth user
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'display_name',
            split_part(COALESCE(NEW.email,''), '@', 1)
        )
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Devices ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS devices (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name       TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
    platform   TEXT        CHECK (platform IS NULL OR char_length(platform) <= 50),
    arch       TEXT        CHECK (arch IS NULL OR char_length(arch) <= 50),
    peer_id    TEXT        UNIQUE CHECK (peer_id IS NULL OR char_length(peer_id) <= 200),
    last_seen  TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Projects ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title       TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
    description TEXT        CHECK (description IS NULL OR char_length(description) <= 5000),
    color       TEXT        NOT NULL DEFAULT '#6366f1'
                                CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    is_shared   BOOLEAN     NOT NULL DEFAULT FALSE,
    version     INTEGER     NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE TRIGGER projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Documents ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    project_id  UUID        REFERENCES projects(id) ON DELETE SET NULL,
    filename    TEXT        NOT NULL CHECK (char_length(filename) BETWEEN 1 AND 500),
    file_path   TEXT        NOT NULL  CHECK (char_length(file_path) <= 2048),
    file_size   BIGINT      CHECK (file_size IS NULL OR (file_size >= 0 AND file_size <= 524288000)),
    mime_type   TEXT        NOT NULL DEFAULT 'application/pdf'
                                CHECK (mime_type IN (
                                    'application/pdf',
                                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                    'application/msword',
                                    'text/plain', 'text/markdown',
                                    'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg',
                                    'video/mp4', 'video/webm'
                                )),
    title       TEXT        CHECK (title IS NULL OR char_length(title) <= 500),
    subject     TEXT        CHECK (subject IS NULL OR char_length(subject) <= 250),
    page_count  INTEGER     CHECK (page_count IS NULL OR page_count >= 0),
    word_count  INTEGER     CHECK (word_count IS NULL OR word_count >= 0),
    status      TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','processing','ready','error','deleted')),
    error_msg   TEXT        CHECK (error_msg IS NULL OR char_length(error_msg) <= 2000),
    ocr_applied BOOLEAN     NOT NULL DEFAULT FALSE,
    is_shared   BOOLEAN     NOT NULL DEFAULT FALSE,
    version     INTEGER     NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE TRIGGER documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Document Chunks ──────────────────────────────────────────────────────────
-- Embedding vector column is added in 002_embeddings.sql after pgvector loads.
CREATE TABLE IF NOT EXISTS document_chunks (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER     NOT NULL CHECK (chunk_index >= 0),
    content     TEXT        NOT NULL CHECK (char_length(content) <= 32768),
    token_count INTEGER     CHECK (token_count IS NULL OR (token_count >= 0 AND token_count <= 4096)),
    page_number INTEGER     CHECK (page_number IS NULL OR page_number >= 0),
    faiss_id    INTEGER,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (document_id, chunk_index)
);

-- ── Notes ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    project_id   UUID        REFERENCES projects(id) ON DELETE SET NULL,
    title        TEXT        NOT NULL DEFAULT 'Untitled'
                                 CHECK (char_length(title) BETWEEN 1 AND 500),
    content      TEXT        CHECK (content IS NULL OR char_length(content) <= 1048576),
    tags         JSONB       NOT NULL DEFAULT '[]'::jsonb,
    is_pinned    BOOLEAN     NOT NULL DEFAULT FALSE,
    is_completed BOOLEAN     NOT NULL DEFAULT FALSE,
    is_shared    BOOLEAN     NOT NULL DEFAULT FALSE,
    version      INTEGER     NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ
);

CREATE TRIGGER notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Tasks ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    project_id   UUID        REFERENCES projects(id) ON DELETE SET NULL,
    title        TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
    description  TEXT        CHECK (description IS NULL OR char_length(description) <= 10000),
    status       TEXT        NOT NULL DEFAULT 'todo'
                                 CHECK (status IN ('todo','in_progress','done','cancelled')),
    priority     TEXT        NOT NULL DEFAULT 'medium'
                                 CHECK (priority IN ('low','medium','high','urgent')),
    due_date     TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    tags         JSONB       NOT NULL DEFAULT '[]'::jsonb,
    version      INTEGER     NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ,
    CONSTRAINT tasks_completion_order CHECK (
        completed_at IS NULL OR completed_at >= created_at
    )
);

CREATE TRIGGER tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Chats ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chats (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    project_id UUID        REFERENCES projects(id) ON DELETE SET NULL,
    title      TEXT        NOT NULL DEFAULT 'New Chat'
                               CHECK (char_length(title) BETWEEN 1 AND 500),
    model      TEXT        NOT NULL DEFAULT 'phi-3-mini'
                               CHECK (char_length(model) <= 100),
    version    INTEGER     NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TRIGGER chats_updated_at
    BEFORE UPDATE ON chats
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Messages ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id     UUID        NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role        TEXT        NOT NULL CHECK (role IN ('user','assistant','system','tool')),
    content     TEXT        NOT NULL CHECK (char_length(content) <= 131072),
    citations   JSONB       NOT NULL DEFAULT '[]'::jsonb,
    tokens_used INTEGER     CHECK (tokens_used IS NULL OR tokens_used >= 0),
    latency_ms  INTEGER     CHECK (latency_ms  IS NULL OR latency_ms  >= 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Sync Events ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_events (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id    UUID        NOT NULL,
    entity_type  TEXT        NOT NULL
                                 CHECK (entity_type IN ('project','document','note','task','chat','message')),
    entity_id    UUID        NOT NULL,
    operation    TEXT        NOT NULL CHECK (operation IN ('create','update','delete')),
    payload      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    vector_clock JSONB       NOT NULL DEFAULT '{}'::jsonb,
    synced_at    TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Sync Queue ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_queue (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id     UUID        NOT NULL UNIQUE REFERENCES sync_events(id) ON DELETE CASCADE,
    status       TEXT        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','processing','done','error')),
    attempts     INTEGER     NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    last_error   TEXT        CHECK (last_error IS NULL OR char_length(last_error) <= 2000),
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- ── Operational Tables ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
    key        TEXT    PRIMARY KEY CHECK (char_length(key) BETWEEN 1 AND 250),
    value_json JSONB   NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS background_jobs (
    id           TEXT        PRIMARY KEY CHECK (char_length(id) BETWEEN 1 AND 100),
    job_type     TEXT        NOT NULL    CHECK (char_length(job_type) BETWEEN 1 AND 100),
    status       TEXT        NOT NULL DEFAULT 'queued'
                                 CHECK (status IN ('queued','running','done','error','cancelled')),
    priority     INTEGER     NOT NULL DEFAULT 5  CHECK (priority BETWEEN 1 AND 10),
    payload      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    attempts     INTEGER     NOT NULL DEFAULT 0  CHECK (attempts >= 0),
    max_attempts INTEGER     NOT NULL DEFAULT 5  CHECK (max_attempts BETWEEN 1 AND 50),
    run_at       TIMESTAMPTZ,
    last_error   TEXT        CHECK (last_error IS NULL OR char_length(last_error) <= 5000),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id          BIGSERIAL   PRIMARY KEY,
    actor_id    UUID,
    action      TEXT        NOT NULL CHECK (char_length(action) BETWEEN 1 AND 100),
    entity_type TEXT        CHECK (entity_type IS NULL OR char_length(entity_type) <= 100),
    entity_id   TEXT        CHECK (entity_id   IS NULL OR char_length(entity_id)   <= 100),
    metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_devices_user_id             ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_deleted       ON projects(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_documents_user_status       ON documents(user_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_project_deleted   ON documents(project_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_documents_updated_at        ON documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_doc_idx          ON document_chunks(document_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_faiss_id         ON document_chunks(faiss_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_deleted          ON notes(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_notes_project_deleted       ON notes(project_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at            ON notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status_deleted   ON tasks(user_id, status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_project_deleted       ON tasks(project_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date              ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_chats_user_deleted_updated  ON chats(user_id, deleted_at, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_chat_created       ON messages(chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sync_events_created_at      ON sync_events(created_at);
CREATE INDEX IF NOT EXISTS idx_sync_events_device_created  ON sync_events(device_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sync_events_entity          ON sync_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status_schedule  ON sync_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_bg_jobs_status_run_at       ON background_jobs(status, run_at);
CREATE INDEX IF NOT EXISTS idx_bg_jobs_type_status         ON background_jobs(job_type, status);
CREATE INDEX IF NOT EXISTS idx_audit_entity                ON audit_logs(entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_actor                 ON audit_logs(actor_id, created_at);
-- GIN index for JSONB tag searches
CREATE INDEX IF NOT EXISTS idx_notes_tags_gin              ON notes USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_tasks_tags_gin              ON tasks USING GIN (tags);
