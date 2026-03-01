const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { encryptText, decryptText, encryptEmbedding, decryptEmbedding } = require('./encryption');

let db = null;

/**
 * Initialize SQLite database with schema
 */
function initializeDatabase(dbPath) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

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
  `);

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
}

module.exports = { initializeDatabase, getDatabase, DatabaseWrapper };
