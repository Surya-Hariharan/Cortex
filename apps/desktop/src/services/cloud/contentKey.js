/**
 * Cortex — Cloud Content Key
 *
 * One AES-256 symmetric key per user, generated on whichever device first
 * enables cloud sync, and made available to every other device the same
 * user signs into by wrapping it (RSA-OAEP, see deviceKeys.js) to each
 * device's public key. The server stores a wrapped copy per device
 * (devices.wrapped_user_key) but never a usable key — see
 * docs/ARCHITECTURE.md "Optional Cloud Backend".
 *
 * This key is what syncEngine.js uses to encrypt notes/pages before upload
 * and decrypt what pull/restore bring back down. It is never derived from
 * or related to the local device master key (keyStore.js) — that key is
 * device-local by design and wouldn't be recoverable on a second device.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { encryptText, decryptText } = require('../storage/encryption');
const deviceKeys = require('./deviceKeys');

const FILENAME = 'cortex-cloud-content-key.json';
const KEY_LENGTH = 32;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

let _filePath = null;
let _contentKey = null; // Buffer

function initContentKey(userDataPath) {
    _filePath = path.join(userDataPath, FILENAME);
}

function _load() {
    if (!_filePath || !fs.existsSync(_filePath)) return null;
    try {
        return Buffer.from(decryptText(fs.readFileSync(_filePath, 'utf8')), 'base64');
    } catch {
        return null;
    }
}

function _save(key) {
    fs.writeFileSync(_filePath, encryptText(key.toString('base64')), { mode: 0o600 });
}

function hasContentKey() {
    if (_contentKey) return true;
    _contentKey = _load();
    return !!_contentKey;
}

function getContentKey() {
    if (_contentKey) return _contentKey;
    const loaded = _load();
    if (loaded) {
        _contentKey = loaded;
        return _contentKey;
    }
    throw new Error('[contentKey] No content key established yet. Call generateAndWrap() or adoptWrapped() first.');
}

// First device (per user) to enable cloud sync calls this: generates a
// fresh key, persists it locally, and returns the wrapped copy the caller
// should upload to the server for *this* device (devices.wrapped_user_key).
function generateAndWrap() {
    _contentKey = crypto.randomBytes(KEY_LENGTH);
    _save(_contentKey);
    return deviceKeys.wrapKeyForDevice(_contentKey);
}

// A subsequent device calls this after fetching its own wrapped copy from
// the server: unwraps with this device's private key and persists locally.
function adoptWrapped(wrappedBase64) {
    _contentKey = deviceKeys.unwrapKeyForDevice(wrappedBase64);
    _save(_contentKey);
}

// Wraps the already-established content key for a *different* device's
// public key — used when a new device registers and the server asks an
// already-enrolled device to mint that device's wrapped copy.
function wrapForDevice(publicKeyPem) {
    return deviceKeys.wrapKeyForDevice(getContentKey(), publicKeyPem);
}

// Encrypts a JSON-serializable value with the content key, producing the
// separate {ciphertext, nonce} base64 pair the server's sync_blobs schema
// expects (see apps/server/src/models/sync.schemas.js) — the server only
// ever stores these as opaque bytes.
function encryptResource(value) {
    const key = getContentKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const json = JSON.stringify(value);
    const ciphertext = Buffer.concat([cipher.update(json, 'utf8'), cipher.final(), cipher.getAuthTag()]);
    return { ciphertext: ciphertext.toString('base64'), nonce: iv.toString('base64') };
}

function decryptResource({ ciphertext, nonce }) {
    const key = getContentKey();
    const iv = Buffer.from(nonce, 'base64');
    const data = Buffer.from(ciphertext, 'base64');
    const authTag = data.subarray(data.length - AUTH_TAG_LENGTH);
    const encrypted = data.subarray(0, data.length - AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const json = decipher.update(encrypted, null, 'utf8') + decipher.final('utf8');
    return JSON.parse(json);
}

// Wipes the on-disk content key — used when the cloud account is deleted.
function clearContentKey() {
    _contentKey = null;
    if (_filePath && fs.existsSync(_filePath)) fs.unlinkSync(_filePath);
}

// Test-only: clears in-memory state without touching disk — mirrors
// keyStore.js's _reset() / deviceKeys.js's _reset().
function _reset() {
    _contentKey = null;
}

module.exports = {
    initContentKey,
    hasContentKey,
    getContentKey,
    generateAndWrap,
    adoptWrapped,
    wrapForDevice,
    encryptResource,
    decryptResource,
    clearContentKey,
    _reset,
};
