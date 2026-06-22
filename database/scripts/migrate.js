const fs = require('fs');
const path = require('path');
const { pool } = require('../pool');

const SQL_DIR = path.join(__dirname, '..', 'migrations');

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT      PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    const files = fs.readdirSync(SQL_DIR)
      .filter(f => /^\d+.*\.sql$/.test(f))
      .sort();

    for (const filename of files) {
      const { rowCount } = await client.query(
        'SELECT 1 FROM schema_migrations WHERE filename = $1',
        [filename]
      );
      if (rowCount > 0) {
        console.log(`Skipping (already applied): ${filename}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(SQL_DIR, filename), 'utf8');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)',
        [filename]
      );
      console.log(`Applied: ${filename}`);
    }

    console.log('All migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
