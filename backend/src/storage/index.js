/**
 * Storage Module - Phase 2D Entry Point
 * 
 * Exports all storage components for clean imports
 */

// Main public API
const { storageManager, StorageManager } = require('./storageManager');

// Core stores (for advanced usage)
const { initializeMetadataStore, getMetadataStore, MetadataStore } = require('./metadataStore');
const { initializeVectorStore, getVectorStore, VectorStore } = require('./vectorStore');

// Indexing
const { 
    indexDocument, 
    indexDocumentsBatch, 
    deleteDocument, 
    reindexDocument, 
    getIndexingStats, 
    verifyIntegrity,
    getDeviceId 
} = require('./indexer');

// Utilities
const { 
    hashFile, 
    generateChunkId, 
    generateDocId, 
    hashString 
} = require('./hashUtils');

// Configuration
const { 
    CURRENT_EMBEDDING_VERSION, 
    EMBEDDING_CONFIG, 
    LANCE_CONFIG, 
    SQLITE_CONFIG,
    CHUNK_CONFIG,
    PERFORMANCE_LIMITS
} = require('./config');

// Migration tools
const { 
    checkMigrationNeeded, 
    migrateAllDocuments, 
    migrateSingleDocument,
    cleanupOldCollections,
    getMigrationPlan,
    rollbackMigration
} = require('./migrations/vectorMigration');

// Recommended usage: Use storageManager for all operations
module.exports = {
    // Primary API (use this!)
    storageManager,
    
    // Advanced/Internal APIs (use only if needed)
    StorageManager,
    MetadataStore,
    VectorStore,
    
    // Utilities
    hashFile,
    generateChunkId,
    generateDocId,
    hashString,
    getDeviceId,
    
    // Configuration
    CURRENT_EMBEDDING_VERSION,
    EMBEDDING_CONFIG,
    LANCE_CONFIG,
    
    // Migration
    checkMigrationNeeded,
    getMigrationPlan,
};
