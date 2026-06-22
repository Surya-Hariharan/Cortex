// Environment variables set here run before any test module is loaded,
// so modules that read process.env at require-time get test values.
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-must-be-at-least-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-must-be-at-least-32-characters-long';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '7d';
process.env.BCRYPT_ROUNDS = '1';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/cortex_test';
