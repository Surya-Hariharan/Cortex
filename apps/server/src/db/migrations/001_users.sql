-- Identity lives in Supabase Auth's built-in `auth.users` — we never store a
-- password or duplicate that table. Everything here is profile/device metadata
-- that FKs to auth.users(id). Note content never lives in this database.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name        TEXT,
    avatar_url          TEXT,
    preferences         JSONB NOT NULL DEFAULT '{}'::jsonb,
    subscription_plan   TEXT NOT NULL DEFAULT 'free',
    subscription_status TEXT NOT NULL DEFAULT 'active',
    subscription_renews_at TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    fingerprint     TEXT NOT NULL,
    platform        TEXT,
    -- RSA-OAEP public key the desktop app generates on first cloud enable.
    -- Used to wrap this device's copy of the user's symmetric content key —
    -- the server stores the wrapped key but can never unwrap it.
    public_key          TEXT,
    wrapped_user_key     TEXT,
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at      TIMESTAMPTZ,
    UNIQUE (user_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

-- apps/server connects with the Postgres/service role and bypasses RLS by
-- design (see apps/server/docs/DATABASE.md) — these policies are
-- defense-in-depth for the `authenticated`/`anon` Postgres roles that
-- Supabase's PostgREST/Realtime/client SDKs use, in case of future
-- direct-from-client access.
CREATE POLICY user_profiles_self ON user_profiles
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY devices_self ON devices
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
