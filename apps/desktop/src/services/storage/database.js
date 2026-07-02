const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { encryptText, decryptText, encryptEmbedding, decryptEmbedding } = require('./encryption');

let db = null;

/**
 * Initialize SQLite database with schema
 */
function initializeDatabase(dbPath) {
    // Lazy-load the native addon so the module can be imported in test environments
    // where the Electron-compiled binary is unavailable.
    const Database = require('better-sqlite3');

    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(dbPath);

    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');

    // Create tables
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subject TEXT DEFAULT 'General',
      content TEXT NOT NULL,
      chunk_index INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_id INTEGER NOT NULL,
      vector BLOB NOT NULL,
      FOREIGN KEY (doc_id) REFERENCES documents(id)
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      type TEXT DEFAULT 'note',
      due_date TEXT DEFAULT NULL,
      completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workspace_pages (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT,
      parent_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Deletions of dirty-tracked rows (notes/pages, below) can't carry a
    -- "dirty" flag once the row is gone, so a pending cloud-sync deletion is
    -- recorded here instead until syncEngine.js confirms it reached the
    -- server (see markTombstoneSynced). resource_id is the note's sync_id
    -- (see notes.sync_id) or the page's own id.
    CREATE TABLE IF NOT EXISTS cortex_sync_tombstones (
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      synced INTEGER DEFAULT 0,
      PRIMARY KEY (resource_type, resource_id)
    );

    -- The server's sync_blobs uses optimistic concurrency keyed by a
    -- baseVersion the client must supply on every push (see
    -- apps/server/src/repositories/sync.repository.js upsertBlob). This is
    -- this device's last-known server_version per resource, updated after
    -- every successful push or pull.
    CREATE TABLE IF NOT EXISTS cortex_sync_versions (
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      server_version INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (resource_type, resource_id)
    );

    -- Small generic key/value store for sync-engine bookkeeping that doesn't
    -- fit the tables above — currently just the incremental-pull cursor.
    CREATE TABLE IF NOT EXISTS cortex_sync_state (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_documents_subject ON documents(subject);
    CREATE INDEX IF NOT EXISTS idx_embeddings_doc_id ON embeddings(doc_id);
  `);

    // Additive columns for optional cloud sync — better-sqlite3 has no
    // "ALTER TABLE ... ADD COLUMN IF NOT EXISTS", so guard with a
    // column-existence check (keeps this idempotent across app restarts).
    const ensureColumn = (table, column, ddl) => {
        const cols = db.prepare(`PRAGMA table_info(${table})`).all();
        if (!cols.some((c) => c.name === column)) {
            db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
        }
    };
    // dirty = 1 means "not yet pushed to the cloud." Defaults to 1 so
    // pre-existing local data is picked up automatically the first time
    // cloud sync is enabled.
    ensureColumn('notes', 'dirty', 'dirty INTEGER NOT NULL DEFAULT 1');
    // notes.id is a per-device AUTOINCREMENT integer — not safe to use as a
    // cross-device sync identity (two offline devices can both mint "note
    // #7"). sync_id is a UUID assigned lazily the first time a note is
    // synced (see ensureNoteSyncId) and is what actually travels to the
    // server as sync_blobs.resource_id. workspace_pages.id is already a
    // client-generated stable id, so pages don't need an equivalent column.
    ensureColumn('notes', 'sync_id', 'sync_id TEXT');
    ensureColumn('workspace_pages', 'dirty', 'dirty INTEGER NOT NULL DEFAULT 1');

    return db;
}

function getDatabase() {
    return db ? new DatabaseWrapper(db) : null;
}

class DatabaseWrapper {
    constructor(database) {
        this.db = database;
    }

    insertDocument(title, subject, content, chunkIndex = 0) {
        const stmt = this.db.prepare(
            'INSERT INTO documents (title, subject, content, chunk_index) VALUES (?, ?, ?, ?)'
        );
        const result = stmt.run(title, subject, encryptText(content), chunkIndex);
        return result.lastInsertRowid;
    }

    // ── Users ─────────────────────────────────────────────────────────────

    createUser(email, passwordHash, fullName) {
        const stmt = this.db.prepare(
            'INSERT INTO users (email, password_hash, full_name) VALUES (?, ?, ?)'
        );
        const result = stmt.run(email, passwordHash, fullName);
        return result.lastInsertRowid;
    }

    getUserByEmail(email) {
        return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    }

    insertEmbedding(docId, vector) {
        const buffer = encryptEmbedding(vector);
        const stmt = this.db.prepare(
            'INSERT INTO embeddings (doc_id, vector) VALUES (?, ?)'
        );
        stmt.run(docId, buffer);
    }

    getAllEmbeddings() {
        const rows = this.db.prepare(`
      SELECT e.id, e.doc_id, e.vector, d.title, d.subject, d.content, d.chunk_index
      FROM embeddings e
      JOIN documents d ON e.doc_id = d.id
    `).all();

        return rows.map((row) => ({
            id: row.id,
            docId: row.doc_id,
            vector: decryptEmbedding(row.vector),
            title: row.title,
            subject: row.subject,
            content: decryptText(row.content),
            chunkIndex: row.chunk_index,
        }));
    }

    getDocumentById(docId) {
        return this.db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
    }

    searchDocumentsByText(query) {
        return this.db.prepare(
            'SELECT * FROM documents WHERE content LIKE ? LIMIT 20'
        ).all(`%${query}%`);
    }

    getStats() {
        const docCount = this.db.prepare('SELECT COUNT(*) as count FROM documents').get();
        const embCount = this.db.prepare('SELECT COUNT(*) as count FROM embeddings').get();
        const subjects = this.db.prepare('SELECT DISTINCT subject FROM documents').all();
        return {
            documents: docCount.count,
            embeddings: embCount.count,
            subjects: subjects.map((s) => s.subject),
        };
    }

    // Bulk insert for setup script
    insertBatch(documents) {
        const insertDoc = this.db.prepare(
            'INSERT INTO documents (title, subject, content, chunk_index) VALUES (?, ?, ?, ?)'
        );
        const insertEmb = this.db.prepare(
            'INSERT INTO embeddings (doc_id, vector) VALUES (?, ?)'
        );

        const transaction = this.db.transaction((docs) => {
            for (const doc of docs) {
                const result = insertDoc.run(doc.title, doc.subject, encryptText(doc.content), doc.chunkIndex || 0);
                if (doc.vector) {
                    const buffer = encryptEmbedding(doc.vector);
                    insertEmb.run(result.lastInsertRowid, buffer);
                }
            }
        });

        transaction(documents);
    }

    // ── Notes & Deadlines ─────────────────────────────────────────────────

    addNote(title, content, type = 'note', dueDate = null) {
        const stmt = this.db.prepare(
            'INSERT INTO notes (title, content, type, due_date) VALUES (?, ?, ?, ?)'
        );
        const result = stmt.run(title, encryptText(content), type, dueDate);
        return result.lastInsertRowid;
    }

    getNotes() {
        const rows = this.db.prepare(
            'SELECT * FROM notes ORDER BY completed ASC, due_date ASC, created_at DESC'
        ).all();
        return rows.map((r) => ({
            id: r.id,
            title: r.title,
            content: decryptText(r.content),
            type: r.type,
            dueDate: r.due_date,
            completed: !!r.completed,
            createdAt: r.created_at,
        }));
    }

    deleteNote(id) {
        const row = this.db.prepare('SELECT sync_id FROM notes WHERE id = ?').get(id);
        this.db.prepare('DELETE FROM notes WHERE id = ?').run(id);
        if (row?.sync_id) this.recordTombstone('note', row.sync_id);
    }

    toggleNoteComplete(id) {
        this.db.prepare('UPDATE notes SET completed = CASE WHEN completed = 0 THEN 1 ELSE 0 END, dirty = 1 WHERE id = ?').run(id);
    }

    // ── Workspace Pages ───────────────────────────────────────────────────

    createPage(id, title, content = '{}', parentId = null) {
        const stmt = this.db.prepare(
            'INSERT INTO workspace_pages (id, title, content, parent_id) VALUES (?, ?, ?, ?)'
        );
        stmt.run(id, title, encryptText(content), parentId);
        return id;
    }

    updatePage(id, title, content) {
        const stmt = this.db.prepare(
            'UPDATE workspace_pages SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP, dirty = 1 WHERE id = ?'
        );
        stmt.run(title, encryptText(content), id);
    }

    getPage(id) {
        const row = this.db.prepare('SELECT * FROM workspace_pages WHERE id = ?').get(id);
        if (!row) return null;
        return {
            id: row.id,
            title: row.title,
            content: decryptText(row.content),
            parentId: row.parent_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    getPages() {
        const rows = this.db.prepare('SELECT id, title, parent_id, created_at, updated_at FROM workspace_pages ORDER BY created_at DESC').all();
        return rows.map(r => ({
            id: r.id,
            title: r.title,
            parentId: r.parent_id,
            createdAt: r.created_at,
            updatedAt: r.updated_at
        }));
    }

    deletePage(id) {
        const children = this.db.prepare('SELECT id FROM workspace_pages WHERE parent_id = ?').all(id);
        this.db.prepare('DELETE FROM workspace_pages WHERE id = ?').run(id);
        // Also delete children (naive implementation for now, Phase 7 can expand)
        this.db.prepare('DELETE FROM workspace_pages WHERE parent_id = ?').run(id);
        this.recordTombstone('page', id);
        children.forEach((c) => this.recordTombstone('page', c.id));
    }

    // ── Optional cloud sync (dirty-tracking + tombstones) ────────────────
    // Used only by services/cloud/syncEngine.js — every method here is a
    // no-op from the local-first app's point of view when cloud sync is
    // disabled, since nothing calls them.

    ensureNoteSyncId(id) {
        const row = this.db.prepare('SELECT sync_id FROM notes WHERE id = ?').get(id);
        if (row?.sync_id) return row.sync_id;
        const syncId = crypto.randomUUID();
        this.db.prepare('UPDATE notes SET sync_id = ? WHERE id = ?').run(syncId, id);
        return syncId;
    }

    getDirtyNotes() {
        return this.db.prepare('SELECT * FROM notes WHERE dirty = 1').all().map((r) => ({
            id: r.id,
            syncId: this.ensureNoteSyncId(r.id),
            title: r.title,
            content: decryptText(r.content),
            type: r.type,
            dueDate: r.due_date,
            completed: !!r.completed,
        }));
    }

    markNoteSynced(id) {
        this.db.prepare('UPDATE notes SET dirty = 0 WHERE id = ?').run(id);
    }

    upsertNoteFromCloud({ syncId, title, content, type, dueDate, completed }) {
        const existing = this.db.prepare('SELECT id FROM notes WHERE sync_id = ?').get(syncId);
        if (existing) {
            this.db.prepare(
                'UPDATE notes SET title = ?, content = ?, type = ?, due_date = ?, completed = ?, dirty = 0 WHERE id = ?'
            ).run(title, encryptText(content), type, dueDate, completed ? 1 : 0, existing.id);
        } else {
            this.db.prepare(
                'INSERT INTO notes (title, content, type, due_date, completed, dirty, sync_id) VALUES (?, ?, ?, ?, ?, 0, ?)'
            ).run(title, encryptText(content), type, dueDate, completed ? 1 : 0, syncId);
        }
    }

    getDirtyPages() {
        return this.db.prepare('SELECT * FROM workspace_pages WHERE dirty = 1').all().map((r) => ({
            id: r.id,
            title: r.title,
            content: decryptText(r.content),
            parentId: r.parent_id,
        }));
    }

    markPageSynced(id) {
        this.db.prepare('UPDATE workspace_pages SET dirty = 0 WHERE id = ?').run(id);
    }

    upsertPageFromCloud({ id, title, content, parentId }) {
        const existing = this.db.prepare('SELECT id FROM workspace_pages WHERE id = ?').get(id);
        if (existing) {
            this.db.prepare(
                'UPDATE workspace_pages SET title = ?, content = ?, parent_id = ?, dirty = 0 WHERE id = ?'
            ).run(title, encryptText(content), parentId, id);
        } else {
            this.db.prepare(
                'INSERT INTO workspace_pages (id, title, content, parent_id, dirty) VALUES (?, ?, ?, ?, 0)'
            ).run(id, title, encryptText(content), parentId);
        }
    }

    applyRemoteDelete(resourceType, resourceId) {
        if (resourceType === 'note') {
            this.db.prepare('DELETE FROM notes WHERE sync_id = ?').run(resourceId);
        } else if (resourceType === 'page') {
            this.db.prepare('DELETE FROM workspace_pages WHERE id = ?').run(resourceId);
        }
    }

    recordTombstone(resourceType, resourceId) {
        this.db.prepare(
            'INSERT OR REPLACE INTO cortex_sync_tombstones (resource_type, resource_id, deleted_at, synced) VALUES (?, ?, CURRENT_TIMESTAMP, 0)'
        ).run(resourceType, resourceId);
    }

    getPendingTombstones() {
        return this.db.prepare('SELECT * FROM cortex_sync_tombstones WHERE synced = 0').all();
    }

    markTombstoneSynced(resourceType, resourceId) {
        this.db.prepare(
            'UPDATE cortex_sync_tombstones SET synced = 1 WHERE resource_type = ? AND resource_id = ?'
        ).run(resourceType, resourceId);
    }

    getSyncVersion(resourceType, resourceId) {
        const row = this.db.prepare(
            'SELECT server_version FROM cortex_sync_versions WHERE resource_type = ? AND resource_id = ?'
        ).get(resourceType, resourceId);
        return row ? row.server_version : 0;
    }

    setSyncVersion(resourceType, resourceId, serverVersion) {
        this.db.prepare(
            `INSERT INTO cortex_sync_versions (resource_type, resource_id, server_version) VALUES (?, ?, ?)
             ON CONFLICT (resource_type, resource_id) DO UPDATE SET server_version = excluded.server_version`
        ).run(resourceType, resourceId, serverVersion);
    }

    getSyncState(key) {
        return this.db.prepare('SELECT value FROM cortex_sync_state WHERE key = ?').get(key)?.value ?? null;
    }

    setSyncState(key, value) {
        this.db.prepare(
            `INSERT INTO cortex_sync_state (key, value) VALUES (?, ?)
             ON CONFLICT (key) DO UPDATE SET value = excluded.value`
        ).run(key, value);
    }
}

module.exports = { initializeDatabase, getDatabase, DatabaseWrapper };
