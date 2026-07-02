require('dotenv').config();

const isTest = process.env.NODE_ENV === 'test';

function required(name, fallbackForTest) {
    const value = process.env[name];
    if (value) return value;
    if (isTest && fallbackForTest !== undefined) return fallbackForTest;
    throw new Error(`[config] Missing required environment variable: ${name}`);
}

const config = {
    env: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT) || 4000,
    // Points at Supabase's Postgres connection string. The repository layer
    // talks to it via plain `pg`, same as before Supabase was introduced —
    // Supabase exposes a standard Postgres connection, so only this value
    // (and the schema/RLS policies) changed, not the query layer.
    databaseUrl: process.env.DATABASE_URL || (isTest ? 'postgres://test:test@localhost:5432/cortex_server_test' : undefined),
    corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),

    // Identity is Supabase Auth, not a local users table. `url`/`anonKey`/
    // `serviceRoleKey` are only required lazily, the first time a Supabase
    // client is actually constructed (see config/supabase.js) — mirrors how
    // `databaseUrl` above is only required lazily by db/pool.js — so the
    // process can still boot (e.g. for `GET /health`) without them set.
    // `jwtSecret` IS required eagerly because every authenticated request
    // needs it to verify the bearer token.
    supabase: {
        url: process.env.SUPABASE_URL || (isTest ? 'https://test.supabase.co' : undefined),
        anonKey: process.env.SUPABASE_ANON_KEY || (isTest ? 'test-anon-key' : undefined),
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || (isTest ? 'test-service-role-key' : undefined),
        jwtSecret: required('SUPABASE_JWT_SECRET', 'test-only-secret-not-for-production'),
    },

    emailProvider: process.env.EMAIL_PROVIDER || 'console',
    pushProvider: process.env.PUSH_PROVIDER || 'noop',

    mailerlite: {
        apiKey: process.env.MAILERLITE_API_KEY,
        fromEmail: process.env.MAILERLITE_FROM_EMAIL || 'noreply@cortex.app',
        fromName: process.env.MAILERLITE_FROM_NAME || 'Cortex',
    },
};

module.exports = config;
