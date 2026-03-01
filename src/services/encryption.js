/**
 * Cortex — Application-level AES-256-GCM encryption
 * Encrypts document content and embeddings at rest in SQLite.
 * Key is derived from a device-specific machine ID using PBKDF2.
 */

const crypto = require('crypto');
const os = require('os');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;       // GCM standard
const AUTH_TAG_LENGTH = 16;  // bytes
const SALT = 'cortex-offline-ai-v1'; // static salt (device-bound key makes this safe for demo)

/**
 * Derive a device-specific encryption key using PBKDF2.
 * Uses hostname + username + arch as a device fingerprint.
 */
function deriveKey() {
    const machineId = `${os.hostname()}-${os.userInfo().username}-${os.arch()}-${os.platform()}`;
    return crypto.pbkdf2Sync(machineId, SALT, 100000, 32, 'sha256');
}

const KEY = deriveKey();

/**
 * Encrypt a UTF-8 string → Base64 ciphertext (iv + authTag + ciphertext)
 */
function encryptText(plaintext) {
    if (!plaintext) return plaintext;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // Pack: iv (12) + authTag (16) + ciphertext
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypt Base64 ciphertext → UTF-8 string
 */
function decryptText(cipherBase64) {
    if (!cipherBase64) return cipherBase64;
    try {
        const data = Buffer.from(cipherBase64, 'base64');
        const iv = data.subarray(0, IV_LENGTH);
        const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
        const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
        decipher.setAuthTag(authTag);
        return decipher.update(ciphertext, null, 'utf8') + decipher.final('utf8');
    } catch (err) {
        // If decryption fails, data might be stored unencrypted (legacy) — return as-is
        return cipherBase64;
    }
}

/**
 * Encrypt a Float32Array embedding → encrypted Buffer
 */
function encryptEmbedding(vector) {
    const buffer = Buffer.from(new Float32Array(vector).buffer);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * Decrypt an encrypted Buffer → Float32Array values
 */
function decryptEmbedding(encryptedBuffer) {
    try {
        const iv = encryptedBuffer.subarray(0, IV_LENGTH);
        const authTag = encryptedBuffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const ciphertext = encryptedBuffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
        const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return Array.from(new Float32Array(decrypted.buffer, decrypted.byteOffset, decrypted.byteLength / 4));
    } catch (err) {
        // Fallback for unencrypted legacy data
        return Array.from(new Float32Array(
            encryptedBuffer.buffer,
            encryptedBuffer.byteOffset,
            encryptedBuffer.byteLength / 4
        ));
    }
}

module.exports = { encryptText, decryptText, encryptEmbedding, decryptEmbedding };
