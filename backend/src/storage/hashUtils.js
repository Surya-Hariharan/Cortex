const crypto = require('crypto');
const fs = require('fs');

/**
 * Hash Utilities for File Integrity & Deterministic Chunk IDs
 * 
 * Purpose:
 * - Generate SHA-256 hashes for file deduplication
 * - Create deterministic chunk IDs for mesh sync
 * - Ensure consistency across devices
 */

/**
 * Generate SHA-256 hash of a file
 * @param {string} filePath - absolute path to file
 * @returns {Promise<string>} - hex-encoded hash
 */
async function hashFile(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

/**
 * Generate deterministic chunk ID
 * @param {string} docId - document identifier
 * @param {number} chunkIndex - chunk position
 * @param {string} embeddingVersion - e.g., "bge-small-v1"
 * @returns {string} - deterministic chunk ID
 */
function generateChunkId(docId, chunkIndex, embeddingVersion) {
    const input = `${docId}:${chunkIndex}:${embeddingVersion}`;
    return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Generate document ID from file hash
 * @param {string} fileHash - SHA-256 hash of file
 * @returns {string} - document ID
 */
function generateDocId(fileHash) {
    // Use first 16 characters of file hash as doc ID
    return `doc_${fileHash.substring(0, 16)}`;
}

/**
 * Hash a string (for metadata integrity)
 * @param {string} content - string to hash
 * @returns {string} - hex-encoded hash
 */
function hashString(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
}

module.exports = {
    hashFile,
    generateChunkId,
    generateDocId,
    hashString,
};
