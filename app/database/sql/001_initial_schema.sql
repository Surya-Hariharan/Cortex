-- Cortex SQLite Schema
-- 001_initial_schema.sql
-- All tables use ISO-8601 timestamps and soft-delete via deleted_at.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,          -- UUID
    display_name TEXT NOT NULL,
    email        TEXT UNIQUE,
    avatar_url   TEXT,
    stream       TEXT,                      -- academic stream / course
    plan         TEXT NOT NULL DEFAULT 'free',
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at   TIMESTAMP
);

-- ── Devices ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS devices (
    id           TEXT PRIMARY KEY,          -- UUID
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    platform     TEXT,                      -- win32 / darwin / linux
    arch         TEXT,                      -- x64 / arm64
    peer_id      TEXT UNIQUE,               -- mesh network peer identifier
    last_seen    TIMESTAMP,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── Projects ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    description  TEXT,
    color        TEXT DEFAULT '#6366f1',
    is_shared    INTEGER NOT NULL DEFAULT 0,
    version      INTEGER NOT NULL DEFAULT 1,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at   TIMESTAMP
);

-- ── Documents ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id   TEXT REFERENCES projects(id) ON DELETE SET NULL,
    filename     TEXT NOT NULL,
    file_path    TEXT NOT NULL,
    file_size    INTEGER,
    mime_type    TEXT NOT NULL DEFAULT 'application/pdf',
    title        TEXT,
    subject      TEXT,
    page_count   INTEGER,
    word_count   INTEGER,
    status       TEXT NOT NULL DEFAULT 'pending',  -- pending|processing|indexed|error
    error_msg    TEXT,
    is_shared    INTEGER NOT NULL DEFAULT 0,
    version      INTEGER NOT NULL DEFAULT 1,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at   TIMESTAMP
);

-- ── Document Chunks ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_chunks (
    id           TEXT PRIMARY KEY,
    document_id  TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index  INTEGER NOT NULL,
    content      TEXT NOT NULL,
    token_count  INTEGER,
    page_number  INTEGER,
    faiss_id     INTEGER,                   -- index in FAISS flat store
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id);

-- ── Notes ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id   TEXT REFERENCES projects(id) ON DELETE SET NULL,
    title        TEXT NOT NULL DEFAULT 'Untitled',
    content      TEXT,
    tags         TEXT,                      -- JSON array
    is_pinned    INTEGER NOT NULL DEFAULT 0,
    is_completed INTEGER NOT NULL DEFAULT 0,
    is_shared    INTEGER NOT NULL DEFAULT 0,
    version      INTEGER NOT NULL DEFAULT 1,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at   TIMESTAMP
);

-- ── Tasks ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id   TEXT REFERENCES projects(id) ON DELETE SET NULL,
    title        TEXT NOT NULL,
    description  TEXT,
    status       TEXT NOT NULL DEFAULT 'todo',  -- todo|in_progress|done|cancelled
    priority     TEXT NOT NULL DEFAULT 'medium',-- low|medium|high|urgent
    due_date     TIMESTAMP,
    completed_at TIMESTAMP,
    tags         TEXT,                          -- JSON array
    version      INTEGER NOT NULL DEFAULT 1,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at   TIMESTAMP
);

-- ── Chats ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chats (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id   TEXT REFERENCES projects(id) ON DELETE SET NULL,
    title        TEXT NOT NULL DEFAULT 'New Chat',
    model        TEXT NOT NULL DEFAULT 'phi-3-mini',
    version      INTEGER NOT NULL DEFAULT 1,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at   TIMESTAMP
);

-- ── Messages ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id           TEXT PRIMARY KEY,
    chat_id      TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role         TEXT NOT NULL,             -- user|assistant|system
    content      TEXT NOT NULL,
    citations    TEXT,                      -- JSON array of {doc_id, chunk_id, score}
    tokens_used  INTEGER,
    latency_ms   INTEGER,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);

-- ── Sync Events ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_events (
    id           TEXT PRIMARY KEY,          -- UUID
    device_id    TEXT NOT NULL,
    entity_type  TEXT NOT NULL,             -- document|note|task|project|chat
    entity_id    TEXT NOT NULL,
    operation    TEXT NOT NULL,             -- create|update|delete
    payload      TEXT NOT NULL,             -- JSON snapshot of entity
    vector_clock TEXT NOT NULL DEFAULT '{}',-- JSON {device_id: lamport_ts}
    synced_at    TIMESTAMP,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_events_entity  ON sync_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_events_created ON sync_events(created_at);

-- ── Sync Queue ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_queue (
    id           TEXT PRIMARY KEY,
    event_id     TEXT NOT NULL REFERENCES sync_events(id) ON DELETE CASCADE,
    status       TEXT NOT NULL DEFAULT 'pending', -- pending|processing|done|error
    attempts     INTEGER NOT NULL DEFAULT 0,
    last_error   TEXT,
    scheduled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
