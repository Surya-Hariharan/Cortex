const path = require('path');
const os = require('os');
const { extractPdfText } = require('../pdfHandler');
const { aiManager } = require('../ai/runtime/aiManager');
const { hashFile, generateChunkId, generateDocId } = require('./hashUtils');
const { CURRENT_EMBEDDING_VERSION, CHUNK_CONFIG } = require('./config');

/**
 * Document Indexer with Embedding Versioning
 * 
 * Purpose:
 * - Orchestrate PDF → chunks → embeddings → storage
 * - File hash deduplication
 * - Deterministic chunk IDs
 * - Version-aware embedding
 * - Device ownership tracking
 * 
 * Flow:
 * 1. Hash file (deduplication check)
 * 2. Extract & chunk PDF text
 * 3. Generate embeddings (batched)
 * 4. Store metadata (SQLite)
 * 5. Store vectors (LanceDB)
 */

/**
 * Get device ID for ownership tracking
 */
function getDeviceId() {
    return `device_${os.hostname()}_${os.platform()}`;
}

/**
 * Index a single document
 * @param {string} filePath - absolute path to PDF
 * @param {string} title - document title
 * @param {Object} metadataStore - MetadataStore instance
 * @param {Object} vectorStore - VectorStore instance
 * @param {Function} progressCallback - optional progress callback
 * @returns {Promise<Object>} - indexing result
 */
async function indexDocument(filePath, title, metadataStore, vectorStore, progressCallback = null) {
    const startTime = Date.now();
    const ownerDevice = getDeviceId();

    try {
        // Step 1: Hash file for deduplication
        if (progressCallback) progressCallback({ stage: 'hashing', progress: 0 });
        const fileHash = await hashFile(filePath);
        const docId = generateDocId(fileHash);

        // Check if already indexed
        if (metadataStore.documentExistsByHash(fileHash)) {
            console.log(`[Indexer] Document already indexed (hash: ${fileHash})`);
            return {
                success: true,
                skipped: true,
                docId,
                reason: 'Already indexed (duplicate file hash)',
                timeMs: Date.now() - startTime,
            };
        }

        // Step 2: Extract and chunk PDF
        if (progressCallback) progressCallback({ stage: 'extracting', progress: 20 });
        const chunks = await extractPdfText(filePath, CHUNK_CONFIG.chunkSize, CHUNK_CONFIG.overlap);
        console.log(`[Indexer] Extracted ${chunks.length} chunks from: ${title}`);

        // Step 3: Store document metadata
        if (progressCallback) progressCallback({ stage: 'storing_metadata', progress: 40 });
        metadataStore.insertDocument(docId, title, filePath, fileHash, ownerDevice);

        // Step 4: Generate embeddings for all chunks
        if (progressCallback) progressCallback({ stage: 'embedding', progress: 50 });
        const embeddingResults = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const chunkId = generateChunkId(docId, chunk.chunkIndex, CURRENT_EMBEDDING_VERSION);

            // Generate embedding
            const embedding = await aiManager.runEmbedding(chunk.content);

            embeddingResults.push({
                chunkId,
                docId,
                content: chunk.content,
                chunkIndex: chunk.chunkIndex,
                embedding,
            });

            // Progress update
            const progress = 50 + Math.floor((i / chunks.length) * 30);
            if (progressCallback) progressCallback({ stage: 'embedding', progress, current: i + 1, total: chunks.length });
        }

        // Step 5: Batch store chunks metadata (SQLite)
        if (progressCallback) progressCallback({ stage: 'storing_chunks', progress: 80 });
        const now = Date.now();
        const chunksMetadata = embeddingResults.map((r) => ({
            chunkId: r.chunkId,
            docId: r.docId,
            content: r.content,
            chunkIndex: r.chunkIndex,
            embeddingVersion: CURRENT_EMBEDDING_VERSION,
            ownerDevice,
            createdAt: now,
        }));
        metadataStore.insertChunksBatch(chunksMetadata);

        // Step 6: Batch store vectors (LanceDB)
        if (progressCallback) progressCallback({ stage: 'storing_vectors', progress: 90 });
        const vectors = embeddingResults.map((r) => ({
            chunkId: r.chunkId,
            vector: r.embedding,
            docId: r.docId,
            ownerDevice,
        }));
        await vectorStore.insertVectorsBatch(vectors);

        // Complete
        if (progressCallback) progressCallback({ stage: 'complete', progress: 100 });
        const timeMs = Date.now() - startTime;

        console.log(`[Indexer] ✓ Indexed document "${title}" (${chunks.length} chunks) in ${timeMs}ms`);

        return {
            success: true,
            skipped: false,
            docId,
            fileHash,
            title,
            chunkCount: chunks.length,
            embeddingVersion: CURRENT_EMBEDDING_VERSION,
            ownerDevice,
            timeMs,
        };
    } catch (error) {
        console.error(`[Indexer] Failed to index document "${title}":`, error);
        return {
            success: false,
            error: error.message,
            title,
            timeMs: Date.now() - startTime,
        };
    }
}

/**
 * Batch index multiple documents
 * @param {Array<{filePath, title}>} documents
 * @param {Object} metadataStore
 * @param {Object} vectorStore
 * @param {Function} progressCallback - optional callback (docIndex, total, result)
 * @returns {Promise<Object>} - batch indexing result
 */
async function indexDocumentsBatch(documents, metadataStore, vectorStore, progressCallback = null) {
    const startTime = Date.now();
    const results = {
        total: documents.length,
        indexed: 0,
        skipped: 0,
        failed: 0,
        details: [],
    };

    for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        console.log(`[Indexer] Processing document ${i + 1}/${documents.length}: ${doc.title}`);

        const result = await indexDocument(doc.filePath, doc.title, metadataStore, vectorStore);
        
        if (result.success && !result.skipped) {
            results.indexed++;
        } else if (result.skipped) {
            results.skipped++;
        } else {
            results.failed++;
        }

        results.details.push(result);

        if (progressCallback) {
            progressCallback(i + 1, documents.length, result);
        }
    }

    results.timeMs = Date.now() - startTime;
    console.log(`[Indexer] Batch complete: ${results.indexed} indexed, ${results.skipped} skipped, ${results.failed} failed (${results.timeMs}ms)`);

    return results;
}

/**
 * Delete document and all associated data
 * @param {string} docId
 * @param {Object} metadataStore
 * @param {Object} vectorStore
 * @returns {Promise<Object>}
 */
async function deleteDocument(docId, metadataStore, vectorStore) {
    try {
        // Get document info before deletion
        const doc = metadataStore.getDocument(docId);
        if (!doc) {
            return {
                success: false,
                error: 'Document not found',
            };
        }

        // Delete from vector store
        await vectorStore.deleteVectorsByDoc(docId);

        // Delete from metadata store (cascades to chunks)
        metadataStore.deleteDocument(docId);

        console.log(`[Indexer] ✓ Deleted document: ${docId}`);

        return {
            success: true,
            docId,
            title: doc.title,
        };
    } catch (error) {
        console.error(`[Indexer] Failed to delete document ${docId}:`, error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Reindex a document (useful after embedding version change)
 * @param {string} docId
 * @param {Object} metadataStore
 * @param {Object} vectorStore
 * @returns {Promise<Object>}
 */
async function reindexDocument(docId, metadataStore, vectorStore) {
    try {
        // Get document metadata
        const doc = metadataStore.getDocument(docId);
        if (!doc) {
            return {
                success: false,
                error: 'Document not found',
            };
        }

        // Delete old data
        await deleteDocument(docId, metadataStore, vectorStore);

        // Reindex with new version
        return await indexDocument(doc.file_path, doc.title, metadataStore, vectorStore);
    } catch (error) {
        console.error(`[Indexer] Failed to reindex document ${docId}:`, error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Get indexing statistics
 * @param {Object} metadataStore
 * @param {Object} vectorStore
 * @returns {Promise<Object>}
 */
async function getIndexingStats(metadataStore, vectorStore) {
    try {
        const metadataStats = metadataStore.getStorageStats();
        const vectorStats = await vectorStore.getStats();

        return {
            documents: metadataStats.documents,
            chunks: metadataStats.chunks,
            vectors: vectorStats.vectorCount,
            embeddingVersion: CURRENT_EMBEDDING_VERSION,
            versionBreakdown: metadataStats.embeddingVersions,
            devices: metadataStats.devices,
            collections: vectorStats.allCollections,
            needsMigration: metadataStats.needsMigration !== null,
            outdatedVersions: metadataStats.needsMigration,
        };
    } catch (error) {
        console.error('[Indexer] Failed to get stats:', error);
        return {
            documents: 0,
            chunks: 0,
            vectors: 0,
            embeddingVersion: CURRENT_EMBEDDING_VERSION,
            error: error.message,
        };
    }
}

/**
 * Verify indexing integrity (metadata vs vectors)
 * @param {Object} metadataStore
 * @param {Object} vectorStore
 * @returns {Promise<Object>}
 */
async function verifyIntegrity(metadataStore, vectorStore) {
    try {
        const metadataStats = metadataStore.getStorageStats();
        const vectorStats = await vectorStore.getStats();

        // Count chunks for current version
        const currentVersionChunks = metadataStats.embeddingVersions.find(
            (v) => v.embedding_version === CURRENT_EMBEDDING_VERSION
        );
        const expectedVectors = currentVersionChunks ? currentVersionChunks.count : 0;

        const integrity = {
            healthy: expectedVectors === vectorStats.vectorCount,
            expectedVectors,
            actualVectors: vectorStats.vectorCount,
            mismatch: Math.abs(expectedVectors - vectorStats.vectorCount),
            timestamp: Date.now(),
        };

        if (!integrity.healthy) {
            console.warn(`[Indexer] Integrity mismatch: expected ${expectedVectors} vectors, found ${vectorStats.vectorCount}`);
        }

        return integrity;
    } catch (error) {
        console.error('[Indexer] Integrity check failed:', error);
        return {
            healthy: false,
            error: error.message,
        };
    }
}

module.exports = {
    indexDocument,
    indexDocumentsBatch,
    deleteDocument,
    reindexDocument,
    getIndexingStats,
    verifyIntegrity,
    getDeviceId,
};
