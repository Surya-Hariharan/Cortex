const { CURRENT_EMBEDDING_VERSION } = require('../config');
const { indexDocument, deleteDocument } = require('../indexer');
const { generateChunkId } = require('../hashUtils');

/**
 * Vector Migration Utilities
 * 
 * Purpose:
 * - Migrate embeddings when model version changes
 * - Safe, controlled migration process
 * - Preserves data integrity
 * - Prevents silent embedding mixing
 * 
 * Migration Flow:
 * 1. Detect version mismatch
 * 2. Create new LanceDB collection
 * 3. Re-embed all chunks with new model
 * 4. Update SQLite version fields
 * 5. Optionally delete old collection
 */

/**
 * Check if migration is needed
 * @param {Object} metadataStore
 * @returns {Object|null} - migration info or null
 */
function checkMigrationNeeded(metadataStore) {
    const outdatedVersions = metadataStore.needsMigration();

    if (!outdatedVersions) {
        return null;
    }

    const stats = metadataStore.getStorageStats();
    const outdatedChunks = outdatedVersions.reduce((sum, v) => {
        const versionChunks = stats.embeddingVersions.find(
            (ev) => ev.embedding_version === v.embedding_version
        );
        return sum + (versionChunks ? versionChunks.count : 0);
    }, 0);

    return {
        currentVersion: CURRENT_EMBEDDING_VERSION,
        outdatedVersions: outdatedVersions.map((v) => v.embedding_version),
        affectedChunks: outdatedChunks,
        affectedDocuments: stats.documents,
        migrationRequired: true,
    };
}

/**
 * Migrate all documents to current embedding version
 * @param {Object} metadataStore
 * @param {Object} vectorStore
 * @param {Function} progressCallback - optional (docIndex, total, status)
 * @returns {Promise<Object>}
 */
async function migrateAllDocuments(metadataStore, vectorStore, progressCallback = null) {
    const startTime = Date.now();

    try {
        // Get all documents
        const documents = metadataStore.getAllDocuments();
        console.log(`[Migration] Starting migration for ${documents.length} documents`);

        const results = {
            total: documents.length,
            migrated: 0,
            failed: 0,
            skipped: 0,
            details: [],
        };

        // Switch to new collection (create if doesn't exist)
        await vectorStore.switchCollection(CURRENT_EMBEDDING_VERSION);

        // Migrate each document
        for (let i = 0; i < documents.length; i++) {
            const doc = documents[i];
            console.log(`[Migration] Processing ${i + 1}/${documents.length}: ${doc.title}`);

            try {
                // Get existing chunks
                const chunks = metadataStore.getDocumentChunks(doc.doc_id);
                
                // Check if already migrated
                const needsMigration = chunks.some(
                    (c) => c.embedding_version !== CURRENT_EMBEDDING_VERSION
                );

                if (!needsMigration) {
                    console.log(`[Migration] Skipping ${doc.title} - already current version`);
                    results.skipped++;
                    results.details.push({
                        docId: doc.doc_id,
                        title: doc.title,
                        status: 'skipped',
                    });

                    if (progressCallback) {
                        progressCallback(i + 1, documents.length, 'skipped');
                    }
                    continue;
                }

                // Delete old vectors
                await vectorStore.deleteVectorsByDoc(doc.doc_id);

                // Delete old chunks from metadata
                metadataStore.deleteChunks(doc.doc_id);

                // Reindex with new version
                const result = await indexDocument(
                    doc.file_path,
                    doc.title,
                    metadataStore,
                    vectorStore
                );

                if (result.success) {
                    results.migrated++;
                    results.details.push({
                        docId: doc.doc_id,
                        title: doc.title,
                        status: 'migrated',
                        chunkCount: result.chunkCount,
                    });
                } else {
                    results.failed++;
                    results.details.push({
                        docId: doc.doc_id,
                        title: doc.title,
                        status: 'failed',
                        error: result.error,
                    });
                }

                if (progressCallback) {
                    progressCallback(i + 1, documents.length, result.success ? 'migrated' : 'failed');
                }
            } catch (error) {
                console.error(`[Migration] Failed to migrate ${doc.title}:`, error);
                results.failed++;
                results.details.push({
                    docId: doc.doc_id,
                    title: doc.title,
                    status: 'failed',
                    error: error.message,
                });

                if (progressCallback) {
                    progressCallback(i + 1, documents.length, 'failed');
                }
            }
        }

        results.timeMs = Date.now() - startTime;
        console.log(`[Migration] Complete: ${results.migrated} migrated, ${results.skipped} skipped, ${results.failed} failed (${results.timeMs}ms)`);

        return {
            success: results.failed === 0,
            ...results,
        };
    } catch (error) {
        console.error('[Migration] Migration failed:', error);
        return {
            success: false,
            error: error.message,
            timeMs: Date.now() - startTime,
        };
    }
}

/**
 * Migrate a single document
 * @param {string} docId
 * @param {Object} metadataStore
 * @param {Object} vectorStore
 * @returns {Promise<Object>}
 */
async function migrateSingleDocument(docId, metadataStore, vectorStore) {
    try {
        const doc = metadataStore.getDocument(docId);
        if (!doc) {
            return {
                success: false,
                error: 'Document not found',
            };
        }

        // Delete old vectors
        await vectorStore.deleteVectorsByDoc(docId);

        // Delete old chunks
        metadataStore.deleteChunks(docId);

        // Reindex with current version
        const result = await indexDocument(
            doc.file_path,
            doc.title,
            metadataStore,
            vectorStore
        );

        return result;
    } catch (error) {
        console.error(`[Migration] Failed to migrate document ${docId}:`, error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Clean up old embedding collections
 * @param {Object} vectorStore
 * @param {Array<string>} versionsToDelete - embedding versions to remove
 * @returns {Promise<Object>}
 */
async function cleanupOldCollections(vectorStore, versionsToDelete) {
    const results = {
        deleted: [],
        failed: [],
    };

    for (const version of versionsToDelete) {
        // Safety check
        if (version === CURRENT_EMBEDDING_VERSION) {
            console.warn(`[Migration] Skipping current version: ${version}`);
            continue;
        }

        try {
            await vectorStore.dropCollection(version);
            results.deleted.push(version);
            console.log(`[Migration] Deleted collection for version: ${version}`);
        } catch (error) {
            console.error(`[Migration] Failed to delete collection ${version}:`, error);
            results.failed.push({
                version,
                error: error.message,
            });
        }
    }

    return {
        success: results.failed.length === 0,
        deleted: results.deleted,
        failed: results.failed,
    };
}

/**
 * Get migration plan (dry run)
 * @param {Object} metadataStore
 * @returns {Object}
 */
function getMigrationPlan(metadataStore) {
    const migrationInfo = checkMigrationNeeded(metadataStore);

    if (!migrationInfo) {
        return {
            required: false,
            message: 'All embeddings are up to date',
        };
    }

    const stats = metadataStore.getStorageStats();
    
    return {
        required: true,
        currentVersion: CURRENT_EMBEDDING_VERSION,
        outdatedVersions: migrationInfo.outdatedVersions,
        affectedDocuments: migrationInfo.affectedDocuments,
        affectedChunks: migrationInfo.affectedChunks,
        estimatedTimeMinutes: Math.ceil((migrationInfo.affectedChunks * 0.5) / 60), // ~0.5s per chunk
        versionBreakdown: stats.embeddingVersions,
        actions: [
            '1. Backup current database (recommended)',
            '2. Create new LanceDB collection for ' + CURRENT_EMBEDDING_VERSION,
            '3. Re-embed all chunks with current model',
            '4. Update metadata store version fields',
            '5. Verify integrity',
            '6. Optionally delete old collections',
        ],
    };
}

/**
 * Rollback migration (restore from backup)
 * Note: This requires manual backup/restore - just a placeholder
 * @returns {Object}
 */
function rollbackMigration() {
    return {
        success: false,
        message: 'Rollback requires manual database restore from backup',
        instructions: [
            '1. Stop Cortex application',
            '2. Restore SQLite database from backup',
            '3. Restore LanceDB directory from backup',
            '4. Restart Cortex',
        ],
    };
}

module.exports = {
    checkMigrationNeeded,
    migrateAllDocuments,
    migrateSingleDocument,
    cleanupOldCollections,
    getMigrationPlan,
    rollbackMigration,
};
