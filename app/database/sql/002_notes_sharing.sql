-- ============================================================
-- Cortex — Notes Sharing  (SQLite / local)
-- 002_notes_sharing.sql
--
-- Adds visibility levels to notes and a note_saves table so
-- users can keep a personal copy of a note shared by someone else.
--
-- Applied automatically by app/database/migrations.py on startup
-- after 001_initial_schema.sql.
-- ============================================================

-- ── Add visibility column to existing notes table ─────────────────────────────
-- SQLite does not allow CHECK constraints in ALTER TABLE ADD COLUMN when the
-- column has a DEFAULT that was already committed, so we define the default
-- here and enforce the CHECK via a trigger below.
ALTER TABLE notes ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';

-- Enforce the enum via a trigger because SQLite ALTER TABLE ADD COLUMN does
-- not support CHECK constraints.
CREATE TRIGGER IF NOT EXISTS notes_visibility_insert
BEFORE INSERT ON notes
BEGIN
    SELECT RAISE(ABORT, 'visibility must be private, link_only, or public')
    WHERE NEW.visibility NOT IN ('private', 'link_only', 'public');
END;

CREATE TRIGGER IF NOT EXISTS notes_visibility_update
BEFORE UPDATE OF visibility ON notes
BEGIN
    SELECT RAISE(ABORT, 'visibility must be private, link_only, or public')
    WHERE NEW.visibility NOT IN ('private', 'link_only', 'public');
END;

-- Backfill: existing rows where is_shared=1 become 'public'.
UPDATE notes SET visibility = 'public' WHERE is_shared = 1 AND visibility = 'private';

-- ── note_saves ────────────────────────────────────────────────────────────────
-- When user B "downloads" a shared note from user A, we:
--   1. Create a private copy in notes  (local_note_id)
--   2. Record the provenance here so the original author can be attributed.
--
-- source_note_id is the UUID of the original note (may live only on Supabase
-- when offline; stored as TEXT so we never need a FK to a remote row).
CREATE TABLE IF NOT EXISTS note_saves (
    id             TEXT PRIMARY KEY,
    saver_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_note_id TEXT NOT NULL,
    -- FK to the personal copy created in the notes table (NULL if copy deleted)
    local_note_id  TEXT REFERENCES notes(id) ON DELETE SET NULL,
    saved_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    -- Prevent saving the same source note twice
    UNIQUE (saver_id, source_note_id)
);

CREATE INDEX IF NOT EXISTS idx_note_saves_saver   ON note_saves(saver_id);
CREATE INDEX IF NOT EXISTS idx_note_saves_source  ON note_saves(source_note_id);
CREATE INDEX IF NOT EXISTS idx_note_saves_local   ON note_saves(local_note_id);

-- ── Add index for fast visibility queries on notes ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notes_visibility  ON notes(visibility);
CREATE INDEX IF NOT EXISTS idx_notes_user_vis    ON notes(user_id, visibility);
