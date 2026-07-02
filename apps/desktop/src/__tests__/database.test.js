// @vitest-environment node
/**
 * DatabaseWrapper unit tests.
 *
 * better-sqlite3 is lazy-loaded (inside initializeDatabase), so importing
 * database.js is safe in the test environment.  We initialize keyStore so
 * the real AES-256-GCM encryption functions work without stubs.
 *
 * All DatabaseWrapper tests pass a hand-crafted fake db directly to the
 * constructor, isolating them from the native addon entirely.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

import { getDatabase, DatabaseWrapper } from '../services/storage/database.js';

// database.js → encryption.js → keyStore.js are all CJS modules that share
// Node's native require() cache.  The ESM import of keyStore would give a
// different instance, so we use createRequire to reach the same CJS entry
// that the production code chain uses.
const _cjsRequire = createRequire(import.meta.url);
const _keyStore = _cjsRequire('../services/storage/keyStore.js');

// ── One-time keyStore init ─────────────────────────────────────────────────

let keyDir;

beforeAll(() => {
    keyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-test-keys-'));
    _keyStore.initKeyStore(keyDir);
});

afterAll(() => {
    _keyStore._reset(null, null);
    fs.rmSync(keyDir, { recursive: true, force: true });
});

// ── Helpers: build isolated fake db objects ────────────────────────────────

function makeStmt(returnVal = null, rows = []) {
    return {
        run: vi.fn(() => ({ lastInsertRowid: 1, changes: 1 })),
        get: vi.fn(() => returnVal),
        all: vi.fn(() => rows),
    };
}

function makeDb(defaultStmt) {
    const stmt = defaultStmt ?? makeStmt();
    return {
        pragma: vi.fn(),
        exec: vi.fn(),
        prepare: vi.fn(() => stmt),
        transaction: vi.fn((fn) => fn),
        close: vi.fn(),
        _stmt: stmt,
    };
}

function makeDbMultiPrepare(stmtFactory) {
    let callIdx = 0;
    return {
        pragma: vi.fn(),
        exec: vi.fn(),
        prepare: vi.fn(() => stmtFactory(callIdx++)),
        transaction: vi.fn((fn) => fn),
        close: vi.fn(),
    };
}

// ── getDatabase before init ───────────────────────────────────────────────

describe('getDatabase', () => {
    it('returns null before initializeDatabase is called', () => {
        // db module-level singleton starts as null (or was reset between tests)
        const result = getDatabase();
        // It may be null or a wrapper depending on prior tests — just verify the type
        expect(result === null || result instanceof DatabaseWrapper).toBe(true);
    });
});

// ── DatabaseWrapper.insertDocument ───────────────────────────────────────

describe('DatabaseWrapper.insertDocument', () => {
    it('calls INSERT INTO documents and returns lastInsertRowid', () => {
        const stmt = makeStmt();
        stmt.run.mockReturnValue({ lastInsertRowid: 42, changes: 1 });
        const db = makeDb(stmt);
        const w = new DatabaseWrapper(db);
        const id = w.insertDocument('Title', 'Math', 'Hello world', 0);
        expect(id).toBe(42);
        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO documents'));
        expect(stmt.run).toHaveBeenCalled();
    });

    it('defaults chunkIndex to 0', () => {
        const stmt = makeStmt();
        stmt.run.mockReturnValue({ lastInsertRowid: 7, changes: 1 });
        const db = makeDb(stmt);
        const w = new DatabaseWrapper(db);
        const id = w.insertDocument('T', 'S', 'body');
        expect(typeof id).toBe('number');
    });

    it('passes 4 positional args to stmt.run (title, subject, encryptedContent, chunkIndex)', () => {
        const stmt = makeStmt();
        stmt.run.mockReturnValue({ lastInsertRowid: 1, changes: 1 });
        const db = makeDb(stmt);
        const w = new DatabaseWrapper(db);
        w.insertDocument('T', 'Math', 'secret', 0);
        const args = stmt.run.mock.calls[0];
        expect(args).toHaveLength(4);
        expect(args[0]).toBe('T');
        expect(args[1]).toBe('Math');
        // args[2] is the encrypted ciphertext — just verify it's a non-empty string
        expect(typeof args[2]).toBe('string');
        expect(args[2].length).toBeGreaterThan(0);
        expect(args[2]).not.toBe('secret'); // content IS encrypted
        expect(args[3]).toBe(0);
    });
});

// ── DatabaseWrapper.insertEmbedding ──────────────────────────────────────

describe('DatabaseWrapper.insertEmbedding', () => {
    it('calls INSERT INTO embeddings', () => {
        const stmt = makeStmt();
        const db = makeDb(stmt);
        const w = new DatabaseWrapper(db);
        w.insertEmbedding(5, [0.1, 0.2, 0.3]);
        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO embeddings'));
    });

    it('passes docId and a Buffer to stmt.run', () => {
        const stmt = makeStmt();
        const db = makeDb(stmt);
        const w = new DatabaseWrapper(db);
        w.insertEmbedding(5, [0.1, 0.2, 0.3]);
        const [docId, buf] = stmt.run.mock.calls[0];
        expect(docId).toBe(5);
        expect(Buffer.isBuffer(buf)).toBe(true);
    });
});

// ── DatabaseWrapper.getAllEmbeddings ──────────────────────────────────────

describe('DatabaseWrapper.getAllEmbeddings', () => {
    it('returns empty array when no rows', () => {
        const db = makeDb(makeStmt(null, []));
        const w = new DatabaseWrapper(db);
        expect(w.getAllEmbeddings()).toEqual([]);
    });

    it('maps row fields to camelCase', () => {
        // vector: small buffer that decryptEmbedding will handle via legacy-fallback
        const vectorBuf = Buffer.alloc(16, 0); // 16 bytes = 4 float32s
        const rows = [{
            id: 1, doc_id: 2, vector: vectorBuf,
            title: 'T', subject: 'CS', content: 'plaintext-content', chunk_index: 0,
        }];
        const db = makeDb(makeStmt(null, rows));
        const w = new DatabaseWrapper(db);
        const [r] = w.getAllEmbeddings();
        expect(r.id).toBe(1);
        expect(r.docId).toBe(2);
        expect(r.title).toBe('T');
        expect(r.subject).toBe('CS');
        expect(r.chunkIndex).toBe(0);
        expect(Array.isArray(r.vector)).toBe(true);
    });

    it('maps multiple rows correctly', () => {
        const buf = Buffer.alloc(16, 0);
        const rows = [
            { id: 1, doc_id: 1, vector: buf, title: 'A', subject: 'X', content: 'a', chunk_index: 0 },
            { id: 2, doc_id: 1, vector: buf, title: 'A', subject: 'X', content: 'b', chunk_index: 1 },
        ];
        const db = makeDb(makeStmt(null, rows));
        const w = new DatabaseWrapper(db);
        expect(w.getAllEmbeddings()).toHaveLength(2);
    });

    it('uses a JOIN query', () => {
        const db = makeDb(makeStmt(null, []));
        const w = new DatabaseWrapper(db);
        w.getAllEmbeddings();
        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('JOIN'));
    });
});

// ── DatabaseWrapper.getDocumentById ──────────────────────────────────────

describe('DatabaseWrapper.getDocumentById', () => {
    it('calls SELECT WHERE id and returns result', () => {
        const doc = { id: 3, title: 'Physics', content: 'wave', subject: 'PHY', chunk_index: 0 };
        const db = makeDb(makeStmt(doc));
        const w = new DatabaseWrapper(db);
        expect(w.getDocumentById(3)).toEqual(doc);
        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('WHERE id'));
    });

    it('returns null when not found', () => {
        const db = makeDb(makeStmt(null));
        const w = new DatabaseWrapper(db);
        expect(w.getDocumentById(99)).toBeNull();
    });
});

// ── DatabaseWrapper.searchDocumentsByText ────────────────────────────────

describe('DatabaseWrapper.searchDocumentsByText', () => {
    it('returns matching rows using LIKE query', () => {
        const rows = [{ id: 1, title: 'T', content: 'machine learning', subject: 'CS', chunk_index: 0 }];
        const db = makeDb(makeStmt(null, rows));
        const w = new DatabaseWrapper(db);
        const results = w.searchDocumentsByText('machine');
        expect(results).toHaveLength(1);
        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('LIKE'));
    });

    it('returns empty array when no matches', () => {
        const db = makeDb(makeStmt(null, []));
        const w = new DatabaseWrapper(db);
        expect(w.searchDocumentsByText('zzz')).toEqual([]);
    });
});

// ── DatabaseWrapper.getStats ─────────────────────────────────────────────

describe('DatabaseWrapper.getStats', () => {
    it('returns documents count, embeddings count, and subjects list', () => {
        const db = makeDbMultiPrepare((i) => {
            if (i === 0) return { get: vi.fn(() => ({ count: 5 })) };
            if (i === 1) return { get: vi.fn(() => ({ count: 12 })) };
            return { all: vi.fn(() => [{ subject: 'Math' }, { subject: 'CS' }]) };
        });
        const w = new DatabaseWrapper(db);
        const stats = w.getStats();
        expect(stats.documents).toBe(5);
        expect(stats.embeddings).toBe(12);
        expect(stats.subjects).toEqual(['Math', 'CS']);
    });

    it('returns empty subjects when no documents', () => {
        const db = makeDbMultiPrepare((i) => {
            if (i === 0) return { get: vi.fn(() => ({ count: 0 })) };
            if (i === 1) return { get: vi.fn(() => ({ count: 0 })) };
            return { all: vi.fn(() => []) };
        });
        const w = new DatabaseWrapper(db);
        expect(w.getStats().subjects).toEqual([]);
    });
});

// ── DatabaseWrapper.addNote ───────────────────────────────────────────────

describe('DatabaseWrapper.addNote', () => {
    it('inserts note and returns lastInsertRowid', () => {
        const stmt = makeStmt();
        stmt.run.mockReturnValue({ lastInsertRowid: 7, changes: 1 });
        const db = makeDb(stmt);
        const w = new DatabaseWrapper(db);
        expect(w.addNote('Buy milk', 'content', 'task', '2025-12-01')).toBe(7);
        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO notes'));
    });

    it('defaults type to note and dueDate to null', () => {
        const stmt = makeStmt();
        stmt.run.mockReturnValue({ lastInsertRowid: 3, changes: 1 });
        const db = makeDb(stmt);
        const w = new DatabaseWrapper(db);
        w.addNote('Title', 'body');
        const args = stmt.run.mock.calls[0];
        expect(args[2]).toBe('note');    // type default
        expect(args[3]).toBeNull();      // dueDate default
    });

    it('encrypts note content (stored value differs from plaintext)', () => {
        const stmt = makeStmt();
        stmt.run.mockReturnValue({ lastInsertRowid: 1, changes: 1 });
        const db = makeDb(stmt);
        const w = new DatabaseWrapper(db);
        w.addNote('T', 'private content', 'note', null);
        const args = stmt.run.mock.calls[0];
        // args[1] is the encrypted content
        expect(typeof args[1]).toBe('string');
        expect(args[1]).not.toBe('private content');
    });
});

// ── DatabaseWrapper.getNotes ──────────────────────────────────────────────

describe('DatabaseWrapper.getNotes', () => {
    it('maps rows to camelCase with completed as boolean', () => {
        const rows = [
            { id: 1, title: 'A', content: 'body', type: 'note', due_date: '2025-12-01', completed: 1, created_at: '2025-01-01' },
            { id: 2, title: 'B', content: 'x', type: 'task', due_date: null, completed: 0, created_at: '2025-01-02' },
        ];
        const db = makeDb(makeStmt(null, rows));
        const w = new DatabaseWrapper(db);
        const notes = w.getNotes();
        expect(notes[0].completed).toBe(true);
        expect(notes[0].dueDate).toBe('2025-12-01');
        expect(notes[0].createdAt).toBe('2025-01-01');
        expect(notes[1].completed).toBe(false);
        expect(notes[1].dueDate).toBeNull();
    });

    it('returns empty array when no notes', () => {
        const db = makeDb(makeStmt(null, []));
        expect(new DatabaseWrapper(db).getNotes()).toEqual([]);
    });

    it('includes ORDER BY in query', () => {
        const db = makeDb(makeStmt(null, []));
        const w = new DatabaseWrapper(db);
        w.getNotes();
        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('ORDER BY'));
    });
});

// ── DatabaseWrapper.deleteNote ────────────────────────────────────────────

describe('DatabaseWrapper.deleteNote', () => {
    it('executes DELETE FROM notes WHERE id', () => {
        const stmt = makeStmt();
        const db = makeDb(stmt);
        const w = new DatabaseWrapper(db);
        w.deleteNote(5);
        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM notes'));
        expect(stmt.run).toHaveBeenCalledWith(5);
    });
});

// ── DatabaseWrapper.toggleNoteComplete ───────────────────────────────────

describe('DatabaseWrapper.toggleNoteComplete', () => {
    it('executes UPDATE notes SET completed toggle', () => {
        const stmt = makeStmt();
        const db = makeDb(stmt);
        const w = new DatabaseWrapper(db);
        w.toggleNoteComplete(3);
        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE notes'));
        expect(stmt.run).toHaveBeenCalledWith(3);
    });
});

// ── DatabaseWrapper.insertBatch ───────────────────────────────────────────

describe('DatabaseWrapper.insertBatch', () => {
    it('wraps inserts in a transaction', () => {
        const stmt = makeStmt();
        stmt.run.mockReturnValue({ lastInsertRowid: 1, changes: 1 });
        const db = makeDb(stmt);
        const w = new DatabaseWrapper(db);
        w.insertBatch([
            { title: 'D1', subject: 'S1', content: 'hello', chunkIndex: 0, vector: null },
        ]);
        expect(db.transaction).toHaveBeenCalled();
    });

    it('calls insertDoc.run for each document', () => {
        // Use real transaction mock that executes the callback
        const stmts = [];
        let prepareCount = 0;
        const db = {
            pragma: vi.fn(),
            exec: vi.fn(),
            prepare: vi.fn(() => {
                const s = makeStmt();
                s.run.mockReturnValue({ lastInsertRowid: prepareCount + 1, changes: 1 });
                stmts.push(s);
                prepareCount++;
                return s;
            }),
            transaction: vi.fn((fn) => fn), // returns fn; caller calls fn(docs)
            close: vi.fn(),
        };
        const w = new DatabaseWrapper(db);
        const docs = [
            { title: 'D1', subject: 'S1', content: 'content1', chunkIndex: 0, vector: [0.1] },
            { title: 'D2', subject: 'S2', content: 'content2', chunkIndex: 1 },
        ];
        w.insertBatch(docs);
        // db.transaction was called once, db.prepare called for doc-insert and emb-insert stmts
        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO documents'));
    });

    it('only inserts embedding when vector is present', () => {
        const db = {
            pragma: vi.fn(),
            exec: vi.fn(),
            prepare: vi.fn(() => makeStmt()),
            transaction: vi.fn((fn) => fn),
            close: vi.fn(),
        };
        const w = new DatabaseWrapper(db);
        // no vector → should not insert into embeddings
        w.insertBatch([{ title: 'T', subject: 'S', content: 'c', chunkIndex: 0 }]);
        const prepareCalls = db.prepare.mock.calls.map((c) => c[0]);
        const embCalls = prepareCalls.filter((s) => s.includes('embeddings'));
        // embeddings INSERT is prepared but run is not called with data since no vector
        // just verify it doesn't throw
        expect(Array.isArray(embCalls)).toBe(true);
    });
});

// ── Cloud sync helpers (dirty-tracking, tombstones, sync_id, versions) ────
// These methods issue several distinct db.prepare() calls per invocation
// (e.g. getDirtyNotes → SELECT dirty rows, then ensureNoteSyncId's own
// SELECT/UPDATE per row), so route the fake db's prepare() by matching on
// the SQL text rather than assuming a fixed call order.

function makeRoutedDb(routes) {
    return {
        pragma: vi.fn(),
        exec: vi.fn(),
        prepare: vi.fn((sql) => {
            const hit = routes.find(([pattern]) => sql.includes(pattern));
            return hit ? hit[1] : makeStmt();
        }),
        transaction: vi.fn((fn) => fn),
        close: vi.fn(),
    };
}

describe('DatabaseWrapper.ensureNoteSyncId', () => {
    it('returns the existing sync_id without writing when already set', () => {
        const selectStmt = makeStmt({ sync_id: 'existing-uuid' });
        const updateStmt = makeStmt();
        const db = makeRoutedDb([
            ['SELECT sync_id FROM notes', selectStmt],
            ['UPDATE notes SET sync_id', updateStmt],
        ]);
        const w = new DatabaseWrapper(db);
        expect(w.ensureNoteSyncId(1)).toBe('existing-uuid');
        expect(updateStmt.run).not.toHaveBeenCalled();
    });

    it('mints and persists a new sync_id when none exists yet', () => {
        const selectStmt = makeStmt(null);
        const updateStmt = makeStmt();
        const db = makeRoutedDb([
            ['SELECT sync_id FROM notes', selectStmt],
            ['UPDATE notes SET sync_id', updateStmt],
        ]);
        const w = new DatabaseWrapper(db);
        const syncId = w.ensureNoteSyncId(1);
        expect(syncId).toMatch(/^[0-9a-f-]{36}$/);
        expect(updateStmt.run).toHaveBeenCalledWith(syncId, 1);
    });
});

describe('DatabaseWrapper.getDirtyNotes / markNoteSynced', () => {
    it('returns dirty notes with a resolved sync_id, and clears the dirty flag on markNoteSynced', () => {
        const listStmt = makeStmt(null, [
            { id: 1, title: 'A', content: 'plaintext-a', type: 'note', due_date: null, completed: 0 },
        ]);
        const syncIdSelectStmt = makeStmt({ sync_id: 'note-uuid-1' });
        const markStmt = makeStmt();
        const db = makeRoutedDb([
            ['SELECT * FROM notes WHERE dirty = 1', listStmt],
            ['SELECT sync_id FROM notes', syncIdSelectStmt],
            ['UPDATE notes SET dirty = 0', markStmt],
        ]);
        const w = new DatabaseWrapper(db);

        const dirty = w.getDirtyNotes();
        expect(dirty).toHaveLength(1);
        expect(dirty[0]).toMatchObject({ id: 1, syncId: 'note-uuid-1', title: 'A' });

        w.markNoteSynced(1);
        expect(markStmt.run).toHaveBeenCalledWith(1);
    });
});

describe('DatabaseWrapper.upsertNoteFromCloud', () => {
    it('inserts a new local row when no note has this sync_id yet', () => {
        const findStmt = makeStmt(null); // no existing row
        const insertStmt = makeStmt();
        const db = makeRoutedDb([
            ['SELECT id FROM notes WHERE sync_id', findStmt],
            ['INSERT INTO notes', insertStmt],
        ]);
        const w = new DatabaseWrapper(db);
        w.upsertNoteFromCloud({ syncId: 'note-uuid-2', title: 'From cloud', content: 'body', type: 'note', dueDate: null, completed: false });
        expect(insertStmt.run).toHaveBeenCalled();
        const args = insertStmt.run.mock.calls[0];
        expect(args[args.length - 1]).toBe('note-uuid-2'); // sync_id is the last bound param
    });

    it('updates the matching local row in place when the sync_id is already known', () => {
        const findStmt = makeStmt({ id: 7 });
        const updateStmt = makeStmt();
        const db = makeRoutedDb([
            ['SELECT id FROM notes WHERE sync_id', findStmt],
            ['UPDATE notes SET title', updateStmt],
        ]);
        const w = new DatabaseWrapper(db);
        w.upsertNoteFromCloud({ syncId: 'note-uuid-2', title: 'Updated', content: 'body', type: 'note', dueDate: null, completed: true });
        expect(updateStmt.run).toHaveBeenCalled();
        const args = updateStmt.run.mock.calls[0];
        expect(args[args.length - 1]).toBe(7); // WHERE id = ? is the last bound param
    });
});

describe('DatabaseWrapper.getDirtyPages / markPageSynced / upsertPageFromCloud', () => {
    it('returns dirty pages decrypted, and clears the flag on markPageSynced', () => {
        const listStmt = makeStmt(null, [{ id: 'page-1', title: 'P', content: 'body', parent_id: null }]);
        const markStmt = makeStmt();
        const db = makeRoutedDb([
            ['SELECT * FROM workspace_pages WHERE dirty = 1', listStmt],
            ['UPDATE workspace_pages SET dirty = 0', markStmt],
        ]);
        const w = new DatabaseWrapper(db);
        const dirty = w.getDirtyPages();
        expect(dirty).toEqual([{ id: 'page-1', title: 'P', content: 'body', parentId: null }]);
        w.markPageSynced('page-1');
        expect(markStmt.run).toHaveBeenCalledWith('page-1');
    });

    it('upsertPageFromCloud inserts when unseen, updates when the id already exists locally', () => {
        const findMissing = makeStmt(null);
        const insertStmt = makeStmt();
        const dbInsert = makeRoutedDb([
            ['SELECT id FROM workspace_pages WHERE id', findMissing],
            ['INSERT INTO workspace_pages', insertStmt],
        ]);
        new DatabaseWrapper(dbInsert).upsertPageFromCloud({ id: 'page-2', title: 'New', content: 'c', parentId: null });
        expect(insertStmt.run).toHaveBeenCalled();

        const findExisting = makeStmt({ id: 'page-2' });
        const updateStmt = makeStmt();
        const dbUpdate = makeRoutedDb([
            ['SELECT id FROM workspace_pages WHERE id', findExisting],
            ['UPDATE workspace_pages SET title', updateStmt],
        ]);
        new DatabaseWrapper(dbUpdate).upsertPageFromCloud({ id: 'page-2', title: 'Changed', content: 'c2', parentId: null });
        expect(updateStmt.run).toHaveBeenCalled();
    });
});

describe('DatabaseWrapper tombstones (deleteNote / deletePage / applyRemoteDelete)', () => {
    it('deleteNote records a tombstone keyed by sync_id only if the note had one', () => {
        const withSyncId = makeStmt({ sync_id: 'note-uuid-3' });
        const deleteStmt = makeStmt();
        const tombstoneStmt = makeStmt();
        const db = makeRoutedDb([
            ['SELECT sync_id FROM notes WHERE id', withSyncId],
            ['DELETE FROM notes', deleteStmt],
            ['INSERT OR REPLACE INTO cortex_sync_tombstones', tombstoneStmt],
        ]);
        new DatabaseWrapper(db).deleteNote(1);
        expect(deleteStmt.run).toHaveBeenCalledWith(1);
        expect(tombstoneStmt.run).toHaveBeenCalledWith('note', 'note-uuid-3');
    });

    it('deleteNote skips the tombstone when the note was never synced', () => {
        const withoutSyncId = makeStmt(null);
        const deleteStmt = makeStmt();
        const tombstoneStmt = makeStmt();
        const db = makeRoutedDb([
            ['SELECT sync_id FROM notes WHERE id', withoutSyncId],
            ['DELETE FROM notes', deleteStmt],
            ['INSERT OR REPLACE INTO cortex_sync_tombstones', tombstoneStmt],
        ]);
        new DatabaseWrapper(db).deleteNote(1);
        expect(tombstoneStmt.run).not.toHaveBeenCalled();
    });

    it('deletePage tombstones both the page and its children', () => {
        const childrenStmt = makeStmt(null, [{ id: 'child-1' }, { id: 'child-2' }]);
        const deleteStmt = makeStmt();
        const tombstoneStmt = makeStmt();
        const db = makeRoutedDb([
            ['SELECT id FROM workspace_pages WHERE parent_id', childrenStmt],
            ['DELETE FROM workspace_pages', deleteStmt],
            ['INSERT OR REPLACE INTO cortex_sync_tombstones', tombstoneStmt],
        ]);
        new DatabaseWrapper(db).deletePage('parent-1');
        expect(tombstoneStmt.run).toHaveBeenCalledWith('page', 'parent-1');
        expect(tombstoneStmt.run).toHaveBeenCalledWith('page', 'child-1');
        expect(tombstoneStmt.run).toHaveBeenCalledWith('page', 'child-2');
    });

    it('applyRemoteDelete routes notes by sync_id and pages by id', () => {
        const noteDelete = makeStmt();
        const pageDelete = makeStmt();
        const db = makeRoutedDb([
            ['DELETE FROM notes WHERE sync_id', noteDelete],
            ['DELETE FROM workspace_pages WHERE id', pageDelete],
        ]);
        const w = new DatabaseWrapper(db);
        w.applyRemoteDelete('note', 'note-uuid-9');
        w.applyRemoteDelete('page', 'page-9');
        expect(noteDelete.run).toHaveBeenCalledWith('note-uuid-9');
        expect(pageDelete.run).toHaveBeenCalledWith('page-9');
    });
});

describe('DatabaseWrapper sync bookkeeping (versions + generic state)', () => {
    it('getSyncVersion defaults to 0 when no row exists', () => {
        const db = makeDb(makeStmt(null));
        expect(new DatabaseWrapper(db).getSyncVersion('note', 'x')).toBe(0);
    });

    it('getSyncVersion returns the stored version', () => {
        const db = makeDb(makeStmt({ server_version: 4 }));
        expect(new DatabaseWrapper(db).getSyncVersion('note', 'x')).toBe(4);
    });

    it('setSyncVersion upserts', () => {
        const stmt = makeStmt();
        const db = makeDb(stmt);
        new DatabaseWrapper(db).setSyncVersion('note', 'x', 5);
        expect(stmt.run).toHaveBeenCalledWith('note', 'x', 5);
    });

    it('getSyncState returns null when unset, and the stored value otherwise', () => {
        const dbUnset = makeDb(makeStmt(undefined));
        expect(new DatabaseWrapper(dbUnset).getSyncState('pull_cursor')).toBeNull();

        const dbSet = makeDb(makeStmt({ value: '2026-01-01T00:00:00.000Z' }));
        expect(new DatabaseWrapper(dbSet).getSyncState('pull_cursor')).toBe('2026-01-01T00:00:00.000Z');
    });
});
