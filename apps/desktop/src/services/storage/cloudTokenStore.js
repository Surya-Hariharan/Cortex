/**
 * Cortex — Optional Cloud Session Store
 *
 * Persists the cloud account's access/refresh tokens, AES-encrypted at rest
 * with the same device master key used for local notes/documents (see
 * keyStore.js / encryption.js). Stored in a file separate from the local
 * offline session (cortex-session.json in main.js) so cloud login/logout
 * can never affect the local-first auth path.
 */

const fs = require('fs');
const path = require('path');
const { encryptText, decryptText } = require('./encryption');

const FILENAME = 'cortex-cloud-session.json';

let _filePath = null;

function initCloudTokenStore(userDataPath) {
    _filePath = path.join(userDataPath, FILENAME);
}

function saveCloudSession(session) {
    if (!_filePath) throw new Error('[cloudTokenStore] Not initialised. Call initCloudTokenStore(userDataPath) first.');
    fs.writeFileSync(_filePath, encryptText(JSON.stringify(session)), { mode: 0o600 });
}

function getCloudSession() {
    if (!_filePath || !fs.existsSync(_filePath)) return null;
    try {
        return JSON.parse(decryptText(fs.readFileSync(_filePath, 'utf8')));
    } catch {
        return null;
    }
}

function clearCloudSession() {
    if (_filePath && fs.existsSync(_filePath)) fs.unlinkSync(_filePath);
}

module.exports = { initCloudTokenStore, saveCloudSession, getCloudSession, clearCloudSession };
