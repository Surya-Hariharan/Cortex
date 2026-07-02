const { createClient } = require('@supabase/supabase-js');
const config = require('./index');

// Lazy singletons, same pattern as db/pool.js's getPool() — constructing a
// client requires config that may legitimately be unset (e.g. `GET /health`
// must work without any Supabase project configured), so we only require it
// the moment a caller actually needs to talk to Supabase.

let _admin = null;
let _anon = null;

// Service-role key — full access, bypasses RLS. Server-only, never sent to
// the desktop app. Used for admin user management (create/delete/getUserById,
// generateLink for verification/recovery emails we deliver via MailerLite,
// signOut for logout/sign-out-all).
function supabaseAdmin() {
    if (!_admin) {
        if (!config.supabase.url || !config.supabase.serviceRoleKey) {
            throw new Error('[config] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for this operation.');
        }
        _admin = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });
    }
    return _admin;
}

// Anon key — used only for the calls that must go through Supabase's normal
// credential checks (signInWithPassword, refreshSession, verifyOtp). These
// are the operations Supabase Auth itself gates, as opposed to admin actions.
function supabaseAnon() {
    if (!_anon) {
        if (!config.supabase.url || !config.supabase.anonKey) {
            throw new Error('[config] SUPABASE_URL and SUPABASE_ANON_KEY are required for this operation.');
        }
        _anon = createClient(config.supabase.url, config.supabase.anonKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });
    }
    return _anon;
}

module.exports = { supabaseAdmin, supabaseAnon };
