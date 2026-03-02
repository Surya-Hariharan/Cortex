/**
 * Storage Configuration
 * 
 * Central configuration for embedding versioning and storage paths
 */

/**
 * Current embedding version
 * CRITICAL: Changing this requires full reindex via migration
 */
const CURRENT_EMBEDDING_VERSION = 'bge-small-v1';

/**
 * Embedding model metadata
 */
const EMBEDDING_CONFIG = {
    model: 'bge-small-en-v1.5',
    dimensions: 384,
    version: CURRENT_EMBEDDING_VERSION,
    normalization: 'L2', // vectors are L2-normalized
};

/**
 * LanceDB configuration
 */
const LANCE_CONFIG = {
    // Collection name format: embeddings_<version>
    getCollectionName: (version) => `embeddings_${version.replace(/\./g, '_')}`,
    
    // Current collection name
    currentCollection: `embeddings_${CURRENT_EMBEDDING_VERSION.replace(/\./g, '_')}`,
    
    // Batch size for vector inserts
    batchSize: 100,
    
    // Search configuration
    search: {
        defaultLimit: 10,
        maxLimit: 100,
    },
};

/**
 * SQLite configuration
 */
const SQLITE_CONFIG = {
    // Enable WAL mode for concurrent reads
    walMode: true,
    
    // Batch size for inserts
    batchSize: 50,
};

/**
 * Chunking configuration (aligned with current implementation)
 */
const CHUNK_CONFIG = {
    chunkSize: 512,
    overlap: 50,
};

/**
 * Performance limits for scalability
 */
const PERFORMANCE_LIMITS = {
    maxDocuments: 10000,
    maxChunks: 100000,
    maxVectorsInMemory: 5000, // lazy load beyond this
};

module.exports = {
    CURRENT_EMBEDDING_VERSION,
    EMBEDDING_CONFIG,
    LANCE_CONFIG,
    SQLITE_CONFIG,
    CHUNK_CONFIG,
    PERFORMANCE_LIMITS,
};
