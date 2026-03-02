const path = require('path');
const { initializeMetadataStore, getMetadataStore } = require('./metadataStore');
const { initializeVectorStore, getVectorStore } = require('./vectorStore');
const { indexDocument, indexDocumentsBatch, deleteDocument, reindexDocument, getIndexingStats, verifyIntegrity, getDeviceId } = require('./indexer');
const { checkMigrationNeeded, migrateAllDocuments, getMigrationPlan } = require('./migrations/vectorMigration');
const { CURRENT_EMBEDDING_VERSION, EMBEDDING_CONFIG } = require('./config');

/**
 * Storage Manager - Unified Storage API
 * 
 * Purpose:
 * - Single entry point for all storage operations
 * - Abstracts SQLite + LanceDB complexity
 * - Provides clean API for UI and services
 * - Handles initialization and lifecycle
 * 
 * Architecture:
 * - Metadata Store (SQLite): documents, chunks, devices
 * - Vector Store (LanceDB): embeddings with version isolation
 * - Indexer: orchestrates document processing
 * - Migration: handles embedding version upgrades
 */

class StorageManager {
    constructor() {
        this.metadataStore = null;
        this.vectorStore = null;
        this.initialized = false;
        this.config = {
            embeddingVersion: CURRENT_EMBEDDING_VERSION,
            embeddingDimensions: EMBEDDING_CONFIG.dimensions,
            deviceId: getDeviceId(),
        };
    }

    /**
     * Initialize storage layer
     * @param {string} dataDir - data directory path
     */
    async initialize(dataDir) {
        try {
            console.log('[StorageManager] Initializing production storage architecture...');

            // Create paths
            const sqlitePath = path.join(dataDir, 'cortex.db');
            const lanceDbPath = path.join(dataDir, 'vectors');

            // Initialize stores
            initializeMetadataStore(sqlitePath);
            await initializeVectorStore(lanceDbPath);

            // Get store instances
            this.metadataStore = getMetadataStore();
            this.vectorStore = getVectorStore();

            // Register device
            this.metadataStore.upsertDevice(this.config.deviceId, require('os').hostname());

            this.initialized = true;
            console.log('[StorageManager] ✓ Storage initialized');
            console.log(`[StorageManager]   Device: ${this.config.deviceId}`);
            console.log(`[StorageManager]   Embedding: ${CURRENT_EMBEDDING_VERSION} (${EMBEDDING_CONFIG.dimensions}D)`);

            // Check if migration needed
            const migrationInfo = checkMigrationNeeded(this.metadataStore);
            if (migrationInfo) {
                console.warn('[StorageManager] ⚠ Embedding version migration required!');
                console.warn(`[StorageManager]   Current: ${CURRENT_EMBEDDING_VERSION}`);
                console.warn(`[StorageManager]   Outdated: ${migrationInfo.outdatedVersions.join(', ')}`);
                console.warn(`[StorageManager]   Affected chunks: ${migrationInfo.affectedChunks}`);
                console.warn('[StorageManager]   Run migration via: storageManager.migrateAll()');
            }

            return {
                success: true,
                sqlitePath,
                lanceDbPath,
                deviceId: this.config.deviceId,
                embeddingVersion: CURRENT_EMBEDDING_VERSION,
            };
        } catch (error) {
            console.error('[StorageManager] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Check if storage is ready
     */
    isReady() {
        return this.initialized && this.metadataStore !== null && this.vectorStore !== null;
    }

    // ================= Document Operations =================

    /**
     * Index a new document
     * @param {string} filePath - absolute path to PDF
     * @param {string} title - document title
     * @param {Function} progressCallback - optional progress updates
     * @returns {Promise<Object>}
     */
    async indexDocument(filePath, title, progressCallback = null) {
        this._ensureReady();
        return await indexDocument(filePath, title, this.metadataStore, this.vectorStore, progressCallback);
    }

    /**
     * Batch index multiple documents
     * @param {Array<{filePath, title}>} documents
     * @param {Function} progressCallback - optional (docIndex, total, result)
     * @returns {Promise<Object>}
     */
    async indexDocumentsBatch(documents, progressCallback = null) {
        this._ensureReady();
        return await indexDocumentsBatch(documents, this.metadataStore, this.vectorStore, progressCallback);
    }

    /**
     * Delete document and all associated data
     * @param {string} docId
     * @returns {Promise<Object>}
     */
    async deleteDocument(docId) {
        this._ensureReady();
        return await deleteDocument(docId, this.metadataStore, this.vectorStore);
    }

    /**
     * Reindex document (e.g., after version change)
     * @param {string} docId
     * @returns {Promise<Object>}
     */
    async reindexDocument(docId) {
        this._ensureReady();
        return await reindexDocument(docId, this.metadataStore, this.vectorStore);
    }

    /**
     * Get document by ID
     * @param {string} docId
     * @returns {Object|null}
     */
    getDocument(docId) {
        this._ensureReady();
        return this.metadataStore.getDocument(docId);
    }

    /**
     * Get all documents
     * @returns {Array<Object>}
     */
    getAllDocuments() {
        this._ensureReady();
        return this.metadataStore.getAllDocuments();
    }

    /**
     * Get document chunks
     * @param {string} docId
     * @returns {Array<Object>}
     */
    getDocumentChunks(docId) {
        this._ensureReady();
        return this.metadataStore.getDocumentChunks(docId);
    }

    // ================= Search Operations =================

    /**
     * Vector similarity search
     * @param {number[]} queryVector - embedding vector
     * @param {number} limit - number of results
     * @returns {Promise<Array>}
     */
    async search(queryVector, limit = 10) {
        this._ensureReady();
        
        // Search vectors
        const vectorResults = await this.vectorStore.search(queryVector, limit);

        // Enrich with metadata
        const enrichedResults = vectorResults.map((result) => {
            const chunk = this.metadataStore.getChunk(result.chunk_id);
            if (!chunk) return null;

            const doc = this.metadataStore.getDocument(chunk.doc_id);
            if (!doc) return null;

            return {
                chunk_id: result.chunk_id,
                doc_id: result.doc_id,
                title: doc.title,
                content: chunk.content,
                chunkIndex: chunk.chunk_index,
                score: result.score,
                embeddingVersion: result.embedding_version,
            };
        }).filter((r) => r !== null);

        return enrichedResults;
    }

    /**
     * Search with text query (embedding + search)
     * @param {string} query - text query
     * @param {number} limit - number of results
     * @returns {Promise<Array>}
     */
    async searchByText(query, limit = 10) {
        this._ensureReady();
        
        // Generate embedding via AI manager
        const { aiManager } = require('../ai/runtime/aiManager');
        const queryVector = await aiManager.runEmbedding(query);

        // Perform vector search
        return await this.search(queryVector, limit);
    }

    // ================= Migration Operations =================

    /**
     * Check if migration needed
     * @returns {Object|null}
     */
    checkMigration() {
        this._ensureReady();
        return checkMigrationNeeded(this.metadataStore);
    }

    /**
     * Get migration plan (dry run)
     * @returns {Object}
     */
    getMigrationPlan() {
        this._ensureReady();
        return getMigrationPlan(this.metadataStore);
    }

    /**
     * Migrate all documents to current embedding version
     * @param {Function} progressCallback - optional (docIndex, total, status)
     * @returns {Promise<Object>}
     */
    async migrateAll(progressCallback = null) {
        this._ensureReady();
        return await migrateAllDocuments(this.metadataStore, this.vectorStore, progressCallback);
    }

    // ================= Statistics & Health =================

    /**
     * Get storage statistics
     * @returns {Promise<Object>}
     */
    async getStats() {
        this._ensureReady();
        return await getIndexingStats(this.metadataStore, this.vectorStore);
    }

    /**
     * Verify storage integrity
     * @returns {Promise<Object>}
     */
    async verifyIntegrity() {
        this._ensureReady();
        return await verifyIntegrity(this.metadataStore, this.vectorStore);
    }

    /**
     * Get health status
     * @returns {Promise<Object>}
     */
    async getHealthStatus() {
        this._ensureReady();

        const [stats, integrity, vectorHealth] = await Promise.all([
            this.getStats(),
            this.verifyIntegrity(),
            this.vectorStore.verifyIntegrity(),
        ]);

        return {
            healthy: integrity.healthy && vectorHealth.connected,
            storage: {
                documents: stats.documents,
                chunks: stats.chunks,
                vectors: stats.vectors,
            },
            integrity: {
                healthy: integrity.healthy,
                expectedVectors: integrity.expectedVectors,
                actualVectors: integrity.actualVectors,
                mismatch: integrity.mismatch,
            },
            vectorStore: vectorHealth,
            migration: this.checkMigration(),
            embeddingVersion: CURRENT_EMBEDDING_VERSION,
            deviceId: this.config.deviceId,
        };
    }

    // ================= Legacy Compatibility =================
    // Methods for backward compatibility with existing UI code

    /**
     * Get all embeddings (legacy format)
     * @returns {Array<Object>}
     */
    getAllEmbeddings() {
        this._ensureReady();
        
        // Get all chunks with metadata
        const chunks = this.metadataStore.getAllChunksWithMetadata();
        
        // Format as legacy embeddings array
        // Note: This loads vectors synchronously which isn't ideal for large datasets
        // For production, consider using the search() method instead
        console.warn('[StorageManager] getAllEmbeddings() is deprecated - consider using search()');
        
        return chunks.map((chunk) => ({
            id: chunk.chunk_id,
            docId: chunk.doc_id,
            title: chunk.title,
            content: chunk.content,
            chunkIndex: chunk.chunk_index,
            // Vector is fetched on-demand, not included here to save memory
            // If needed, call vectorStore.getVector(chunk.chunk_id)
        }));
    }

    /**
     * Insert note (legacy)
     */
    insertNote(title, content, type = 'note') {
        this._ensureReady();
        return this.metadataStore.insertNote(title, content, type);
    }

    /**
     * Get all notes (legacy)
     */
    getAllNotes() {
        this._ensureReady();
        return this.metadataStore.getAllNotes();
    }

    /**
     * Delete note (legacy)
     */
    deleteNote(id) {
        this._ensureReady();
        return this.metadataStore.deleteNote(id);
    }

    /**
     * Create project (legacy)
     */
    createProject(name) {
        this._ensureReady();
        return this.metadataStore.createProject(name);
    }

    /**
     * Get all projects (legacy)
     */
    getAllProjects() {
        this._ensureReady();
        return this.metadataStore.getAllProjects();
    }

    /**
     * Create chat (legacy)
     */
    createChat(projectId, title = 'New Chat') {
        this._ensureReady();
        return this.metadataStore.createChat(projectId, title);
    }

    /**
     * Get all chats (legacy)
     */
    getAllChats(projectId = null) {
        this._ensureReady();
        return this.metadataStore.getAllChats(projectId);
    }

    /**
     * Get chat messages (legacy)
     */
    getChatMessages(chatId) {
        this._ensureReady();
        return this.metadataStore.getChatMessages(chatId);
    }

    /**
     * Insert message (legacy)
     */
    insertMessage(chatId, role, content) {
        this._ensureReady();
        return this.metadataStore.insertMessage(chatId, role, content);
    }

    /**
     * Mesh network methods (Phase 2C compatibility)
     */
    storeMeshPeerId(peerId) {
        this._ensureReady();
        return this.metadataStore.storeMeshPeerId(peerId);
    }

    getMeshPeerId() {
        this._ensureReady();
        return this.metadataStore.getMeshPeerId();
    }

    upsertPeer(peerId, deviceName, docCount = 0) {
        this._ensureReady();
        return this.metadataStore.upsertPeer(peerId, deviceName, docCount);
    }

    getAllPeers() {
        this._ensureReady();
        return this.metadataStore.getAllPeers();
    }

    storePeerDocument(peerId, docId, title, subject, chunkCount, lastModified) {
        this._ensureReady();
        return this.metadataStore.storePeerDocument(peerId, docId, title, subject, chunkCount, lastModified);
    }

    getPeerDocuments(peerId) {
        this._ensureReady();
        return this.metadataStore.getPeerDocuments(peerId);
    }

    // ================= Internal Utilities =================

    _ensureReady() {
        if (!this.isReady()) {
            throw new Error('StorageManager not initialized. Call initialize() first.');
        }
    }
}

// Singleton instance
const storageManager = new StorageManager();

module.exports = {
    storageManager,
    StorageManager,
};
