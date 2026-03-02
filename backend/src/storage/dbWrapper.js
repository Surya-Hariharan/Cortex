/**
 * Cortex — Database Wrapper
 * Provides wrapper methods for SQLite operations.
 * Handles unstructured data (notes, projects, chats), mesh config, and auth.
 */

const { encryptText, decryptText, encryptEmbedding, decryptEmbedding } = require('./encryption');

class DatabaseWrapper {
    constructor(database) {
        this.db = database;
    }

    // ── Auth Methods ────────────────────────────────────────────────────────

    getUserByEmail(email) {
        const row = this.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        return row ? this._mapUser(row) : null;
    }

    getUserById(userId) {
        const row = this.db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
        return row ? this._mapUser(row) : null;
    }

    _mapUser(row) {
        return {
            userId: row.user_id, fullName: row.full_name, email: row.email,
            collegeName: row.college_name, rollNumber: row.roll_number,
            degree: row.degree, courseName: row.course_name,
            academicLevel: row.academic_level, phoneNumber: row.phone_number,
            passwordHash: row.password_hash, isVerified: !!row.is_verified,
            authMode: row.auth_mode, createdAt: row.created_at
        };
    }

    createUser(data) {
        this.db.prepare(`
            INSERT INTO users (user_id, full_name, email, college_name, roll_number, degree, course_name, academic_level, phone_number, password_hash, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            data.userId, data.fullName, data.email, data.collegeName, data.rollNumber,
            data.degree, data.courseName, data.academicLevel, data.phoneNumber,
            data.passwordHash, Date.now()
        );
    }

    createDevice(deviceId, userId, deviceName) {
        this.db.prepare('INSERT OR REPLACE INTO auth_devices (device_id, user_id, device_name, created_at) VALUES (?, ?, ?, ?)').run(deviceId, userId, deviceName, Date.now());
    }

    createSession(sessionId, userId, expiresAt) {
        this.db.prepare('INSERT INTO sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(sessionId, userId, Date.now(), expiresAt);
    }

    getSession(sessionId) {
        const row = this.db.prepare('SELECT * FROM sessions WHERE session_id = ? AND expires_at > ?').get(sessionId, Date.now());
        return row ? { sessionId: row.session_id, userId: row.user_id, expiresAt: row.expires_at } : null;
    }

    deleteExpiredSessions() {
        this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    }

    storeOtp(email, code, expiryMinutes) {
        this.db.prepare('INSERT INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)').run(email, code, Date.now() + expiryMinutes * 60000);
    }

    getValidOtp(email, code) {
        return this.db.prepare('SELECT * FROM otp_codes WHERE email = ? AND code = ? AND used = 0 AND expires_at > ? ORDER BY created_at DESC LIMIT 1').get(email, code, Date.now());
    }

    markOtpUsed(id) {
        this.db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').run(id);
    }

    markUserVerified(email) {
        this.db.prepare('UPDATE users SET is_verified = 1 WHERE email = ?').run(email);
    }

    // ── Legacy Compatibility ──────────────────────────────────────────────────

    async getStats() {
        const docCount = this.db.prepare('SELECT COUNT(*) as count FROM documents').get();
        const chunkCount = this.db.prepare('SELECT COUNT(*) as count FROM chunks').get();
        return {
            documents: docCount.count,
            embeddings: chunkCount.count,
            subjects: [],
        };
    }

    addNote(title, content, type = 'note', dueDate = null) {
        const stmt = this.db.prepare('INSERT INTO notes (title, content, type, due_date) VALUES (?, ?, ?, ?)');
        const result = stmt.run(title, encryptText(content), type, dueDate);
        return result.lastInsertRowid;
    }

    getNotes() {
        const rows = this.db.prepare('SELECT * FROM notes ORDER BY completed ASC, due_date ASC, created_at DESC').all();
        return rows.map((r) => ({
            id: r.id, title: r.title, content: decryptText(r.content), type: r.type,
            dueDate: r.due_date, completed: !!r.completed, createdAt: r.created_at,
        }));
    }

    deleteNote(id) { this.db.prepare('DELETE FROM notes WHERE id = ?').run(id); }
    toggleNoteComplete(id) { this.db.prepare('UPDATE notes SET completed = CASE WHEN completed = 0 THEN 1 ELSE 0 END WHERE id = ?').run(id); }

    createProject(name) { return this.db.prepare('INSERT INTO projects (name) VALUES (?)').run(name).lastInsertRowid; }
    getProjects() {
        return this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all().map((p) => ({
            id: p.id, name: p.name, createdAt: p.created_at,
            chatCount: this.db.prepare('SELECT COUNT(*) as c FROM chats WHERE project_id = ?').get(p.id).c,
        }));
    }
    deleteProject(id) { this.db.prepare('DELETE FROM projects WHERE id = ?').run(id); }
    renameProject(id, name) { this.db.prepare('UPDATE projects SET name = ? WHERE id = ?').run(name, id); }

    createChat(projectId = null, title = 'New Chat') {
        const id = this.db.prepare('INSERT INTO chats (project_id, title) VALUES (?, ?)').run(projectId, title).lastInsertRowid;
        return { id, title, projectId };
    }
    getChats(projectId = undefined) {
        const rows = projectId !== undefined
            ? this.db.prepare('SELECT * FROM chats WHERE project_id = ? ORDER BY last_updated DESC').all(projectId)
            : this.db.prepare('SELECT * FROM chats ORDER BY last_updated DESC LIMIT 50').all();
        return rows.map((r) => ({ id: r.id, title: r.title, projectId: r.project_id, lastUpdated: r.last_updated }));
    }
    deleteChat(id) { this.db.prepare('DELETE FROM chats WHERE id = ?').run(id); }
    updateChatTitle(id, title) { this.db.prepare('UPDATE chats SET title = ? WHERE id = ?').run(title, id); }
    touchChat(id) { this.db.prepare('UPDATE chats SET last_updated = CURRENT_TIMESTAMP WHERE id = ?').run(id); }
    searchChats(query) {
        const pattern = `%${query}%`;
        return this.db.prepare(`
            SELECT DISTINCT c.id, c.title, c.last_updated
            FROM chats c LEFT JOIN chat_messages m ON m.chat_id = c.id
            WHERE c.title LIKE ? OR m.content LIKE ? ORDER BY c.last_updated DESC LIMIT 20
        `).all(pattern, pattern).map((r) => ({ id: r.id, title: r.title, lastUpdated: r.last_updated }));
    }

    getChatMessages(chatId) {
        return this.db.prepare('SELECT * FROM chat_messages WHERE chat_id = ? ORDER BY timestamp ASC').all(chatId).map((r) => ({
            id: r.id, chatId: r.chat_id, role: r.role, content: r.content, timestamp: r.timestamp,
        }));
    }
    addChatMessage(chatId, role, content) {
        const id = this.db.prepare('INSERT INTO chat_messages (chat_id, role, content) VALUES (?, ?, ?)').run(chatId, role, content).lastInsertRowid;
        this.touchChat(chatId);
        return id;
    }

    // ── Mesh Methods ────────────────────────────────────────────────────────

    storeMeshPeerId(peerId) { this.db.prepare('INSERT OR REPLACE INTO mesh_config (key, value) VALUES (?, ?)').run('peer_id', peerId); }
    getMeshPeerId() { const row = this.db.prepare('SELECT value FROM mesh_config WHERE key = ?').get('peer_id'); return row ? row.value : null; }

    upsertPeer(peerId, deviceName, lastSeen) {
        this.db.prepare(`INSERT INTO peers (peer_id, device_name, last_seen) VALUES (?, ?, ?)
            ON CONFLICT(peer_id) DO UPDATE SET device_name = excluded.device_name, last_seen = excluded.last_seen`).run(peerId, deviceName, lastSeen);
    }
    getPeers() { return this.db.prepare('SELECT * FROM peers ORDER BY last_seen DESC').all(); }
    getPeer(peerId) { return this.db.prepare('SELECT * FROM peers WHERE peer_id = ?').get(peerId); }
    updatePeerDocCount(peerId, docCount) { this.db.prepare('UPDATE peers SET doc_count = ? WHERE peer_id = ?').run(docCount, peerId); }

    upsertPeerDocument(peerId, docId, title, subject, chunkCount, lastModified) {
        this.db.prepare(`INSERT INTO peer_documents (peer_id, doc_id, title, subject, chunk_count, last_modified) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(peer_id, doc_id) DO UPDATE SET title = excluded.title, subject = excluded.subject, chunk_count = excluded.chunk_count, last_modified = excluded.last_modified`).run(peerId, docId, title, subject, chunkCount, lastModified);
    }
    getPeerDocuments(peerId) {
        return this.db.prepare('SELECT * FROM peer_documents WHERE peer_id = ? ORDER BY last_modified DESC').all(peerId).map((row) => ({
            id: row.id, peerId: row.peer_id, docId: row.doc_id, title: row.title, subject: row.subject,
            chunkCount: row.chunk_count, lastModified: row.last_modified, createdAt: row.created_at,
        }));
    }
    getAllPeerDocuments() {
        return this.db.prepare(`SELECT pd.*, p.device_name as peer_name FROM peer_documents pd JOIN peers p ON pd.peer_id = p.peer_id ORDER BY pd.last_modified DESC LIMIT 100`).all().map((row) => ({
            id: row.id, peerId: row.peer_id, peerName: row.peer_name, docId: row.doc_id, title: row.title,
            subject: row.subject, chunkCount: row.chunk_count, lastModified: row.last_modified, createdAt: row.created_at,
        }));
    }
    cleanupOldPeerDocuments(maxAgeMs) { return this.db.prepare('DELETE FROM peer_documents WHERE last_modified < ?').run(Date.now() - maxAgeMs); }
    deletePeerDocuments(peerId) { return this.db.prepare('DELETE FROM peer_documents WHERE peer_id = ?').run(peerId); }
}

module.exports = { DatabaseWrapper };
