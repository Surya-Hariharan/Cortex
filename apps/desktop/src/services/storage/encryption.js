/**
 * Cortex — AES-256-GCM at-rest encryption
 *
 * Uses a randomly-generated per-device master key managed by keyStore.js.
 * Legacy data encrypted with the old hostname-derived key is transparently
 * re-readable via the legacy-key fallback path.
 */

const crypto = require('crypto');
const { getMasterKey, getLegacyKey } = require('./keyStore');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

// ── Internal helpers ──────────────────────────────────────────────────────────

function _encrypt(plaintext, key) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function _decrypt(cipherBase64, key) {
    const data = Buffer.from(cipherBase64, 'base64');
    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext, null, 'utf8') + decipher.final('utf8');
}

function _encryptBuffer(buffer, key) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]);
}

function _decryptBuffer(encryptedBuffer, key) {
    const iv = encryptedBuffer.subarray(0, IV_LENGTH);
    const authTag = encryptedBuffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = encryptedBuffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Encrypt a UTF-8 string → Base64 ciphertext using the current master key.
 */
function encryptText(plaintext) {
    if (!plaintext) return plaintext;
    return _encrypt(plaintext, getMasterKey());
}

/**
 * Decrypt Base64 ciphertext → UTF-8 string.
 * Falls back to the legacy hostname-derived key for pre-migration data.
 * Falls back to returning the raw value if it was stored unencrypted.
 */
function decryptText(cipherBase64) {
    if (!cipherBase64) return cipherBase64;
    try {
        return _decrypt(cipherBase64, getMasterKey());
    } catch {
        // Migration path: try the legacy hostname-derived key
        try {
            return _decrypt(cipherBase64, getLegacyKey());
        } catch {
            // Last resort: may be plaintext stored before any encryption was added
            return cipherBase64;
        }
    }
}

/**
 * Encrypt a Float32Array embedding → encrypted Buffer using the current master key.
 */
function encryptEmbedding(vector) {
    const buffer = Buffer.from(new Float32Array(vector).buffer);
    return _encryptBuffer(buffer, getMasterKey());
}

/**
 * Decrypt an encrypted Buffer → Float32Array values.
 * Falls back to the legacy key, then to raw interpretation.
 */
function decryptEmbedding(encryptedBuffer) {
    try {
        const decrypted = _decryptBuffer(encryptedBuffer, getMasterKey());
        return Array.from(new Float32Array(decrypted.buffer, decrypted.byteOffset, decrypted.byteLength / 4));
    } catch {
        try {
            const decrypted = _decryptBuffer(encryptedBuffer, getLegacyKey());
            return Array.from(new Float32Array(decrypted.buffer, decrypted.byteOffset, decrypted.byteLength / 4));
        } catch {
            return Array.from(new Float32Array(
                encryptedBuffer.buffer,
                encryptedBuffer.byteOffset,
                encryptedBuffer.byteLength / 4,
            ));
        }
    }
}

module.exports = { encryptText, decryptText, encryptEmbedding, decryptEmbedding, _encrypt, _decrypt, _encryptBuffer, _decryptBuffer };
