const { query } = require('../db/pool');

// Identity (email, password, email-confirmation state) lives in Supabase
// Auth's `auth.users` — this repository only owns the `user_profiles` row
// (display name, avatar, preferences, subscription), which FKs to it.
//
// findByEmail/findById below read directly from `auth.users` via the same
// `pg` connection (the server's Postgres role can see it) rather than the
// paginated Admin API — identity *mutations* (create/delete/update
// password/sessions) go through supabaseAdmin instead, see auth.service.js.

async function findByEmail(email) {
    const { rows } = await query(
        `SELECT id, email, raw_user_meta_data->>'full_name' AS full_name FROM auth.users WHERE email = $1`,
        [email]
    );
    return rows[0] || null;
}

async function getProfile(userId) {
    const { rows } = await query('SELECT * FROM user_profiles WHERE user_id = $1', [userId]);
    return rows[0] || null;
}

async function upsertProfile(userId, { avatarUrl, displayName, preferences } = {}) {
    const { rows } = await query(
        `INSERT INTO user_profiles (user_id, avatar_url, display_name, preferences)
         VALUES ($1, $2, $3, COALESCE($4, '{}'::jsonb))
         ON CONFLICT (user_id) DO UPDATE SET
            avatar_url = COALESCE(EXCLUDED.avatar_url, user_profiles.avatar_url),
            display_name = COALESCE(EXCLUDED.display_name, user_profiles.display_name),
            preferences = COALESCE(EXCLUDED.preferences, user_profiles.preferences),
            updated_at = now()
         RETURNING *`,
        [userId, avatarUrl ?? null, displayName ?? null, preferences ? JSON.stringify(preferences) : null]
    );
    return rows[0];
}

async function getSubscription(userId) {
    const profile = await getProfile(userId);
    return {
        plan: profile?.subscription_plan ?? 'free',
        status: profile?.subscription_status ?? 'active',
        renewsAt: profile?.subscription_renews_at ?? null,
    };
}

module.exports = { findByEmail, getProfile, upsertProfile, getSubscription };
