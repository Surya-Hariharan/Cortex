/**
 * Cortex — Device Master Key Store
 *
 * Manages a randomly-generated 256-bit AES key stored in electron-store.
 * Replaces the hostname-derived key which was predictable and lost on OS reinstall.
 *
 * The key is generated once, stored encrypted by electron-store, and reused on
 * every subsequent launch.  A legacy-key factory is accepted so that data
 * encrypted with the old hostname-based key can still be decrypted transparently.
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const KEY_FILENAME = 'cortex-device-key.json';
const KEY_LENGTH = 32; // 256 bits

let _masterKey = null;
let _legacyKey = null;
let _keyFilePath = null;

/**
 * Derive the legacy hostname-based key (kept only for decryption of old data).
 */
function _deriveLegacyKey() {
  const os = require('os');
  const machineId = `${os.hostname()}-${os.userInfo().username}-${os.arch()}-${os.platform()}`;
  return crypto.pbkdf2Sync(machineId, 'cortex-offline-ai-v1', 100000, 32, 'sha256');
}

/**
 * Initialize the key store.
 * Must be called once from the Electron main process before any encrypt/decrypt.
 *
 * @param {string} userDataPath - Electron's app.getPath('userData')
 */
function initKeyStore(userDataPath) {
  _keyFilePath = path.join(userDataPath, KEY_FILENAME);
  _legacyKey = _deriveLegacyKey();

  if (fs.existsSync(_keyFilePath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(_keyFilePath, 'utf8'));
      _masterKey = Buffer.from(raw.key, 'hex');
      if (_masterKey.length !== KEY_LENGTH) throw new Error('Key length mismatch');
      return;
    } catch {
      // Key file corrupted — generate a new key (existing data falls back to legacy key)
    }
  }

  // First run — generate and persist a random key
  _masterKey = crypto.randomBytes(KEY_LENGTH);
  fs.writeFileSync(_keyFilePath, JSON.stringify({ key: _masterKey.toString('hex'), v: 1 }), {
    mode: 0o600,
  });
}

/**
 * Returns the current master encryption key (Buffer, 32 bytes).
 * Throws if initKeyStore() has not been called.
 */
function getMasterKey() {
  if (!_masterKey) {
    throw new Error('[KeyStore] Not initialised. Call initKeyStore(userDataPath) first.');
  }
  return _masterKey;
}

/**
 * Returns the legacy hostname-derived key for decrypting pre-migration data.
 */
function getLegacyKey() {
  if (!_legacyKey) _legacyKey = _deriveLegacyKey();
  return _legacyKey;
}

/**
 * Reset state — used in tests only.
 */
function _reset(masterKey, legacyKey) {
  _masterKey = masterKey || null;
  _legacyKey = legacyKey || null;
}

module.exports = { initKeyStore, getMasterKey, getLegacyKey, _reset };
