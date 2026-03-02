const lancedb = require('vectordb');
const path = require('path');
const fs = require('fs');
const { LANCE_CONFIG, CURRENT_EMBEDDING_VERSION, EMBEDDING_CONFIG } = require('./config');

/**
 * Vector Store - LanceDB Backend
 * 
 * Purpose:
 * - Store high-dimensional embeddings (384-dim BGE vectors)
 * - Efficient similarity search with ANN (Approximate Nearest Neighbor)
 * - Version-aware collections (one collection per embedding version)
 * - Scalable to 100k+ vectors
 * 
 * Architecture:
 * - Each embedding version gets its own collection
 * - Collections are named: embeddings_bge_small_v1
 * - Never mix embeddings from different models
 */

let db = null;
let currentCollection = null;

/**
 * Initialize LanceDB connection
 * @param {string} dbPath - path to LanceDB directory
 */
async function initializeVectorStore(dbPath) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    try {
        // Connect to LanceDB
        db = await lancedb.connect(dbPath);
        console.log(`[VectorStore] Connected to LanceDB at: ${dbPath}`);

        // Open or create current collection
        currentCollection = await getOrCreateCollection(CURRENT_EMBEDDING_VERSION);
        console.log(`[VectorStore] Active collection: ${LANCE_CONFIG.currentCollection}`);

        return db;
    } catch (error) {
        console.error('[VectorStore] Initialization failed:', error);
        throw error;
    }
}

/**
 * Get or create a collection for a specific embedding version
 * @param {string} embeddingVersion - e.g., "bge-small-v1"
 * @returns {Promise<Collection>}
 */
async function getOrCreateCollection(embeddingVersion) {
    const collectionName = LANCE_CONFIG.getCollectionName(embeddingVersion);

    try {
        // Try to open existing collection
        const collection = await db.openTable(collectionName);
        console.log(`[VectorStore] Opened existing collection: ${collectionName}`);
        return collection;
    } catch (error) {
        // Collection doesn't exist, create it with schema
        console.log(`[VectorStore] Creating new collection: ${collectionName}`);

        // Create empty collection with initial data (LanceDB requires at least one row)
        const initialData = [{
            chunk_id: '_init',
            vector: new Array(EMBEDDING_CONFIG.dimensions).fill(0),
            doc_id: '_init',
            owner_device: 'system',
            embedding_version: embeddingVersion,
        }];

        const collection = await db.createTable(collectionName, initialData);
        
        // Delete the initialization row
        await collection.delete('chunk_id = "_init"');
        
        return collection;
    }
}

/**
 * Get vector store instance
 */
function getVectorStore() {
    return db ? new VectorStore(db, currentCollection) : null;
}

/**
 * Vector Store Abstraction
 */
class VectorStore {
    constructor(database, collection) {
        this.db = database;
        this.collection = collection;
        this.embeddingVersion = CURRENT_EMBEDDING_VERSION;
    }

    // ================= Vector Operations =================

    /**
     * Insert a single vector
     * @param {string} chunkId - deterministic chunk ID
     * @param {number[]} vector - 384-dim embedding
     * @param {string} docId - document identifier
     * @param {string} ownerDevice - device that created this embedding
     */
    async insertVector(chunkId, vector, docId, ownerDevice) {
        if (vector.length !== EMBEDDING_CONFIG.dimensions) {
            throw new Error(`Vector dimension mismatch: expected ${EMBEDDING_CONFIG.dimensions}, got ${vector.length}`);
        }

        const data = [{
            chunk_id: chunkId,
            vector: vector,
            doc_id: docId,
            owner_device: ownerDevice,
            embedding_version: this.embeddingVersion,
        }];

        await this.collection.add(data);
    }

    /**
     * Batch insert vectors (for performance)
     * @param {Array} vectors - array of {chunkId, vector, docId, ownerDevice}
     */
    async insertVectorsBatch(vectors) {
        if (vectors.length === 0) return;

        // Validate dimensions
        for (const v of vectors) {
            if (v.vector.length !== EMBEDDING_CONFIG.dimensions) {
                throw new Error(`Vector dimension mismatch for chunk ${v.chunkId}`);
            }
        }

        // Format for LanceDB
        const data = vectors.map((v) => ({
            chunk_id: v.chunkId,
            vector: v.vector,
            doc_id: v.docId,
            owner_device: v.ownerDevice,
            embedding_version: this.embeddingVersion,
        }));

        // Insert in batches to avoid memory issues
        const batchSize = LANCE_CONFIG.batchSize;
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            await this.collection.add(batch);
        }

        console.log(`[VectorStore] Inserted ${vectors.length} vectors in ${Math.ceil(vectors.length / batchSize)} batches`);
    }

    /**
     * Search for similar vectors
     * @param {number[]} queryVector - 384-dim query embedding
     * @param {number} limit - number of results (default: 10)
     * @param {string} filter - optional filter expression
     * @returns {Promise<Array>} - array of {chunk_id, doc_id, score, ...}
     */
    async search(queryVector, limit = 10, filter = null) {
        if (queryVector.length !== EMBEDDING_CONFIG.dimensions) {
            throw new Error(`Query vector dimension mismatch: expected ${EMBEDDING_CONFIG.dimensions}, got ${queryVector.length}`);
        }

        // Enforce max limit
        const safeLimit = Math.min(limit, LANCE_CONFIG.search.maxLimit);

        try {
            // LanceDB search with optional filter
            let query = this.collection
                .search(queryVector)
                .limit(safeLimit);

            if (filter) {
                query = query.filter(filter);
            }

            const results = await query.execute();

            // Transform results to include similarity score
            return results.map((row) => ({
                chunk_id: row.chunk_id,
                doc_id: row.doc_id,
                owner_device: row.owner_device,
                score: row._distance ? 1 / (1 + row._distance) : 0, // Convert distance to similarity
                embedding_version: row.embedding_version,
            }));
        } catch (error) {
            console.error('[VectorStore] Search failed:', error);
            throw error;
        }
    }

    /**
     * Get vector by chunk ID
     * @param {string} chunkId
     * @returns {Promise<Object|null>}
     */
    async getVector(chunkId) {
        try {
            const results = await this.collection
                .filter(`chunk_id = '${chunkId}'`)
                .execute();

            return results.length > 0 ? results[0] : null;
        } catch (error) {
            console.error(`[VectorStore] Failed to get vector for chunk ${chunkId}:`, error);
            return null;
        }
    }

    /**
     * Delete vectors for a document
     * @param {string} docId
     */
    async deleteVectorsByDoc(docId) {
        try {
            await this.collection.delete(`doc_id = '${docId}'`);
            console.log(`[VectorStore] Deleted vectors for document: ${docId}`);
        } catch (error) {
            console.error(`[VectorStore] Failed to delete vectors for doc ${docId}:`, error);
            throw error;
        }
    }

    /**
     * Delete a specific vector
     * @param {string} chunkId
     */
    async deleteVector(chunkId) {
        try {
            await this.collection.delete(`chunk_id = '${chunkId}'`);
        } catch (error) {
            console.error(`[VectorStore] Failed to delete vector ${chunkId}:`, error);
            throw error;
        }
    }

    /**
     * Count total vectors in collection
     * @returns {Promise<number>}
     */
    async countVectors() {
        try {
            const results = await this.collection.countRows();
            return results;
        } catch (error) {
            console.error('[VectorStore] Failed to count vectors:', error);
            return 0;
        }
    }

    /**
     * Get all vectors for a document (use sparingly)
     * @param {string} docId
     * @returns {Promise<Array>}
     */
    async getDocumentVectors(docId) {
        try {
            const results = await this.collection
                .filter(`doc_id = '${docId}'`)
                .execute();

            return results;
        } catch (error) {
            console.error(`[VectorStore] Failed to get vectors for doc ${docId}:`, error);
            return [];
        }
    }

    // ================= Collection Management =================

    /**
     * Switch to a different embedding version collection
     * @param {string} embeddingVersion
     */
    async switchCollection(embeddingVersion) {
        const newCollection = await getOrCreateCollection(embeddingVersion);
        this.collection = newCollection;
        this.embeddingVersion = embeddingVersion;
        console.log(`[VectorStore] Switched to collection: ${LANCE_CONFIG.getCollectionName(embeddingVersion)}`);
    }

    /**
     * List all collections (embedding versions)
     * @returns {Promise<Array<string>>}
     */
    async listCollections() {
        try {
            const tables = await this.db.tableNames();
            return tables.filter((name) => name.startsWith('embeddings_'));
        } catch (error) {
            console.error('[VectorStore] Failed to list collections:', error);
            return [];
        }
    }

    /**
     * Drop a collection (use with caution)
     * @param {string} embeddingVersion
     */
    async dropCollection(embeddingVersion) {
        const collectionName = LANCE_CONFIG.getCollectionName(embeddingVersion);
        
        // Safety check: cannot drop current collection
        if (embeddingVersion === CURRENT_EMBEDDING_VERSION) {
            throw new Error('Cannot drop current embedding version collection');
        }

        try {
            await this.db.dropTable(collectionName);
            console.log(`[VectorStore] Dropped collection: ${collectionName}`);
        } catch (error) {
            console.error(`[VectorStore] Failed to drop collection ${collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Get collection statistics
     * @returns {Promise<Object>}
     */
    async getStats() {
        try {
            const vectorCount = await this.countVectors();
            const collections = await this.listCollections();

            return {
                currentCollection: LANCE_CONFIG.currentCollection,
                embeddingVersion: this.embeddingVersion,
                vectorCount,
                dimensions: EMBEDDING_CONFIG.dimensions,
                allCollections: collections,
            };
        } catch (error) {
            console.error('[VectorStore] Failed to get stats:', error);
            return {
                currentCollection: LANCE_CONFIG.currentCollection,
                embeddingVersion: this.embeddingVersion,
                vectorCount: 0,
                dimensions: EMBEDDING_CONFIG.dimensions,
                allCollections: [],
            };
        }
    }

    // ================= Utility Methods =================

    /**
     * Verify vector store integrity
     * @returns {Promise<Object>}
     */
    async verifyIntegrity() {
        try {
            const stats = await this.getStats();
            const health = {
                connected: this.db !== null,
                collectionActive: this.collection !== null,
                vectorCount: stats.vectorCount,
                expectedDimensions: EMBEDDING_CONFIG.dimensions,
                status: 'healthy',
            };

            return health;
        } catch (error) {
            return {
                connected: false,
                collectionActive: false,
                vectorCount: 0,
                expectedDimensions: EMBEDDING_CONFIG.dimensions,
                status: 'error',
                error: error.message,
            };
        }
    }
}

module.exports = {
    initializeVectorStore,
    getVectorStore,
    VectorStore,
    getOrCreateCollection,
};
