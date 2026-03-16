const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db/pool');

async function runMigrations() {
  const client = await pool.connect();
  try {
    const migrationPath = path.join(__dirname, '..', 'sql', '001_init_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await client.query(sql);
    console.log('Migration applied: 001_init_schema.sql');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
