BEGIN;

CREATE INDEX IF NOT EXISTS idx_users_email             ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id        ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token  ON sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_devices_user_fingerprint ON devices(user_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id      ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at   ON audit_logs(created_at);

COMMIT;
