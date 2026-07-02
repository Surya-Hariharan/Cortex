const { Pool } = require('pg');
const config = require('../config');

let pool = null;

// Lazy singleton — nothing connects to Postgres until a query actually runs.
// This lets the app boot (and /health respond) even if no database is configured yet.
function getPool() {
    if (!pool) {
        if (!config.databaseUrl) {
            throw new Error('[db] DATABASE_URL is not configured.');
        }
        pool = new Pool({ connectionString: config.databaseUrl });
    }
    return pool;
}

function query(text, params) {
    return getPool().query(text, params);
}

async function withTransaction(fn) {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { getPool, query, withTransaction };
