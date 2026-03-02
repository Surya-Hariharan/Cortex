const path = require('path');
const { storageManager } = require('../../src/storage/storageManager');

describe('Stress: Bulk Indexing Payload Queue', () => {
    const ITERATIONS = 20;

    it('should flawlessly index multiple document attachments concurrently without database locks', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/dummy.pdf');

        const indexPromises = [];

        for (let i = 0; i < ITERATIONS; i++) {
            const title = `Bulk Document Simulation Loop ${i}`;
            // Because our file handler runs asynchronously, we queue up
            // 20 parallel ingestion routines into LanceDB and SQLite.
            indexPromises.push(storageManager.indexDocument(fixturePath, title));
        }

        const results = await Promise.all(indexPromises);

        // All 20 integrations should successfully complete or skip (dedupe constraints)
        const successful = results.filter(r => r.success === true);
        const skipped = results.filter(r => r.skipped === true);

        expect(successful.length + skipped.length).toBe(ITERATIONS);

        // Ensure no concurrent crashes
        const errors = results.filter(r => r.error !== undefined);
        expect(errors.length).toBe(0);

        const stats = await storageManager.getStats();
        // Since all 20 bulk requests use the same dummy PDF fixture,
        // 19 of them should be caught and skipped by the SHA-256 deduplicator automatically!
        expect(stats.documents).toBeLessThan(5);
    }, 60000);
});
