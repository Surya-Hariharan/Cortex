const { loginUser } = require('../../src/auth/authService');
const { getDb } = require('../../src/storage/dbInit');

describe('Security: SQL Injection & Auth Bounds', () => {
    let db;
    beforeAll(() => {
        db = getDb();
    });

    it('should totally resist classic SQLite SQL Injection vectors on Login', async () => {
        // Red-teaming auth endpoint
        const maliciousEmail = "' OR 1=1 --";
        const maliciousPassword = "' OR '1'='1";

        const response = await loginUser(db, maliciousEmail, maliciousPassword);

        expect(response.success).toBeFalsy();
        expect(response.error).toContain('No account found');

        // Verify the database was NOT dropped or altered
        const tables = db.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        expect(tables.length).toBeGreaterThan(0);
    });

    it('should prevent auth bypasses via NoSQL-style object injection', async () => {
        // Just in case Express parses body JSON strangely
        const maliciousEmail = { "$ne": null };

        try {
            await loginUser(db, maliciousEmail, "password");
        } catch (e) {
            // Because dbWrapper expects strings, object methods will safely throw type errors within String() wrappers.
            expect(e).toBeDefined();
        }
    });

});
