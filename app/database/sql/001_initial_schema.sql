-- ============================================================
-- Cortex — Initial Schema  (SQLite / local development)
-- 001_initial_schema.sql
--
-- Applied automatically by app/database/migrations.py on startup.
-- All tables use ISO-8601 timestamps and soft-delete via deleted_at.
-- CHECK constraints provide defense-in-depth against bad data.
-- FK enforcement is enabled per-connection in connection.py.
-- ============================================================

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,          -- mirrors Supabase auth.users UUID
    display_name TEXT NOT NULL DEFAULT '',
    email        TEXT UNIQUE,
    avatar_url   TEXT,
    stream       TEXT,                      -- academic stream / course
    plan         TEXT NOT NULL DEFAULT 'free'
                     CHECK (plan IN ('free','pro','enterprise')),
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    deleted_at   TEXT
);

-- ── Devices ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS devices (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    platform     TEXT,                      -- win32 / darwin / linux
    arch         TEXT,                      -- x64 / arm64
    peer_id      TEXT UNIQUE,               -- mesh network peer identifier
    last_seen    TEXT,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ── Projects ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 500),
    description  TEXT CHECK (description IS NULL OR length(description) <= 5000),
    color        TEXT NOT NULL DEFAULT '#6366f1',
    is_shared    INTEGER NOT NULL DEFAULT 0 CHECK (is_shared IN (0,1)),
    version      INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    deleted_at   TEXT
);

-- ── Documents ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id   TEXT REFERENCES projects(id) ON DELETE SET NULL,
    filename     TEXT NOT NULL CHECK (length(filename) BETWEEN 1 AND 500),
    file_path    TEXT NOT NULL,
    file_size    INTEGER CHECK (file_size IS NULL OR (file_size >= 0 AND file_size <= 524288000)),
    mime_type    TEXT NOT NULL DEFAULT 'application/pdf'
                     CHECK (mime_type IN (
                         'application/pdf',
                         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                         'application/msword',
                         'text/plain', 'text/markdown',
                         'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg',
                         'video/mp4', 'video/webm'
                     )),
    title        TEXT CHECK (title IS NULL OR length(title) <= 500),
    subject      TEXT CHECK (subject IS NULL OR length(subject) <= 250),
    page_count   INTEGER CHECK (page_count IS NULL OR page_count >= 0),
    word_count   INTEGER CHECK (word_count IS NULL OR word_count >= 0),
    status       TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','processing','ready','error','deleted')),
    error_msg    TEXT CHECK (error_msg IS NULL OR length(error_msg) <= 2000),
    ocr_applied  INTEGER NOT NULL DEFAULT 0 CHECK (ocr_applied IN (0,1)),
    is_shared    INTEGER NOT NULL DEFAULT 0 CHECK (is_shared IN (0,1)),
    version      INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    deleted_at   TEXT
);

-- ── Document Chunks ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_chunks (
    id           TEXT PRIMARY KEY,
    document_id  TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index  INTEGER NOT NULL CHECK (chunk_index >= 0),
    content      TEXT NOT NULL CHECK (length(content) <= 32768),
    token_count  INTEGER CHECK (token_count IS NULL OR (token_count >= 0 AND token_count <= 4096)),
    page_number  INTEGER CHECK (page_number IS NULL OR page_number >= 0),
    faiss_id     INTEGER,                   -- row index in FAISS flat store
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_faiss_id ON document_chunks(faiss_id);

-- ── Notes ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id   TEXT REFERENCES projects(id) ON DELETE SET NULL,
    title        TEXT NOT NULL DEFAULT 'Untitled' CHECK (length(title) BETWEEN 1 AND 500),
    content      TEXT CHECK (content IS NULL OR length(content) <= 1048576),
    tags         TEXT NOT NULL DEFAULT '[]',    -- JSON array
    is_pinned    INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned    IN (0,1)),
    is_completed INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0,1)),
    is_shared    INTEGER NOT NULL DEFAULT 0 CHECK (is_shared    IN (0,1)),
    version      INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    deleted_at   TEXT
);

-- ── Tasks ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id   TEXT REFERENCES projects(id) ON DELETE SET NULL,
    title        TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 500),
    description  TEXT CHECK (description IS NULL OR length(description) <= 10000),
    status       TEXT NOT NULL DEFAULT 'todo'
                     CHECK (status IN ('todo','in_progress','done','cancelled')),
    priority     TEXT NOT NULL DEFAULT 'medium'
                     CHECK (priority IN ('low','medium','high','urgent')),
    due_date     TEXT,
    completed_at TEXT,
    tags         TEXT NOT NULL DEFAULT '[]',   -- JSON array
    version      INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    deleted_at   TEXT
);

-- ── Chats ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chats (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id   TEXT REFERENCES projects(id) ON DELETE SET NULL,
    title        TEXT NOT NULL DEFAULT 'New Chat' CHECK (length(title) BETWEEN 1 AND 500),
    model        TEXT NOT NULL DEFAULT 'phi-3-mini',
    version      INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    deleted_at   TEXT
);

-- ── Messages ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id           TEXT PRIMARY KEY,
    chat_id      TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role         TEXT NOT NULL CHECK (role IN ('user','assistant','system','tool')),
    content      TEXT NOT NULL CHECK (length(content) <= 131072),
    citations    TEXT NOT NULL DEFAULT '[]',  -- JSON [{doc_id, chunk_id, score}]
    tokens_used  INTEGER CHECK (tokens_used IS NULL OR tokens_used >= 0),
    latency_ms   INTEGER CHECK (latency_ms  IS NULL OR latency_ms  >= 0),
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);

-- ── Sync Events ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_events (
    id           TEXT PRIMARY KEY,
    device_id    TEXT NOT NULL,
    entity_type  TEXT NOT NULL
                     CHECK (entity_type IN ('project','document','note','task','chat','message')),
    entity_id    TEXT NOT NULL,
    operation    TEXT NOT NULL CHECK (operation IN ('create','update','delete')),
    payload      TEXT NOT NULL DEFAULT '{}',          -- JSON snapshot of entity
    vector_clock TEXT NOT NULL DEFAULT '{}',          -- JSON {device_id: lamport_ts}
    synced_at    TEXT,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_sync_events_entity  ON sync_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_events_device  ON sync_events(device_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sync_events_created ON sync_events(created_at);

-- ── Sync Queue ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_queue (
    id           TEXT PRIMARY KEY,
    event_id     TEXT NOT NULL UNIQUE REFERENCES sync_events(id) ON DELETE CASCADE,
    status       TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','processing','done','error')),
    attempts     INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    last_error   TEXT CHECK (last_error IS NULL OR length(last_error) <= 2000),
    scheduled_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status, scheduled_at);

-- ── Operational Tables ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
    key        TEXT PRIMARY KEY CHECK (length(key) BETWEEN 1 AND 250),
    value_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS background_jobs (
    id           TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 100),
    job_type     TEXT NOT NULL    CHECK (length(job_type) BETWEEN 1 AND 100),
    status       TEXT NOT NULL DEFAULT 'queued'
                     CHECK (status IN ('queued','running','done','error','cancelled')),
    priority     INTEGER NOT NULL DEFAULT 5  CHECK (priority BETWEEN 1 AND 10),
    payload      TEXT NOT NULL DEFAULT '{}',
    attempts     INTEGER NOT NULL DEFAULT 0  CHECK (attempts >= 0),
    max_attempts INTEGER NOT NULL DEFAULT 5  CHECK (max_attempts BETWEEN 1 AND 50),
    run_at       TEXT,
    last_error   TEXT CHECK (last_error IS NULL OR length(last_error) <= 5000),
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_bg_jobs_status_run_at ON background_jobs(status, run_at);

CREATE TABLE IF NOT EXISTS audit_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id    TEXT,
    action      TEXT NOT NULL CHECK (length(action) BETWEEN 1 AND 100),
    entity_type TEXT CHECK (entity_type IS NULL OR length(entity_type) <= 100),
    entity_id   TEXT CHECK (entity_id   IS NULL OR length(entity_id)   <= 100),
    metadata    TEXT NOT NULL DEFAULT '{}',
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_actor  ON audit_logs(actor_id, created_at);

-- ── Extra indexes ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_projects_user_deleted       ON projects(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_documents_user_status       ON documents(user_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_project_deleted   ON documents(project_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_documents_updated_at        ON documents(updated_at);
CREATE INDEX IF NOT EXISTS idx_notes_user_deleted          ON notes(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_notes_project_deleted       ON notes(project_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at            ON notes(updated_at);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status_deleted   ON tasks(user_id, status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_project_deleted       ON tasks(project_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date              ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_chats_user_deleted_updated  ON chats(user_id, deleted_at, updated_at);
