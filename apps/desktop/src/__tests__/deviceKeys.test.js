// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { createRequire } from 'module';

// keyStore.js / encryption.js / deviceKeys.js are CJS modules sharing
// Node's native require() cache — see the same pattern in database.test.js.
const _cjsRequire = createRequire(import.meta.url);
const keyStore = _cjsRequire('../services/storage/keyStore.js');
const deviceKeys = _cjsRequire('../services/cloud/deviceKeys.js');

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-dk-test-'));

describe('deviceKeys', () => {
    let dir;

    beforeEach(() => {
        dir = tmpDir();
        keyStore._reset(null, null);
        keyStore.initKeyStore(dir); // deviceKeys' persisted private key is encrypted with this
        deviceKeys._reset();
        deviceKeys.initDeviceKeys(dir);
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
        keyStore._reset(null, null);
        deviceKeys._reset();
    });

    it('generates an RSA keypair on first use and persists it to disk', () => {
        const { publicKey, privateKey } = deviceKeys.ensureDeviceKeyPair();
        expect(publicKey).toContain('BEGIN PUBLIC KEY');
        expect(privateKey).toContain('BEGIN PRIVATE KEY');
        expect(fs.existsSync(path.join(dir, 'cortex-cloud-device-key.json'))).toBe(true);
    });

    it('persists the private key encrypted at rest, not in plaintext', () => {
        deviceKeys.ensureDeviceKeyPair();
        const raw = fs.readFileSync(path.join(dir, 'cortex-cloud-device-key.json'), 'utf8');
        expect(raw).not.toContain('BEGIN PRIVATE KEY');
    });

    it('reloads the same keypair from disk after in-memory state is cleared (simulated restart)', () => {
        const first = deviceKeys.getPublicKey();

        deviceKeys._reset(); // simulate a fresh process — file on disk is untouched
        deviceKeys.initDeviceKeys(dir);
        const second = deviceKeys.getPublicKey();

        expect(second).toBe(first);
    });

    it('wraps and unwraps a symmetric key round-trip', () => {
        const rawKey = crypto.randomBytes(32);
        const wrapped = deviceKeys.wrapKeyForDevice(rawKey);
        expect(typeof wrapped).toBe('string');
        expect(wrapped).not.toBe(rawKey.toString('base64'));

        const unwrapped = deviceKeys.unwrapKeyForDevice(wrapped);
        expect(Buffer.isBuffer(unwrapped)).toBe(true);
        expect(unwrapped.equals(rawKey)).toBe(true);
    });

    it('wraps to an arbitrary public key, not just this device\'s own', () => {
        const otherKeyPair = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });
        const rawKey = crypto.randomBytes(32);
        const wrapped = deviceKeys.wrapKeyForDevice(rawKey, otherKeyPair.publicKey);

        // This device's own private key must NOT be able to unwrap it.
        expect(() => deviceKeys.unwrapKeyForDevice(wrapped)).toThrow();

        // The other keypair's private key can.
        const unwrapped = crypto.privateDecrypt(
            { key: otherKeyPair.privateKey, oaepHash: 'sha256' },
            Buffer.from(wrapped, 'base64')
        );
        expect(unwrapped.equals(rawKey)).toBe(true);
    });

    it('clearDeviceKeys wipes the on-disk keypair', () => {
        deviceKeys.ensureDeviceKeyPair();
        deviceKeys.clearDeviceKeys();
        expect(fs.existsSync(path.join(dir, 'cortex-cloud-device-key.json'))).toBe(false);
        expect(() => deviceKeys.getPublicKey()).not.toThrow(); // regenerates on next use
    });
});
