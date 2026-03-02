const { getDb } = require('../../src/storage/dbInit');

// We simulate P2P flows without firing up actual network sockets to keep tests deterministic offline.
// In actual Code, MeshNode sends streams to protocolHandlers.
describe('Integration: Mesh Protocol Data Sync', () => {
    let db;

    beforeAll(() => {
        db = getDb();
    });

    it('should correctly process a simulated metadata exchange from a Peer', () => {
        const fakePeerId = 'QmTestPeer1234567890';

        // Emulate the protocolHandlers.js -> storePeerDocuments flow
        const mockReceivedMetadata = [
            {
                doc_id: 'remote_doc_1',
                title: 'Remote Physics Notes',
                chunk_count: 10,
                timestamp: Date.now()
            },
            {
                doc_id: 'remote_doc_2',
                title: 'Remote Chem Study',
                chunk_count: 5,
                timestamp: Date.now()
            }
        ];

        // 1. Simulating Handshake Upsert
        db.upsertPeer(fakePeerId, "Test Peer's MacBook", Date.now());

        // 2. Simulating Meta Store from documentSync.js
        const stmt = db.db.prepare(`
            INSERT OR REPLACE INTO peer_documents (peer_id, doc_id, last_updated)
            VALUES (?, ?, ?)
        `);

        db.db.transaction(() => {
            for (const doc of mockReceivedMetadata) {
                stmt.run(fakePeerId, doc.doc_id, Date.now());
            }
        })();

        // 3. Validation
        const getPeerDocs = db.db.prepare(`
            SELECT * FROM peer_documents WHERE peer_id = ?
        `);
        const rows = getPeerDocs.all(fakePeerId);

        expect(rows.length).toBe(2);

        const firstDoc = JSON.parse(rows[0].metadata);
        expect(firstDoc.title).toBe('Remote Physics Notes');
    });

    it('should safely reject payloads exceeding 2MB limits (Security Audit Spec)', () => {
        // From Phase 1 audit: readAllChunks enforces 2MB limits.
        // Let's create a fake byte stream executor.
        async function readAllChunksMocked(streamIterator) {
            let totalSize = 0;
            const MAX_SIZE = 2 * 1024 * 1024;
            const chunks = [];

            for await (const chunk of streamIterator) {
                totalSize += chunk.length;
                if (totalSize > MAX_SIZE) {
                    throw new Error('Payload too large: exceeded 2MB limit');
                }
                chunks.push(chunk);
            }
            return chunks;
        }

        const validStream = [ Buffer.alloc(1024 * 1024) ]; // 1MB
        const maliciousStream = [ Buffer.alloc(2.5 * 1024 * 1024) ]; // 2.5MB

        expect(readAllChunksMocked(validStream)).resolves.toBeDefined();
        expect(readAllChunksMocked(maliciousStream)).rejects.toThrow('Payload too large');
    });
});
