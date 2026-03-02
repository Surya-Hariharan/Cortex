/**
 * Cortex — Database Initialization
 * Single entry point for all database setup: SQLite + LanceDB.
 * Handles schema versioning and migrations.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { storageManager } = require('./storageManager');

const { DatabaseWrapper } = require('./dbWrapper');

let db = null;
let wrapper = null;

const SCHEMA_VERSION = 2; // Bump when schema changes

/**
 * Initialize all database systems:
 * 1. SQLite (metadata, auth, mesh config)
 * 2. LanceDB (vector storage) via storageManager
 */
async function initializeDatabase(dataDir) {
    const dbPath = path.join(dataDir, 'cortex.db');

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const uploadsDir = path.join(dataDir, 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    // Initialize LanceDB vector store
    await storageManager.initialize(dataDir);

    // Initialize SQLite
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Schema version table
    db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER NOT NULL,
        applied_at INTEGER NOT NULL
    )`);

    const currentVersion = db.prepare('SELECT MAX(version) as v FROM schema_version').get()?.v || 0;

    // Run migrations if needed
    if (currentVersion < SCHEMA_VERSION) {
        runMigrations(currentVersion);
    }

    wrapper = new DatabaseWrapper(db);
    console.log(`[Database] Initialized (schema v${SCHEMA_VERSION})`);
    return wrapper;
}

/**
 * Migration system — runs upgrade scripts sequentially
 */
function runMigrations(fromVersion) {
    console.log(`[Database] Migrating from v${fromVersion} to v${SCHEMA_VERSION}...`);

    // Handle legacy auth tables (v0 → v1)
    if (fromVersion < 1) {
        try {
            const userCols = db.prepare("PRAGMA table_info(users)").all();
            if (userCols.length > 0) {
                const hasUserId = userCols.some(c => c.name === 'user_id');
                if (!hasUserId) {
                    console.log('[Database] Dropping legacy auth tables...');
                    db.exec(`
                        DROP TABLE IF EXISTS otp_codes;
                        DROP TABLE IF EXISTS devices;
                        DROP TABLE IF EXISTS users;
                    `);
                }
            }
        } catch (e) {
            console.warn('[Database] Legacy check skipped:', e.message);
        }
    }

    // Create all tables (v2 — current)
    db.exec(`
    -- Legacy app tables
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

    -- Mesh tables
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

    -- Auth tables
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      college_name TEXT NOT NULL,
      roll_number TEXT NOT NULL,
      degree TEXT NOT NULL,
      course_name TEXT NOT NULL,
      academic_level TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      is_verified INTEGER DEFAULT 0,
      auth_mode TEXT DEFAULT 'local',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_devices (
      device_id TEXT PRIMARY KEY,
      user_id TEXT,
      device_name TEXT,
      created_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS otp_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_chats_project ON chats(project_id);
    CREATE INDEX IF NOT EXISTS idx_messages_chat ON chat_messages(chat_id);
    CREATE INDEX IF NOT EXISTS idx_peer_docs_peer ON peer_documents(peer_id);
    CREATE INDEX IF NOT EXISTS idx_peer_docs_modified ON peer_documents(last_modified);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_auth_devices_user ON auth_devices(user_id);
    CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email);
    `);

    // Record migration
    db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(SCHEMA_VERSION, Date.now());
    console.log(`[Database] Migration to v${SCHEMA_VERSION} complete.`);
}

/**
 * Get configured database wrapper instance
 */
function getDb() {
    return wrapper;
}

module.exports = { initializeDatabase, getDb };
