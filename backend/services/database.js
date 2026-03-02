const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { encryptText, decryptText, encryptEmbedding, decryptEmbedding } = require('./encryption');
const { storageManager } = require('./storage/storageManager');

let db = null;

/**
 * Initialize SQLite database with schema
 * 
 * NOTE: Phase 2D+ uses storageManager for vector operations.
 * This function now initializes the new storage architecture.
 */
async function initializeDatabase(dbPath) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Initialize new storage architecture (Phase 2D)
    await storageManager.initialize(dir);

    // Keep legacy SQLite reference for non-vector operations
    db = new Database(dbPath);

    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');

    // Create tables
    db.exec(`
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

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER DEFAULT NULL,
      title TEXT NOT NULL DEFAULT 'New Chat',
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user','assistant')),
      content TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_documents_subject ON documents(subject);
    CREATE INDEX IF NOT EXISTS idx_embeddings_doc_id ON embeddings(doc_id);
    CREATE INDEX IF NOT EXISTS idx_chats_project ON chats(project_id);
    CREATE INDEX IF NOT EXISTS idx_messages_chat ON chat_messages(chat_id);

    -- Mesh network tables for peer-to-peer functionality
    CREATE TABLE IF NOT EXISTS mesh_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS peers (
      peer_id TEXT PRIMARY KEY,
      device_name TEXT NOT NULL,
      last_seen INTEGER NOT NULL,
      doc_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS peer_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      peer_id TEXT NOT NULL,
      doc_id TEXT NOT NULL,
      title TEXT NOT NULL,
      subject TEXT DEFAULT 'Unknown',
      chunk_count INTEGER DEFAULT 0,
      last_modified INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (peer_id) REFERENCES peers(peer_id) ON DELETE CASCADE,
      UNIQUE(peer_id, doc_id)
    );

/**
 * Get database wrapper
 * 
 * NOTE: Phase 2D+ - Returns compatibility wrapper that delegates
 * document/vector operations to storageManager.
 */
function getDatabase() {
    return db ? new DatabaseWrapper(db) : null;
}

/**
/**
 * Database Wrapper - Phase 2D Compatibility Layer
 * 
 * Maintains backward compatibility while delegating to new storage architecture.
 * 
 * Legacy Methods (deprecated):
 * - insertDocument() → use storageManager.indexDocument()
 * - insertEmbedding() → handled automatically by indexer
 * - getAllEmbeddings() → use storageManager.search()
 * 
 * Active Methods (forwarded to storageManager):
 * - Notes, Projects, Chats, Mesh operations
 */
class DatabaseWrapper {
    constructor(database) {
        this.db = database;
        this.storageManager = storageManager;
    }

    // ================= Legacy Document/Embedding Methods (Deprecated) =================

    /**
     * @deprecated Use storageManager.indexDocument() instead
     */
    insertDocument(title, subject, content, chunkIndex = 0) {
        console.warn('[Database] insertDocument() is deprecated. Use storageManager.indexDocument()');
        
        // For backward compatibility, store in legacy format
        const stmt = this.db.prepare(
            'INSERT INTO documents (title, subject, content, chunk_index) VALUES (?, ?, ?, ?)'
        );
        const result = stmt.run(title, subject, encryptText(content), chunkIndex);
        return result.lastInsertRowid;
    }

    /**
     * @deprecated Embeddings are now handled by storageManager automatically
     */
    insertEmbedding(docId, vector) {
        console.warn('[Database] insertEmbedding() is deprecated. Handled automatically by indexer.');
        
        // For backward compatibility, store in legacy format
        const buffer = encryptEmbedding(vector);
        const stmt = this.db.prepare(
            'INSERT INTO embeddings (doc_id, vector) VALUES (?, ?)'
        );
        stmt.run(docId, buffer);
    }

    /**
     * Get all embeddings (compatibility mode)
     * @deprecated Use storageManager.search() for efficient queries
     */
    getAllEmbeddings() {
        console.warn('[Database] getAllEmbeddings() is deprecated. Use storageManager.search() instead.');
        
        // Delegate to storage manager (returns new format)
        return this.storageManager.getAllEmbeddings();
    }

    /**
     * @deprecated Use storageManager.getDocument()
     */
    getDocumentById(docId) {
        return this.db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
    }

    /**
     * @deprecated Use storageManager metadata search
     */
    searchDocumentsByText(query) {
        return this.db.prepare(
            'SELECT * FROM documents WHERE content LIKE ? LIMIT 20'
        ).all(`%${query}%`);
    }

    /**
     * Get statistics (delegates to storageManager)
     */
    async getStats() {
        try {
            const stats = await this.storageManager.getStats();
            return {
                documents: stats.documents,
                embeddings: stats.vectors,
                subjects: ['General'], // Legacy compatibility
            };
        } catch (error) {
            // Fallback to legacy if storageManager not ready
            const docCount = this.db.prepare('SELECT COUNT(*) as count FROM documents').get();
            const embCount = this.db.prepare('SELECT COUNT(*) as count FROM embeddings').get();
            return {
                documents: docCount.count || 0,
                embeddings: embCount.count || 0,
                subjects: [],
            };
        }
    }

    /**
     * Bulk insert for setup script
     * @deprecated Use storageManager.indexDocumentsBatch()
     */
    insertBatch(documents) {
        console.warn('[Database] insertBatch() is deprecated. Use storageManager.indexDocumentsBatch()');
        
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

    // ================= Active Methods (Forwarded to StorageManager) =================   );

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
        this.db.prepare('DELETE FROM notes WHERE id = ?').run(id);
    }

    toggleNoteComplete(id) {
        this.db.prepare('UPDATE notes SET completed = CASE WHEN completed = 0 THEN 1 ELSE 0 END WHERE id = ?').run(id);
    }

    // ── Projects ───────────────────────────────────────────────────────────

    createProject(name) {
        const result = this.db.prepare('INSERT INTO projects (name) VALUES (?)').run(name);
        return result.lastInsertRowid;
    }

    getProjects() {
        const projects = this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
        return projects.map((p) => ({
            id: p.id,
            name: p.name,
            createdAt: p.created_at,
            chatCount: this.db.prepare('SELECT COUNT(*) as c FROM chats WHERE project_id = ?').get(p.id).c,
        }));
    }

    deleteProject(id) {
        this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    }

    renameProject(id, name) {
        this.db.prepare('UPDATE projects SET name = ? WHERE id = ?').run(name, id);
    }

    // ── Chats ─────────────────────────────────────────────────────────────

    createChat(projectId = null, title = 'New Chat') {
        const result = this.db.prepare(
            'INSERT INTO chats (project_id, title) VALUES (?, ?)'
        ).run(projectId, title);
        return { id: result.lastInsertRowid, title, projectId };
    }

    getChats(projectId = undefined) {
        const rows = projectId !== undefined
            ? this.db.prepare('SELECT * FROM chats WHERE project_id = ? ORDER BY last_updated DESC').all(projectId)
            : this.db.prepare('SELECT * FROM chats ORDER BY last_updated DESC LIMIT 50').all();
        return rows.map((r) => ({
            id: r.id,
            title: r.title,
            projectId: r.project_id,
            lastUpdated: r.last_updated,
        }));
    }

    deleteChat(id) {
        this.db.prepare('DELETE FROM chats WHERE id = ?').run(id);
    }

    updateChatTitle(id, title) {
        this.db.prepare('UPDATE chats SET title = ? WHERE id = ?').run(title, id);
    }

    touchChat(id) {
        this.db.prepare("UPDATE chats SET last_updated = CURRENT_TIMESTAMP WHERE id = ?").run(id);
    }

    searchChats(query) {
        const pattern = `%${query}%`;
        return this.db.prepare(`
            SELECT DISTINCT c.id, c.title, c.last_updated
            FROM chats c
            LEFT JOIN chat_messages m ON m.chat_id = c.id
            WHERE c.title LIKE ? OR m.content LIKE ?
            ORDER BY c.last_updated DESC LIMIT 20
        `).all(pattern, pattern).map((r) => ({
            id: r.id, title: r.title, lastUpdated: r.last_updated,
        }));
    }

    // ── Chat Messages ──────────────────────────────────────────────────────

    getChatMessages(chatId) {
        return this.db.prepare(
            'SELECT * FROM chat_messages WHERE chat_id = ? ORDER BY timestamp ASC'
        ).all(chatId).map((r) => ({
            id: r.id,
            chatId: r.chat_id,
            role: r.role,
            content: r.content,
            timestamp: r.timestamp,
        }));
    }

    addChatMessage(chatId, role, content) {
        const result = this.db.prepare(
            'INSERT INTO chat_messages (chat_id, role, content) VALUES (?, ?, ?)'
        ).run(chatId, role, content);
        this.touchChat(chatId);
        return result.lastInsertRowid;
    }

    // ── Mesh Networking ────────────────────────────────────────────────────

    /**
     * Store mesh peer ID for persistent identity
     */
    storeMeshPeerId(peerId) {
        this.db.prepare(
            'INSERT OR REPLACE INTO mesh_config (key, value) VALUES (?, ?)'
        ).run('peer_id', peerId);
    }

    /**
     * Get stored mesh peer ID
     */
    getMeshPeerId() {
        const row = this.db.prepare(
            'SELECT value FROM mesh_config WHERE key = ?'
        ).get('peer_id');
        return row ? row.value : null;
    }

    /**
     * Upsert peer information
     */
    upsertPeer(peerId, deviceName, lastSeen) {
        this.db.prepare(`
            INSERT INTO peers (peer_id, device_name, last_seen)
            VALUES (?, ?, ?)
            ON CONFLICT(peer_id) DO UPDATE SET
                device_name = excluded.device_name,
                last_seen = excluded.last_seen
        `).run(peerId, deviceName, lastSeen);
    }

    /**
     * Get all known peers
     */
    getPeers() {
        return this.db.prepare('SELECT * FROM peers ORDER BY last_seen DESC').all();
    }

    /**
     * Get specific peer
     */
    getPeer(peerId) {
        return this.db.prepare('SELECT * FROM peers WHERE peer_id = ?').get(peerId);
    }

    /**
     * Update peer document count
     */
    updatePeerDocCount(peerId, docCount) {
        this.db.prepare(
            'UPDATE peers SET doc_count = ? WHERE peer_id = ?'
        ).run(docCount, peerId);
    }

    /**
     * Upsert peer document metadata
     */
    upsertPeerDocument(peerId, docId, title, subject, chunkCount, lastModified) {
        this.db.prepare(`
            INSERT INTO peer_documents (peer_id, doc_id, title, subject, chunk_count, last_modified)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(peer_id, doc_id) DO UPDATE SET
                title = excluded.title,
                subject = excluded.subject,
                chunk_count = excluded.chunk_count,
                last_modified = excluded.last_modified
        `).run(peerId, docId, title, subject, chunkCount, lastModified);
    }

    /**
     * Get documents from a specific peer
     */
    getPeerDocuments(peerId) {
        return this.db.prepare(`
            SELECT * FROM peer_documents
            WHERE peer_id = ?
            ORDER BY last_modified DESC
        `).all(peerId).map(row => ({
            id: row.id,
            peerId: row.peer_id,
            docId: row.doc_id,
            title: row.title,
            subject: row.subject,
            chunkCount: row.chunk_count,
            lastModified: row.last_modified,
            createdAt: row.created_at
        }));
    }

    /**
     * Get all peer documents with peer info
     */
    getAllPeerDocuments() {
        return this.db.prepare(`
            SELECT 
                pd.*,
                p.device_name as peer_name
            FROM peer_documents pd
            JOIN peers p ON pd.peer_id = p.peer_id
            ORDER BY pd.last_modified DESC
            LIMIT 100
        `).all().map(row => ({
            id: row.id,
            peerId: row.peer_id,
            peerName: row.peer_name,
            docId: row.doc_id,
            title: row.title,
            subject: row.subject,
            chunkCount: row.chunk_count,
            lastModified: row.last_modified,
            createdAt: row.created_at
        }));
    }

    /**
     * Delete old peer documents (cleanup)
     */
    cleanupOldPeerDocuments(maxAgeMs) {
        const cutoff = Date.now() - maxAgeMs;
        return this.db.prepare(
            'DELETE FROM peer_documents WHERE last_modified < ?'
        ).run(cutoff);
    }

    /**
     * Delete documents from disconnected peer
     */
    deletePeerDocuments(peerId) {
        return this.db.prepare(
            'DELETE FROM peer_documents WHERE peer_id = ?'
        ).run(peerId);
    }
}

module.exports = { initializeDatabase, getDatabase, DatabaseWrapper };
