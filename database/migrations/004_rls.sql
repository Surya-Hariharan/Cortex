BEGIN;

-- ─── users ───────────────────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_self_select ON users;
CREATE POLICY users_self_select ON users
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS users_self_update ON users;
CREATE POLICY users_self_update ON users
  FOR UPDATE USING (id = auth.uid());

-- ─── sessions ────────────────────────────────────────────────────────────────
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sessions_self_select ON sessions;
CREATE POLICY sessions_self_select ON sessions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS sessions_self_delete ON sessions;
CREATE POLICY sessions_self_delete ON sessions
  FOR DELETE USING (user_id = auth.uid());

-- ─── devices ─────────────────────────────────────────────────────────────────
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS devices_self_select ON devices;
CREATE POLICY devices_self_select ON devices
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS devices_self_update ON devices;
CREATE POLICY devices_self_update ON devices
  FOR UPDATE USING (user_id = auth.uid());

-- ─── audit_logs ──────────────────────────────────────────────────────────────
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_self_select ON audit_logs;
CREATE POLICY audit_logs_self_select ON audit_logs
  FOR SELECT USING (user_id = auth.uid());

-- INSERT for all four tables is handled by the service-role key (backend only);
-- no user-facing insert policy is needed.

COMMIT;
