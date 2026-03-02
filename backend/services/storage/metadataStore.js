const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { encryptText, decryptText } = require('../encryption');
const { CURRENT_EMBEDDING_VERSION } = require('./config');

/**
 * Metadata Store - SQLite Backend
 * 
 * Purpose:
 * - Store document metadata (title, file path, hash, ownership)
 * - Store chunk metadata (content, version, device ownership)
 * - Track devices for mesh networking
 * - NO vector storage (moved to LanceDB)
 * 
 * Schema Philosophy:
 * - Relational metadata only
 * - Version-aware chunks
 * - Device-aware for mesh sync
 * - File hash deduplication
 */

let db = null;

/**
 * Initialize metadata store with production-grade schema
 */
function initializeMetadataStore(dbPath) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(dbPath);

    // Enable WAL mode for concurrent reads
    db.pragma('journal_mode = WAL');

        // Handle legacy schema where documents table exists without Phase 2D columns
        try {
                const docColumns = db.prepare("PRAGMA table_info(documents)").all();
                const hasDocId = docColumns.some((col) => col.name === 'doc_id');
                const hasFileHash = docColumns.some((col) => col.name === 'file_hash');

                if (docColumns.length > 0 && (!hasDocId || !hasFileHash)) {
                        console.warn('[MetadataStore] Legacy documents schema detected. Migrating to Phase 2D schema...');

                        db.exec(`
                            ALTER TABLE documents RENAME TO documents_legacy;

                            CREATE TABLE documents (
                                doc_id TEXT PRIMARY KEY,
                                title TEXT NOT NULL,
                                file_path TEXT,
                                file_hash TEXT UNIQUE NOT NULL,
                                created_at INTEGER NOT NULL,
                                updated_at INTEGER NOT NULL,
                                owner_device TEXT NOT NULL
                            );
                        `);

                        console.warn('[MetadataStore] Legacy documents moved to documents_legacy; new documents table created.');
                }
        } catch (schemaError) {
                console.warn('[MetadataStore] Legacy schema check skipped:', schemaError.message);
        }

    // Create new storage schema
    db.exec(`
    -- Documents: Core metadata, file integrity, ownership
    CREATE TABLE IF NOT EXISTS documents (
      doc_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      file_path TEXT,
      file_hash TEXT UNIQUE NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      owner_device TEXT NOT NULL
    );

    -- Chunks: Content, versioning, device tracking
    CREATE TABLE IF NOT EXISTS chunks (
      chunk_id TEXT PRIMARY KEY,
      doc_id TEXT NOT NULL,
      content TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      embedding_version TEXT NOT NULL,
      owner_device TEXT NOT NULL,
      last_synced INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (doc_id) REFERENCES documents(doc_id) ON DELETE CASCADE
    );

    -- Devices: Mesh network device tracking
    CREATE TABLE IF NOT EXISTS devices (
      device_id TEXT PRIMARY KEY,
      device_name TEXT NOT NULL,
      first_seen INTEGER NOT NULL,
      last_seen INTEGER NOT NULL
    );

    -- Legacy tables (preserved for backward compatibility)
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

    -- Mesh network tables (Phase 2C)
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

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(file_hash);
    CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_device);
    CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(doc_id);
    CREATE INDEX IF NOT EXISTS idx_chunks_version ON chunks(embedding_version);
    CREATE INDEX IF NOT EXISTS idx_chunks_owner ON chunks(owner_device);
    CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen);
    CREATE INDEX IF NOT EXISTS idx_chats_project ON chats(project_id);
    CREATE INDEX IF NOT EXISTS idx_messages_chat ON chat_messages(chat_id);
    CREATE INDEX IF NOT EXISTS idx_peer_docs_peer ON peer_documents(peer_id);
    CREATE INDEX IF NOT EXISTS idx_peer_docs_modified ON peer_documents(last_modified);
  `);

    return db;
}

/**
 * Get database instance
 */
function getMetadataStore() {
    return db ? new MetadataStore(db) : null;
}

/**
 * Metadata Store Abstraction
 */
class MetadataStore {
    constructor(database) {
        this.db = database;
    }

    // ================= Document Operations =================

    /**
     * Insert a new document
     */
    insertDocument(docId, title, filePath, fileHash, ownerDevice) {
        const now = Date.now();
        const stmt = this.db.prepare(`
      INSERT INTO documents (doc_id, title, file_path, file_hash, created_at, updated_at, owner_device)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(docId, title, filePath, fileHash, now, now, ownerDevice);
    }

    /**
     * Check if document exists by file hash
     */
    documentExistsByHash(fileHash) {
        const stmt = this.db.prepare('SELECT doc_id FROM documents WHERE file_hash = ?');
        return stmt.get(fileHash) !== undefined;
    }

    /**
     * Get document by hash
     */
    getDocumentByHash(fileHash) {
        const stmt = this.db.prepare('SELECT * FROM documents WHERE file_hash = ?');
        return stmt.get(fileHash);
    }

    /**
     * Get document by ID
     */
    getDocument(docId) {
        const stmt = this.db.prepare('SELECT * FROM documents WHERE doc_id = ?');
        return stmt.get(docId);
    }

    /**
     * Get all documents
     */
    getAllDocuments() {
        const stmt = this.db.prepare('SELECT * FROM documents ORDER BY created_at DESC');
        return stmt.all();
    }

    /**
     * Update document modified time
     */
    updateDocumentTimestamp(docId) {
        const stmt = this.db.prepare('UPDATE documents SET updated_at = ? WHERE doc_id = ?');
        stmt.run(Date.now(), docId);
    }

    /**
     * Delete document (cascades to chunks)
     */
    deleteDocument(docId) {
        const stmt = this.db.prepare('DELETE FROM documents WHERE doc_id = ?');
        stmt.run(docId);
    }

    // ================= Chunk Operations =================

    /**
     * Insert chunk with versioning
     */
    insertChunk(chunkId, docId, content, chunkIndex, embeddingVersion, ownerDevice) {
        const now = Date.now();
        const stmt = this.db.prepare(`
      INSERT INTO chunks (chunk_id, doc_id, content, chunk_index, embedding_version, owner_device, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(chunkId, docId, encryptText(content), chunkIndex, embeddingVersion, ownerDevice, now);
    }

    /**
     * Batch insert chunks (for performance)
     */
    insertChunksBatch(chunks) {
        const stmt = this.db.prepare(`
      INSERT INTO chunks (chunk_id, doc_id, content, chunk_index, embedding_version, owner_device, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

        const insertMany = this.db.transaction((chunksArray) => {
            for (const chunk of chunksArray) {
                stmt.run(
                    chunk.chunkId,
                    chunk.docId,
                    encryptText(chunk.content),
                    chunk.chunkIndex,
                    chunk.embeddingVersion,
                    chunk.ownerDevice,
                    chunk.createdAt
                );
            }
        });

        insertMany(chunks);
    }

    /**
     * Get chunk by ID
     */
    getChunk(chunkId) {
        const stmt = this.db.prepare('SELECT * FROM chunks WHERE chunk_id = ?');
        const row = stmt.get(chunkId);
        if (row) {
            row.content = decryptText(row.content);
        }
        return row;
    }

    /**
     * Get all chunks for a document
     */
    getDocumentChunks(docId) {
        const stmt = this.db.prepare(`
      SELECT * FROM chunks 
      WHERE doc_id = ? 
      ORDER BY chunk_index ASC
    `);
        const rows = stmt.all(docId);
        return rows.map((row) => ({
            ...row,
            content: decryptText(row.content),
        }));
    }

    /**
     * Get chunks by embedding version
     */
    getChunksByVersion(embeddingVersion) {
        const stmt = this.db.prepare(`
      SELECT c.*, d.title, d.file_path
      FROM chunks c
      JOIN documents d ON c.doc_id = d.doc_id
      WHERE c.embedding_version = ?
      ORDER BY c.created_at DESC
    `);
        const rows = stmt.all(embeddingVersion);
        return rows.map((row) => ({
            ...row,
            content: decryptText(row.content),
        }));
    }

    /**
     * Get all chunks with document metadata
     */
    getAllChunksWithMetadata() {
        const stmt = this.db.prepare(`
      SELECT 
        c.chunk_id,
        c.doc_id,
        c.content,
        c.chunk_index,
        c.embedding_version,
        c.owner_device,
        d.title,
        d.file_path
      FROM chunks c
      JOIN documents d ON c.doc_id = d.doc_id
      ORDER BY d.created_at DESC, c.chunk_index ASC
    `);
        const rows = stmt.all();
        return rows.map((row) => ({
            ...row,
            content: decryptText(row.content),
        }));
    }

    /**
     * Count chunks for a document
     */
    getChunkCount(docId) {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM chunks WHERE doc_id = ?');
        return stmt.get(docId).count;
    }

    /**
     * Delete all chunks for a document
     */
    deleteChunks(docId) {
        const stmt = this.db.prepare('DELETE FROM chunks WHERE chunk_id = ?');
        stmt.run(docId);
    }

    // ================= Device Operations =================

    /**
     * Register or update device
     */
    upsertDevice(deviceId, deviceName) {
        const now = Date.now();
        const stmt = this.db.prepare(`
      INSERT INTO devices (device_id, device_name, first_seen, last_seen)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(device_id) DO UPDATE SET
        device_name = excluded.device_name,
        last_seen = excluded.last_seen
    `);
        stmt.run(deviceId, deviceName, now, now);
    }

    /**
     * Get device info
     */
    getDevice(deviceId) {
        const stmt = this.db.prepare('SELECT * FROM devices WHERE device_id = ?');
        return stmt.get(deviceId);
    }

    /**
     * Get all devices
     */
    getAllDevices() {
        const stmt = this.db.prepare('SELECT * FROM devices ORDER BY last_seen DESC');
        return stmt.all();
    }

    // ================= Statistics & Metadata =================

    /**
     * Get storage statistics
     */
    getStorageStats() {
        const docCount = this.db.prepare('SELECT COUNT(*) as count FROM documents').get().count;
        const chunkCount = this.db.prepare('SELECT COUNT(*) as count FROM chunks').get().count;
        const deviceCount = this.db.prepare('SELECT COUNT(*) as count FROM devices').get().count;

        const versionStats = this.db.prepare(`
      SELECT embedding_version, COUNT(*) as count
      FROM chunks
      GROUP BY embedding_version
    `).all();

        return {
            documents: docCount,
            chunks: chunkCount,
            devices: deviceCount,
            embeddingVersions: versionStats,
            currentVersion: CURRENT_EMBEDDING_VERSION,
        };
    }

    /**
     * Check if embedding version migration is needed
     */
    needsMigration() {
        const stmt = this.db.prepare(`
      SELECT DISTINCT embedding_version 
      FROM chunks 
      WHERE embedding_version != ?
    `);
        const outdatedVersions = stmt.all(CURRENT_EMBEDDING_VERSION);
        return outdatedVersions.length > 0 ? outdatedVersions : null;
    }

    // ================= Legacy Compatibility =================
    // Preserved methods for backward compatibility with existing UI

    insertNote(title, content, type = 'note') {
        const stmt = this.db.prepare(
            'INSERT INTO notes (title, content, type) VALUES (?, ?, ?)'
        );
        const result = stmt.run(title, content, type);
        return result.lastInsertRowid;
    }

    getAllNotes() {
        return this.db.prepare('SELECT * FROM notes ORDER BY created_at DESC').all();
    }

    deleteNote(id) {
        this.db.prepare('DELETE FROM notes WHERE id = ?').run(id);
    }

    createProject(name) {
        const stmt = this.db.prepare('INSERT INTO projects (name) VALUES (?)');
        return stmt.run(name).lastInsertRowid;
    }

    getAllProjects() {
        return this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
    }

    createChat(projectId, title = 'New Chat') {
        const stmt = this.db.prepare(
            'INSERT INTO chats (project_id, title) VALUES (?, ?)'
        );
        return stmt.run(projectId, title).lastInsertRowid;
    }

    getAllChats(projectId = null) {
        if (projectId) {
            return this.db.prepare('SELECT * FROM chats WHERE project_id = ? ORDER BY last_updated DESC').all(projectId);
        }
        return this.db.prepare('SELECT * FROM chats ORDER BY last_updated DESC').all();
    }

    getChatMessages(chatId) {
        return this.db.prepare('SELECT * FROM chat_messages WHERE chat_id = ? ORDER BY timestamp ASC').all(chatId);
    }

    insertMessage(chatId, role, content) {
        const stmt = this.db.prepare(
            'INSERT INTO chat_messages (chat_id, role, content) VALUES (?, ?, ?)'
        );
        stmt.run(chatId, role, content);

        // Update chat timestamp
        this.db.prepare('UPDATE chats SET last_updated = CURRENT_TIMESTAMP WHERE id = ?').run(chatId);
    }

    // ================= Mesh Network Operations (Phase 2C) =================

    storeMeshPeerId(peerId) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO mesh_config (key, value)
      VALUES ('peer_id', ?)
    `);
        stmt.run(peerId);
    }

    getMeshPeerId() {
        const stmt = this.db.prepare(`
      SELECT value FROM mesh_config WHERE key = 'peer_id'
    `);
        const row = stmt.get();
        return row ? row.value : null;
    }

    upsertPeer(peerId, deviceName, docCount = 0) {
        const stmt = this.db.prepare(`
      INSERT INTO peers (peer_id, device_name, last_seen, doc_count)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(peer_id) DO UPDATE SET
        device_name = excluded.device_name,
        last_seen = excluded.last_seen,
        doc_count = excluded.doc_count
    `);
        stmt.run(peerId, deviceName, Date.now(), docCount);
    }

    getAllPeers() {
        return this.db.prepare('SELECT * FROM peers ORDER BY last_seen DESC').all();
    }

    storePeerDocument(peerId, docId, title, subject, chunkCount, lastModified) {
        const stmt = this.db.prepare(`
      INSERT INTO peer_documents (peer_id, doc_id, title, subject, chunk_count, last_modified)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(peer_id, doc_id) DO UPDATE SET
        title = excluded.title,
        subject = excluded.subject,
        chunk_count = excluded.chunk_count,
        last_modified = excluded.last_modified
    `);
        stmt.run(peerId, docId, title, subject, chunkCount, lastModified);
    }

    getPeerDocuments(peerId) {
        return this.db.prepare('SELECT * FROM peer_documents WHERE peer_id = ? ORDER BY last_modified DESC').all(peerId);
    }
}

module.exports = {
    initializeMetadataStore,
    getMetadataStore,
    MetadataStore,
};
