// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { createRequire } from 'module';

// keyStore.js / encryption.js / deviceKeys.js / contentKey.js are CJS
// modules sharing Node's native require() cache — see the same pattern in
// database.test.js.
const _cjsRequire = createRequire(import.meta.url);
const keyStore = _cjsRequire('../services/storage/keyStore.js');
const deviceKeys = _cjsRequire('../services/cloud/deviceKeys.js');
const contentKey = _cjsRequire('../services/cloud/contentKey.js');

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-ck-test-'));

describe('contentKey', () => {
    let dir;

    beforeEach(() => {
        dir = tmpDir();
        keyStore._reset(null, null);
        keyStore.initKeyStore(dir);
        deviceKeys._reset();
        deviceKeys.initDeviceKeys(dir);
        contentKey._reset();
        contentKey.initContentKey(dir);
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
        keyStore._reset(null, null);
        deviceKeys._reset();
        contentKey._reset();
    });

    it('has no content key established initially', () => {
        expect(contentKey.hasContentKey()).toBe(false);
        expect(() => contentKey.getContentKey()).toThrow('No content key established');
    });

    it('generateAndWrap mints a 32-byte key, persists it, and returns a wrapped copy for this device', () => {
        const wrapped = contentKey.generateAndWrap();
        expect(typeof wrapped).toBe('string');
        expect(contentKey.hasContentKey()).toBe(true);
        expect(contentKey.getContentKey().length).toBe(32);
        expect(fs.existsSync(path.join(dir, 'cortex-cloud-content-key.json'))).toBe(true);

        // The wrapped copy must unwrap back to exactly the persisted key.
        const unwrapped = deviceKeys.unwrapKeyForDevice(wrapped);
        expect(unwrapped.equals(contentKey.getContentKey())).toBe(true);
    });

    it('adoptWrapped unwraps and persists a key that was wrapped by another device (server-mediated handshake)', () => {
        const realKey = crypto.randomBytes(32);
        const wrappedForThisDevice = deviceKeys.wrapKeyForDevice(realKey);

        contentKey.adoptWrapped(wrappedForThisDevice);

        expect(contentKey.hasContentKey()).toBe(true);
        expect(contentKey.getContentKey().equals(realKey)).toBe(true);
    });

    it('persists across a simulated restart', () => {
        contentKey.generateAndWrap();
        const key1 = contentKey.getContentKey();

        contentKey._reset();
        contentKey.initContentKey(dir);
        const key2 = contentKey.getContentKey();

        expect(key2.equals(key1)).toBe(true);
    });

    it('wrapForDevice wraps the established content key to an arbitrary public key', () => {
        contentKey.generateAndWrap();
        const otherKeyPair = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });

        const wrapped = contentKey.wrapForDevice(otherKeyPair.publicKey);
        const unwrapped = crypto.privateDecrypt(
            { key: otherKeyPair.privateKey, oaepHash: 'sha256' },
            Buffer.from(wrapped, 'base64')
        );
        expect(unwrapped.equals(contentKey.getContentKey())).toBe(true);
    });

    it('encryptResource/decryptResource round-trips arbitrary JSON', () => {
        contentKey.generateAndWrap();
        const value = { title: 'Hello', content: 'World', nested: { a: 1, b: [1, 2, 3] } };

        const { ciphertext, nonce } = contentKey.encryptResource(value);
        expect(typeof ciphertext).toBe('string');
        expect(typeof nonce).toBe('string');
        expect(ciphertext).not.toContain('Hello');

        const decrypted = contentKey.decryptResource({ ciphertext, nonce });
        expect(decrypted).toEqual(value);
    });

    it('decryptResource fails closed with the wrong content key (authenticity is enforced)', () => {
        contentKey.generateAndWrap();
        const { ciphertext, nonce } = contentKey.encryptResource({ a: 1 });

        contentKey._reset();
        contentKey.generateAndWrap(); // a different random key is now active

        expect(() => contentKey.decryptResource({ ciphertext, nonce })).toThrow();
    });

    it('clearContentKey wipes the on-disk key', () => {
        contentKey.generateAndWrap();
        contentKey.clearContentKey();
        expect(fs.existsSync(path.join(dir, 'cortex-cloud-content-key.json'))).toBe(false);
        expect(contentKey.hasContentKey()).toBe(false);
    });
});
