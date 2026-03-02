const fs = require('fs');
const path = require('path');
const { initializeDatabase, getDb } = require('../../src/storage/dbInit');

describe('Integration: Database Corruption & Safe Recovery', () => {
    let dbPath;

    beforeAll(() => {
        dbPath = path.join(process.env.TEST_DATA_DIR, 'cortex.db');
    });

    it('should cleanly rebuild missing tables if accidentally deleted', async () => {
        let db = getDb();

        // Simulate a manual DB intervention or corruption
        db.db.exec(`DROP TABLE IF EXISTS sessions`);

        // Close the connection explicitly
        db.db.close();

        // Trigger the orchestrator's boot sequence again
        await initializeDatabase(process.env.TEST_DATA_DIR);
        db = getDb();

        // Verify the table was recreated automatically by migrations/schema initialization
        const checkStmt = db.db.prepare(`
            SELECT name FROM sqlite_master WHERE type='table' AND name='sessions';
        `);
        const result = checkStmt.get();
        expect(result).toBeDefined();
        expect(result.name).toBe('sessions');
    });

    it('should handle schema_version missing and fallback gracefully', async () => {
        let db = getDb();

        // Nuke the migration tracking table mapping versioning
        db.db.exec(`DROP TABLE IF EXISTS schema_version`);

        db.close();

        // Re-booting should detect missing schema_version and run standard v1 -> v2 creation maps
        await initializeDatabase(process.env.TEST_DATA_DIR);
        db = getDb();

        // Verify it was re-established
        const checkStmt = db.db.prepare(`
            SELECT version FROM schema_version WHERE id = 'db_schema_version'
        `);
        const result = checkStmt.get();

        expect(result.version).toBe(2);
    });
});
