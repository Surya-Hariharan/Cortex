-- Intentionally empty: refresh/verification/reset tokens are now managed
-- entirely by Supabase Auth (auth.refresh_tokens, auth.one_time_tokens, etc).
-- Kept as a numbered no-op migration so the file sequence and any already
-- recorded schema_migrations rows stay stable rather than renumbering
-- everything after it.
SELECT 1;
