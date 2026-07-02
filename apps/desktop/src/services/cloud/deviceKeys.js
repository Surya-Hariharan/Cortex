/**
 * Cortex — Cloud Device Keypair
 *
 * An RSA-OAEP keypair generated once per device, the first time cloud sync
 * is enabled. Its only job is wrapping/unwrapping the user's symmetric
 * "cloud content key" (see contentKey.js) so the server can hand a device
 * an encrypted copy of that key without the server itself ever holding a
 * usable key — the same pattern the schema already uses for workspace
 * wrapped_content_key (see apps/server/docs/DATABASE.md).
 *
 * The private key is persisted encrypted at rest with the same device
 * master key as local notes/documents (encryption.js / keyStore.js), in a
 * file separate from both the local offline session and the cloud auth
 * session — losing it just means this device re-registers a fresh keypair
 * and needs a new wrapped copy of the content key from another device.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { encryptText, decryptText } = require('../storage/encryption');

const FILENAME = 'cortex-cloud-device-key.json';
const MODULUS_LENGTH = 2048;

let _filePath = null;
let _keyPair = null; // { publicKey, privateKey } PEM strings

function initDeviceKeys(userDataPath) {
    _filePath = path.join(userDataPath, FILENAME);
}

function _load() {
    if (!_filePath || !fs.existsSync(_filePath)) return null;
    try {
        const raw = JSON.parse(fs.readFileSync(_filePath, 'utf8'));
        return { publicKey: raw.publicKey, privateKey: decryptText(raw.encryptedPrivateKey) };
    } catch {
        return null;
    }
}

function _save(keyPair) {
    fs.writeFileSync(
        _filePath,
        JSON.stringify({ publicKey: keyPair.publicKey, encryptedPrivateKey: encryptText(keyPair.privateKey) }),
        { mode: 0o600 }
    );
}

// Generates a new RSA-OAEP keypair on first call, reuses it on every
// subsequent call.
function ensureDeviceKeyPair() {
    if (_keyPair) return _keyPair;
    if (!_filePath) throw new Error('[deviceKeys] Not initialised. Call initDeviceKeys(userDataPath) first.');

    const loaded = _load();
    if (loaded) {
        _keyPair = loaded;
        return _keyPair;
    }

    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: MODULUS_LENGTH,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    _keyPair = { publicKey, privateKey };
    _save(_keyPair);
    return _keyPair;
}

function getPublicKey() {
    return ensureDeviceKeyPair().publicKey;
}

// Wraps a raw symmetric key (Buffer) to a device's RSA-OAEP public key.
// Defaults to this device's own public key.
function wrapKeyForDevice(rawKey, publicKeyPem = getPublicKey()) {
    return crypto.publicEncrypt({ key: publicKeyPem, oaepHash: 'sha256' }, rawKey).toString('base64');
}

// Unwraps a base64 wrapped key using this device's private key.
function unwrapKeyForDevice(wrappedBase64) {
    const { privateKey } = ensureDeviceKeyPair();
    return crypto.privateDecrypt({ key: privateKey, oaepHash: 'sha256' }, Buffer.from(wrappedBase64, 'base64'));
}

// Wipes the on-disk keypair — used when the cloud account is deleted, since
// a keypair for a now-nonexistent account is meaningless. A fresh keypair
// is generated automatically the next time cloud sync is enabled.
function clearDeviceKeys() {
    _keyPair = null;
    if (_filePath && fs.existsSync(_filePath)) fs.unlinkSync(_filePath);
}

// Test-only: clears in-memory state without touching disk, so a test can
// simulate a fresh process re-reading the persisted keypair from a prior
// initDeviceKeys() call. Mirrors keyStore.js's _reset().
function _reset() {
    _keyPair = null;
}

module.exports = {
    initDeviceKeys,
    ensureDeviceKeyPair,
    getPublicKey,
    wrapKeyForDevice,
    unwrapKeyForDevice,
    clearDeviceKeys,
    _reset,
};
