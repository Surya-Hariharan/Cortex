const crypto = require('crypto');

/**
 * Crypto Utilities for Mesh Networking
 * 
 * Provides cryptographic primitives for:
 * - Peer ID generation and persistence
 * - Message signing and verification
 * - Data integrity checks
 * 
 * Note: Transport-level encryption is handled by Noise protocol in libp2p
 * These utilities are for application-level crypto needs
 */

/**
 * Generate a deterministic peer ID seed
 * This should be persisted in the database for consistent identity
 * 
 * @returns {string} Hex-encoded random seed
 */
function generatePeerSeed() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash data using SHA-256
 * 
 * @param {string|Buffer} data - Data to hash
 * @returns {string} Hex-encoded hash
 */
function hashData(data) {
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
}

/**
 * Generate a unique document ID
 * 
 * @param {string} title - Document title
 * @param {string} content - Document content
 * @param {number} timestamp - Creation timestamp
 * @returns {string} Unique document identifier
 */
function generateDocumentId(title, content, timestamp) {
    const combined = `${title}:${content.substring(0, 100)}:${timestamp}`;
    return hashData(combined);
}

/**
 * Verify data integrity using checksum
 * 
 * @param {string} data - Original data
 * @param {string} checksum - Expected checksum
 * @returns {boolean} True if checksum matches
 */
function verifyChecksum(data, checksum) {
    const computed = hashData(data);
    return computed === checksum;
}

/**
 * Create a signed message
 * Simple HMAC-based signing for message authentication
 * 
 * @param {Object} message - Message to sign
 * @param {string} secret - Shared secret (peer ID seed)
 * @returns {Object} Signed message with signature
 */
function signMessage(message, secret) {
    const payload = JSON.stringify(message);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const signature = hmac.digest('hex');
    
    return {
        payload: message,
        signature,
        timestamp: Date.now()
    };
}

/**
 * Verify a signed message
 * 
 * @param {Object} signedMessage - Message with signature
 * @param {string} secret - Shared secret
 * @returns {boolean} True if signature is valid
 */
function verifySignature(signedMessage, secret) {
    try {
        const { payload, signature } = signedMessage;
        const reconstructed = signMessage(payload, secret);
        return reconstructed.signature === signature;
    } catch (error) {
        return false;
    }
}

/**
 * Generate a random session ID
 * 
 * @returns {string} Random session identifier
 */
function generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
}

module.exports = {
    generatePeerSeed,
    hashData,
    generateDocumentId,
    verifyChecksum,
    signMessage,
    verifySignature,
    generateSessionId
};
