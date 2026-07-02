#!/usr/bin/env node
// Applies src/db/migrations/*.sql in filename order, tracking applied
// migrations in a schema_migrations table. Idempotent — safe to re-run.

const fs = require('fs');
const path = require('path');
const { getPool } = require('./pool');
const logger = require('../utils/logger');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function migrate() {
    const pool = getPool();

    await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            name        TEXT PRIMARY KEY,
            applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    `);

    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
    const { rows: applied } = await pool.query('SELECT name FROM schema_migrations');
    const appliedNames = new Set(applied.map((r) => r.name));

    for (const file of files) {
        if (appliedNames.has(file)) continue;
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(sql);
            await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
            await client.query('COMMIT');
            logger.info(`[migrate] applied ${file}`);
        } catch (err) {
            await client.query('ROLLBACK');
            throw new Error(`[migrate] failed on ${file}: ${err.message}`);
        } finally {
            client.release();
        }
    }
}

if (require.main === module) {
    migrate()
        .then(() => {
            logger.info('[migrate] up to date');
            process.exit(0);
        })
        .catch((err) => {
            logger.error(err.message);
            process.exit(1);
        });
}

module.exports = { migrate };
