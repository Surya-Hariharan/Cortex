const { getDb } = require('../../src/storage/dbInit');
const { generateChunkId } = require('../../src/storage/hashUtils');

describe('Storage Layer: dbWrapper & Hash Utils', () => {
    let db;

    beforeAll(() => {
        db = getDb();
    });

    it('should initialize successfully with SCHEMA_VERSION = 2', () => {
        const schemaVer = db.db.prepare("SELECT version FROM schema_version ORDER BY id DESC LIMIT 1").get();
        expect(schemaVer.version).toBe('v2');
    });

    it('should deterministically generate Chunk IDs', () => {
        const text = 'Stable deterministic hashing for deduplication.';
        const hash1 = generateChunkId(text);
        const hash2 = generateChunkId(text);
        expect(hash1).toEqual(hash2);
    });

    it('should deduplicate documents successfully based on hash', () => {
        const fakeHash = 'dedupe_hash_123';

        // Emulate DB document persistence manually to test constraints
        const docStmt = db.db.prepare(`
            INSERT OR IGNORE INTO documents (doc_id, title, file_hash, processed, timestamp)
            VALUES (?, ?, ?, 1, ?)
        `);

        const res1 = docStmt.run('doc_1', 'Test Document', fakeHash, Date.now());
        const res2 = docStmt.run('doc_2', 'Duplicate Document', fakeHash, Date.now());

        expect(res1.changes).toBe(1); // First goes through
        expect(res2.changes).toBe(0); // Second is ignored due to UNIQUE constraint on file_hash
    });
});
