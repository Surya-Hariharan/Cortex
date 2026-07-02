const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
    test: {
        environment: 'node',
        env: {
            NODE_ENV: 'test',
            JWT_SECRET: 'test-only-secret-not-for-production',
        },
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
        },
    },
});
