BEGIN;

-- devices: add columns used by isDeviceRevoked() and isDeviceTrusted()
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS trusted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revoked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP NULL;

-- audit_logs: create table that was missing from initial schema
CREATE TABLE IF NOT EXISTS audit_logs (
  id         UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID      NULL REFERENCES users(id)   ON DELETE SET NULL,
  device_id  UUID      NULL REFERENCES devices(id) ON DELETE SET NULL,
  event_type TEXT      NOT NULL,
  event_data JSONB     NOT NULL DEFAULT '{}',
  ip_address TEXT      NULL,
  user_agent TEXT      NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

COMMIT;
