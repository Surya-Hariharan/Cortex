-- ============================================================
-- Cortex — Notes Sharing  (Supabase / cloud)
-- 005_notes_sharing.sql
--
-- Architecture:
--   notes.visibility  — private | link_only | public
--   note_shares       — metadata for publicly reachable notes
--                        (share_token for link sharing, view/download counters)
--   note_saves        — personal copy record when a user downloads a public note
--
-- Apply after 001_initial_schema.sql, 002_embeddings.sql,
-- 003_rls_policies.sql, 004_security.sql.
-- ============================================================

-- ── 1. Add visibility to notes ────────────────────────────────────────────────
ALTER TABLE notes
    ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'
        CHECK (visibility IN ('private', 'link_only', 'public'));

-- Backfill: existing is_shared=1 rows become public.
UPDATE notes SET visibility = 'public' WHERE is_shared = TRUE AND visibility = 'private';

CREATE INDEX IF NOT EXISTS idx_notes_visibility   ON notes(visibility);
CREATE INDEX IF NOT EXISTS idx_notes_user_vis     ON notes(user_id, visibility);

-- ── 2. note_shares ────────────────────────────────────────────────────────────
-- Created / updated whenever a note's visibility changes to link_only or public.
-- Stores discoverable metadata (counters, featured flag, share token for links).
CREATE TABLE IF NOT EXISTS note_shares (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id        UUID        NOT NULL UNIQUE
                                   REFERENCES notes(id)    ON DELETE CASCADE,
    owner_id       UUID        NOT NULL
                                   REFERENCES profiles(id) ON DELETE CASCADE,
    -- Short hex slug for "share by link" URLs: /shared/<share_token>
    share_token    TEXT        NOT NULL UNIQUE
                                   DEFAULT encode(gen_random_bytes(10), 'hex'),
    view_count     INTEGER     NOT NULL DEFAULT 0
                                   CHECK (view_count    >= 0),
    download_count INTEGER     NOT NULL DEFAULT 0
                                   CHECK (download_count >= 0),
    is_featured    BOOLEAN     NOT NULL DEFAULT FALSE,
    published_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_shares_owner     ON note_shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_note_shares_token     ON note_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_note_shares_featured  ON note_shares(is_featured, published_at DESC);

-- ── 3. note_saves ─────────────────────────────────────────────────────────────
-- When user B saves user A's public note:
--   source_note_id  → the original note's UUID
--   local_note_id   → a NEW private note created as a personal copy (can be NULL
--                     if the user only bookmarked without copying content)
CREATE TABLE IF NOT EXISTS note_saves (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    saver_id       UUID        NOT NULL
                                   REFERENCES profiles(id) ON DELETE CASCADE,
    source_note_id UUID        NOT NULL
                                   REFERENCES notes(id)    ON DELETE CASCADE,
    local_note_id  UUID
                                   REFERENCES notes(id)    ON DELETE SET NULL,
    saved_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (saver_id, source_note_id)
);

CREATE INDEX IF NOT EXISTS idx_note_saves_saver   ON note_saves(saver_id);
CREATE INDEX IF NOT EXISTS idx_note_saves_source  ON note_saves(source_note_id);

-- ── 4. Helper function: increment share counters ──────────────────────────────
-- Called by app logic; keeps counter updates atomic.
CREATE OR REPLACE FUNCTION increment_note_view(p_note_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE note_shares
    SET    view_count = view_count + 1
    WHERE  note_id = p_note_id;
END;
$$;

CREATE OR REPLACE FUNCTION increment_note_download(p_note_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE note_shares
    SET    download_count = download_count + 1
    WHERE  note_id = p_note_id;
END;
$$;

-- Only service role and authenticated users may call these.
REVOKE ALL ON FUNCTION increment_note_view(UUID)     FROM PUBLIC;
REVOKE ALL ON FUNCTION increment_note_download(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION increment_note_view(UUID)     TO authenticated;
GRANT  EXECUTE ON FUNCTION increment_note_download(UUID) TO authenticated;

-- ── 5. Row-Level Security ─────────────────────────────────────────────────────
ALTER TABLE note_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_shares FORCE  ROW LEVEL SECURITY;
ALTER TABLE note_saves  ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_saves  FORCE  ROW LEVEL SECURITY;

-- ---- note_shares policies ---------------------------------------------------

-- Public notes in note_shares are visible to every authenticated user.
CREATE POLICY "note_shares: authenticated can read public"
    ON note_shares FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM notes n
            WHERE  n.id = note_shares.note_id
            AND    n.visibility = 'public'
        )
    );

-- Link-only: a user who knows the note_id (or share_token) can also see this row.
-- In practice the app uses the share_token to look up the note, and this policy
-- lets the SELECT pass once the note_id is resolved.
CREATE POLICY "note_shares: authenticated can read link_only"
    ON note_shares FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM notes n
            WHERE  n.id = note_shares.note_id
            AND    n.visibility = 'link_only'
        )
    );

-- Owners manage their own share records.
CREATE POLICY "note_shares: owner can insert"
    ON note_shares FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "note_shares: owner can update"
    ON note_shares FOR UPDATE
    TO authenticated
    USING  (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "note_shares: owner can delete"
    ON note_shares FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid());

-- ---- Extend notes RLS for shared visibility ---------------------------------
-- (Original notes policies in 003_rls_policies.sql only let owners read.
--  We ADD policies for public and link_only reads — they coexist because
--  Supabase uses OR logic across multiple SELECT policies.)

CREATE POLICY "notes: authenticated can read public"
    ON notes FOR SELECT
    TO authenticated
    USING (visibility = 'public' AND deleted_at IS NULL);

CREATE POLICY "notes: authenticated can read link_only"
    ON notes FOR SELECT
    TO authenticated
    USING (visibility = 'link_only' AND deleted_at IS NULL);

-- ---- note_saves policies ----------------------------------------------------

CREATE POLICY "note_saves: saver full access"
    ON note_saves FOR ALL
    TO authenticated
    USING  (saver_id = auth.uid())
    WITH CHECK (saver_id = auth.uid());

-- ── 6. Audit triggers for new tables ─────────────────────────────────────────
-- Reuse the audit_trigger_fn() defined in 004_security.sql.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger_fn') THEN
        CREATE TRIGGER audit_note_shares
            AFTER INSERT OR UPDATE OR DELETE ON note_shares
            FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

        CREATE TRIGGER audit_note_saves
            AFTER INSERT OR UPDATE OR DELETE ON note_saves
            FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
    END IF;
END
$$;

-- ── 7. Grant table access to authentication roles ────────────────────────────
GRANT SELECT                         ON note_shares TO authenticated;
GRANT INSERT, UPDATE, DELETE, SELECT ON note_shares TO authenticated;  -- RLS restricts rows
GRANT SELECT                         ON note_saves  TO authenticated;
GRANT INSERT, UPDATE, DELETE, SELECT ON note_saves  TO authenticated;

-- Revoke public / anon from these tables entirely.
REVOKE ALL ON note_shares FROM PUBLIC;
REVOKE ALL ON note_shares FROM anon;
REVOKE ALL ON note_saves  FROM PUBLIC;
REVOKE ALL ON note_saves  FROM anon;
