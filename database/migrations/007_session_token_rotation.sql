-- 007_session_token_rotation.sql
-- Adds refresh-token rotation columns to the sessions table.
-- token_family  — groups all tokens issued from a single login;
--                 if a rotated (already-consumed) token is presented,
--                 every session in the family is revoked immediately.
-- previous_token_hash — the single hash of the token that was just rotated;
--                       compared against on reuse-detection path.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS token_family UUID NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS previous_token_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_sessions_token_family ON sessions(token_family);
