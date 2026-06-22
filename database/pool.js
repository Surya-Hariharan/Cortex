const path = require('path');
const { createRequire } = require('module');
const dotenv = require('dotenv');

const requireFromApp = createRequire(path.resolve(__dirname, '../../app/package.json'));

let Pool;
try {
  ({ Pool } = require('pg'));
} catch {
  ({ Pool } = requireFromApp('pg'));
}

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = { pool };
