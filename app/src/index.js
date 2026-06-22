const dotenv = require('dotenv');
const { app } = require('./application');

dotenv.config();

// ── Startup safety guards ────────────────────────────────────────────────────
// Fail fast rather than run with missing or insecure configuration.

const REQUIRED_ENV_VARS = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL'];
for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    console.error(`FATAL: Missing required environment variable: ${key}`);
    console.error('Copy .env.example to .env and fill in all required values.');
    process.exit(1);
  }
}

const WEAK_SECRET_PATTERNS = ['change-me', 'secret', 'changeme', 'your-secret', 'placeholder', 'example'];
const accessSecret = process.env.JWT_ACCESS_SECRET.toLowerCase();
const refreshSecret = process.env.JWT_REFRESH_SECRET.toLowerCase();
if (WEAK_SECRET_PATTERNS.some((w) => accessSecret.includes(w) || refreshSecret.includes(w))) {
  console.error('FATAL: JWT_ACCESS_SECRET or JWT_REFRESH_SECRET appears to be a placeholder value.');
  console.error('Generate strong secrets with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  process.exit(1);
}

if (process.env.JWT_ACCESS_SECRET.length < 32 || process.env.JWT_REFRESH_SECRET.length < 32) {
  console.error('FATAL: JWT secrets must be at least 32 characters long.');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────

const port = Number(process.env.PORT || 8080);

app.listen(port, () => {
  console.log(`Cortex backend listening on port ${port}`);
});
