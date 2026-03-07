-- ============================================================
-- Cortex — Security Hardening  (Supabase / PostgreSQL)
-- 004_security.sql
--
-- Run AFTER 003_rls_policies.sql.
--
-- Covers:
--   1. Privilege hardening (principle of least privilege)
--   2. Rate-limiting table + atomic check/increment function
--   3. Audit trigger on all sensitive tables
--   4. Defense-in-depth CHECK constraints (injection detection)
--   5. Dangerous built-in function revocations
--   6. Prepared-statement / search_path hygiene notes
-- ============================================================

SET search_path = public, pg_catalog;

-- ════════════════════════════════════════════════════════════
-- 1. PRIVILEGE HARDENING
-- ════════════════════════════════════════════════════════════

-- Remove blanket public schema access; grant only what's needed.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM anon;

GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- anon role: read-only access to nothing by default.
-- (Supabase Auth endpoints don't need table access from anon.)
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- authenticated users: DML on their own tables (RLS enforces row ownership).
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON devices          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON projects         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON documents        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON document_chunks  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON notes            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tasks            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON chats            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON messages         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sync_events      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sync_queue       TO authenticated;

-- audit_logs: authenticated users can only SELECT their own rows (see RLS).
GRANT SELECT ON audit_logs TO authenticated;

-- Operational tables: deny all authenticated access (service_role only).
REVOKE ALL ON app_settings    FROM authenticated;
REVOKE ALL ON background_jobs FROM authenticated;

-- Grant sequence usage needed for serial PKs (audit_logs.id is BIGSERIAL).
GRANT USAGE ON SEQUENCE audit_logs_id_seq TO authenticated;

-- Function visibility: authenticated may call match_document_chunks (granted
-- in 002_embeddings.sql). No extra grants here.

-- ════════════════════════════════════════════════════════════
-- 2. RATE LIMITING
-- ════════════════════════════════════════════════════════════

-- Stores per-user, per-action request counts in one-minute windows.
-- The backend (or edge function) calls check_rate_limit() before handling
-- expensive operations (chat, document upload, search).
CREATE TABLE IF NOT EXISTS rate_limits (
    id            BIGSERIAL   PRIMARY KEY,
    user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    action        TEXT        NOT NULL CHECK (char_length(action) BETWEEN 1 AND 100),
    window_start  TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', NOW()),
    request_count INTEGER     NOT NULL DEFAULT 1 CHECK (request_count >= 0),
    UNIQUE (user_id, action, window_start)
);

-- Rate-limit table is service_role + SECURITY DEFINER functions only.
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits FORCE  ROW LEVEL SECURITY;
REVOKE ALL ON rate_limits FROM authenticated;
REVOKE ALL ON rate_limits FROM anon;

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action_window
    ON rate_limits(user_id, action, window_start);

-- Atomic check-and-increment.
-- Returns TRUE  → request is within limit, proceed.
-- Returns FALSE → limit exceeded, reject with 429.
-- All inputs are bound parameters; no dynamic SQL.
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_user_id  UUID,
    p_action   TEXT,
    p_limit    INTEGER  DEFAULT 60,        -- max requests per window
    p_window   INTERVAL DEFAULT '1 minute'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_window_start TIMESTAMPTZ;
    v_count        INTEGER;
BEGIN
    v_window_start := date_trunc('minute', NOW());

    -- Upsert: increment counter atomically
    INSERT INTO rate_limits (user_id, action, window_start, request_count)
    VALUES (p_user_id, p_action, v_window_start, 1)
    ON CONFLICT (user_id, action, window_start)
    DO UPDATE SET request_count = rate_limits.request_count + 1
    RETURNING request_count INTO v_count;

    -- Purge stale windows (fire-and-forget; failures are non-fatal)
    BEGIN
        DELETE FROM rate_limits
        WHERE  user_id      = p_user_id
          AND  action       = p_action
          AND  window_start < NOW() - (p_window * 2);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    RETURN v_count <= p_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION check_rate_limit(UUID, TEXT, INTEGER, INTERVAL) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION check_rate_limit(UUID, TEXT, INTEGER, INTERVAL) TO  service_role;

-- ════════════════════════════════════════════════════════════
-- 3. AUDIT TRIGGER
-- ════════════════════════════════════════════════════════════

-- Writes a row to audit_logs for every INSERT/UPDATE/DELETE on core tables.
-- Content fields (content, file_path) are stripped before logging to
-- avoid storing large text blobs in the audit trail.
CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_actor_id  UUID;
    v_entity_id TEXT;
    v_meta      JSONB;
BEGIN
    -- auth.uid() returns NULL when called from a service_role context
    BEGIN
        v_actor_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        v_actor_id := NULL;
    END;

    IF TG_OP = 'DELETE' THEN
        v_entity_id := OLD.id::TEXT;
        v_meta      := jsonb_build_object('old', to_jsonb(OLD));
    ELSIF TG_OP = 'INSERT' THEN
        v_entity_id := NEW.id::TEXT;
        v_meta      := jsonb_build_object('new', to_jsonb(NEW));
    ELSE  -- UPDATE
        v_entity_id := NEW.id::TEXT;
        v_meta      := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    END IF;

    -- Strip high-volume / sensitive fields from the JSON snapshot
    v_meta := v_meta
                  #- '{new,content}'
                  #- '{old,content}'
                  #- '{new,file_path}'
                  #- '{old,file_path}';

    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (v_actor_id, TG_OP, TG_TABLE_NAME, v_entity_id, v_meta);

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

-- Attach to all tables that hold user-created content
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'profiles','projects','documents','notes','tasks','chats','messages'
    ]
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS audit_%I ON %I; '  ||
            'CREATE TRIGGER audit_%I '                  ||
            'AFTER INSERT OR UPDATE OR DELETE ON %I '  ||
            'FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn()',
            t, t, t, t
        );
    END LOOP;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- 4. DEFENSE-IN-DEPTH: INJECTION DETECTION
-- ════════════════════════════════════════════════════════════
-- Primary protection is always parameterized queries in application code.
-- These database-level constraints are a last line of defense that will
-- reject rows containing obvious SQL-injection or XSS payloads before they
-- are ever persisted — even if the application layer is bypassed.

-- Pattern-based SQL injection detector (OWASP Top-10 patterns)
CREATE OR REPLACE FUNCTION no_sql_injection(v TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
BEGIN
    -- Reject strings that contain common injection markers.
    -- Patterns: comment sequences, dangerous keywords, UNION/subquery tricks,
    -- classic 1=1 / OR 1-- bypasses.
    IF v ~* '(--|;|\bDROP\b|\bTRUNCATE\b|\bDELETE\b\s+\bFROM\b|\bEXEC\b'
              '|\bXP_|\bINSERT\b\s+\bINTO\b|\bSELECT\b\s+\*\s+\bFROM\b'
              '|\bUNION\b\s+\bSELECT\b|\bOR\b\s+\d+\s*=\s*\d'
              '|\bAND\b\s+\d+\s*=\s*\d|\bSLEEP\b\s*\(|\bBENCHMARK\s*\()' THEN
        RETURN FALSE;
    END IF;
    RETURN TRUE;
END;
$$;

-- Pattern-based XSS detector for fields rendered in HTML
CREATE OR REPLACE FUNCTION no_xss(v TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
BEGIN
    IF v ~* '(<\s*script|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object'
              '|<\s*embed|<\s*form|vbscript\s*:|\bdata\s*:\s*text/html)' THEN
        RETURN FALSE;
    END IF;
    RETURN TRUE;
END;
$$;

-- Apply no_sql_injection to critical free-text fields that are user-supplied
-- and may be reflected back in queries or API responses.
DO $$
BEGIN
    -- profiles.display_name
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE  table_name = 'profiles' AND constraint_name = 'chk_profiles_display_name_safe'
    ) THEN
        ALTER TABLE profiles
            ADD CONSTRAINT chk_profiles_display_name_safe
            CHECK (no_sql_injection(display_name) AND no_xss(display_name));
    END IF;

    -- notes.title
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE  table_name = 'notes' AND constraint_name = 'chk_notes_title_safe'
    ) THEN
        ALTER TABLE notes
            ADD CONSTRAINT chk_notes_title_safe
            CHECK (no_sql_injection(title) AND no_xss(title));
    END IF;

    -- tasks.title
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE  table_name = 'tasks' AND constraint_name = 'chk_tasks_title_safe'
    ) THEN
        ALTER TABLE tasks
            ADD CONSTRAINT chk_tasks_title_safe
            CHECK (no_sql_injection(title) AND no_xss(title));
    END IF;

    -- chats.title
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE  table_name = 'chats' AND constraint_name = 'chk_chats_title_safe'
    ) THEN
        ALTER TABLE chats
            ADD CONSTRAINT chk_chats_title_safe
            CHECK (no_sql_injection(title) AND no_xss(title));
    END IF;

    -- projects.title
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE  table_name = 'projects' AND constraint_name = 'chk_projects_title_safe'
    ) THEN
        ALTER TABLE projects
            ADD CONSTRAINT chk_projects_title_safe
            CHECK (no_sql_injection(title) AND no_xss(title));
    END IF;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- 5. REVOKE DANGEROUS BUILT-IN FUNCTIONS
-- ════════════════════════════════════════════════════════════
-- These functions let Postgres read/write the server filesystem.
-- They should never be callable by application roles.
DO $$
BEGIN
    BEGIN
        REVOKE EXECUTE ON FUNCTION pg_read_file(text)                 FROM PUBLIC;
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
    BEGIN
        REVOKE EXECUTE ON FUNCTION pg_read_file(text, bigint, bigint)  FROM PUBLIC;
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
    BEGIN
        REVOKE EXECUTE ON FUNCTION pg_read_binary_file(text)           FROM PUBLIC;
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
    BEGIN
        REVOKE EXECUTE ON FUNCTION pg_ls_dir(text)                     FROM PUBLIC;
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
    BEGIN
        REVOKE EXECUTE ON FUNCTION pg_stat_file(text)                  FROM PUBLIC;
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
    BEGIN
        REVOKE EXECUTE ON FUNCTION pg_write_file(text, text)           FROM PUBLIC;
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- 6. SEARCH PATH LOCK-DOWN
-- ════════════════════════════════════════════════════════════
-- Lock the search_path for application roles to prevent schema-injection
-- attacks where a malicious schema shadows trusted functions.
-- (Run once; Supabase service_role retains its own search_path.)
ALTER ROLE authenticated SET search_path = public, pg_catalog;
ALTER ROLE anon          SET search_path = public, pg_catalog;
