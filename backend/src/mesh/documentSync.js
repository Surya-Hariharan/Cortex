/**
 * Document Sync Module (Phase 2C - Metadata Only)
 * 
 * Handles document metadata exchange between peers.
 * NOT implementing full document content sync yet - that's for future phases.
 * 
 * This module:
 * - Prepares document metadata for sharing
 * - Validates incoming metadata
 * - Manages peer document registry
 * - Provides stub for future full sync
 */

/**
 * Prepare local documents for metadata sharing
 * 
 * @param {Object} db - Database instance
 * @returns {Array} Array of document metadata
 */
function prepareDocumentMetadata(db) {
    try {
        const embeddings = db.getAllEmbeddings();
        
        // Group by document ID to get chunk counts
        const docMap = new Map();
        
        for (const emb of embeddings) {
            const key = emb.docId;
            if (!docMap.has(key)) {
                docMap.set(key, {
                    docId: String(emb.docId),
                    title: emb.title,
                    subject: emb.subject,
                    embeddingVersion: 'bge-small-v1.5',
                    chunkCount: 0,
                    lastModified: Date.now() // Would be from DB in production
                });
            }
            const doc = docMap.get(key);
            doc.chunkCount++;
        }
        
        return Array.from(docMap.values());
    } catch (error) {
        console.error('[DocumentSync] Error preparing metadata:', error);
        return [];
    }
}

/**
 * Validate incoming document metadata
 * 
 * @param {Object} metadata - Metadata to validate
 * @returns {boolean} True if valid
 */
function validateDocumentMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object') {
        return false;
    }
    
    const required = ['docId', 'title', 'embeddingVersion', 'chunkCount', 'lastModified'];
    
    for (const field of required) {
        if (!(field in metadata)) {
            console.warn(`[DocumentSync] Missing required field: ${field}`);
            return false;
        }
    }
    
    // Type checks
    if (typeof metadata.docId !== 'string') return false;
    if (typeof metadata.title !== 'string') return false;
    if (typeof metadata.embeddingVersion !== 'string') return false;
    if (typeof metadata.chunkCount !== 'number' || metadata.chunkCount < 0) return false;
    if (typeof metadata.lastModified !== 'number') return false;
    
    return true;
}

/**
 * Store peer document metadata in database
 * 
 * @param {Object} db - Database instance
 * @param {string} peerId - Source peer ID
 * @param {Array} metadataList - List of document metadata
 * @returns {number} Number of documents stored
 */
function storePeerDocuments(db, peerId, metadataList) {
    try {
        let stored = 0;
        
        for (const metadata of metadataList) {
            if (!validateDocumentMetadata(metadata)) {
                console.warn('[DocumentSync] Skipping invalid metadata:', metadata);
                continue;
            }
            
            db.upsertPeerDocument(
                peerId,
                metadata.docId,
                metadata.title,
                metadata.subject || 'Unknown',
                metadata.chunkCount,
                metadata.lastModified
            );
            
            stored++;
        }
        
        console.log(`[DocumentSync] Stored ${stored} document metadata from peer ${peerId.substring(0, 8)}`);
        return stored;
    } catch (error) {
        console.error('[DocumentSync] Error storing peer documents:', error);
        return 0;
    }
}

/**
 * Get all documents shared by a specific peer
 * 
 * @param {Object} db - Database instance
 * @param {string} peerId - Peer ID
 * @returns {Array} List of document metadata
 */
function getPeerDocuments(db, peerId) {
    try {
        return db.getPeerDocuments(peerId);
    } catch (error) {
        console.error('[DocumentSync] Error getting peer documents:', error);
        return [];
    }
}

/**
 * Request full document from peer (STUB - Not implemented yet)
 * This is a placeholder for Phase 2D when we implement actual document transfer
 * 
 * @param {string} peerId - Target peer ID
 * @param {string} docId - Document ID to request
 * @returns {Promise<Object>} Document data (throws Not Implemented)
 */
async function requestDocument(peerId, docId) {
    throw new Error(
        `Document request not implemented. ` +
        `Requesting docId=${docId} from peer=${peerId.substring(0, 8)}. ` +
        `This feature will be available in a future phase.`
    );
}

/**
 * Check if a document should be synced
 * (Placeholder for future conflict resolution logic)
 * 
 * @param {Object} localMetadata - Local document metadata
 * @param {Object} remoteMetadata - Remote document metadata
 * @returns {boolean} True if should sync
 */
function shouldSyncDocument(localMetadata, remoteMetadata) {
    // For now, just check if remote is newer
    if (!localMetadata) return true;
    if (!remoteMetadata) return false;
    
    return remoteMetadata.lastModified > localMetadata.lastModified;
}

module.exports = {
    prepareDocumentMetadata,
    validateDocumentMetadata,
    storePeerDocuments,
    getPeerDocuments,
    requestDocument,
    shouldSyncDocument
};
