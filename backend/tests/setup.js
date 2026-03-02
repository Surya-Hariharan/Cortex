const fs = require('fs');
const path = require('path');
const os = require('os');
const { initializeDatabase } = require('../src/storage/dbInit');
const { aiManager } = require('../src/ai/runtime/aiManager');

// Override data directory to use a temporary DB for tests
const originalDataDir = path.join(__dirname, '../../../data');
const testDataDir = path.join(os.tmpdir(), `cortex-test-${Date.now()}`);

// Global setup
beforeAll(async () => {
    // Override persistent paths
    process.env.TEST_DATA_DIR = testDataDir;

    // Initialize fresh database and storage for tests
    await initializeDatabase(testDataDir);

    // Setup AI (Mocking the heavy PhiRunner to prevent ESM loader requirements)
    if (aiManager.llmRunner) {
        aiManager.llmRunner.initialize = async () => { console.log('Mocked PhiRunner Node Load for Testing'); };
    }
    await aiManager.initialize();
});

// Global teardown
afterAll(async () => {
    // Clean up temporary database directory
    try {
        // Skip filesystem deletion because LanceDB and SQLite maintain Windows handles
        // fs.rmSync(testDataDir, { recursive: true, force: true });
        console.log('Skipping destructive teardown to prevent EPERM locks on Windows.');
    } catch (e) {
        console.error('Failed to clean up test directory:', e);
    }
});
