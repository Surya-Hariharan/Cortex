// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { initKeyStore, getMasterKey, getLegacyKey, _reset } from '../services/storage/keyStore.js';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-ks-test-'));

describe('keyStore', () => {
    let dir;

    beforeEach(() => {
        dir = tmpDir();
        _reset(null, null);
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
        _reset(null, null);
    });

    describe('initKeyStore', () => {
        it('generates a new 32-byte key on first run', () => {
            initKeyStore(dir);
            const key = getMasterKey();
            expect(Buffer.isBuffer(key)).toBe(true);
            expect(key.length).toBe(32);
        });

        it('persists the key to a JSON file', () => {
            initKeyStore(dir);
            const keyFile = path.join(dir, 'cortex-device-key.json');
            expect(fs.existsSync(keyFile)).toBe(true);
            const parsed = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
            expect(parsed).toHaveProperty('key');
            expect(parsed).toHaveProperty('v', 1);
            expect(parsed.key).toHaveLength(64); // 32 bytes = 64 hex chars
        });

        it('loads existing key from file on subsequent calls', () => {
            initKeyStore(dir);
            const firstKey = getMasterKey().toString('hex');

            _reset(null, null);
            initKeyStore(dir);
            const secondKey = getMasterKey().toString('hex');

            expect(firstKey).toBe(secondKey);
        });

        it('generates new key when key file is corrupted', () => {
            const keyFile = path.join(dir, 'cortex-device-key.json');
            fs.writeFileSync(keyFile, 'not-valid-json');
            initKeyStore(dir);
            const key = getMasterKey();
            expect(key.length).toBe(32);
        });

        it('generates new key when key has wrong length', () => {
            const keyFile = path.join(dir, 'cortex-device-key.json');
            fs.writeFileSync(keyFile, JSON.stringify({ key: 'aabbcc', v: 1 }));
            initKeyStore(dir);
            const key = getMasterKey();
            expect(key.length).toBe(32);
        });

        it('initialises the legacy key', () => {
            initKeyStore(dir);
            const legacy = getLegacyKey();
            expect(Buffer.isBuffer(legacy)).toBe(true);
            expect(legacy.length).toBe(32);
        });
    });

    describe('getMasterKey', () => {
        it('throws when called before initKeyStore', () => {
            expect(() => getMasterKey()).toThrow('[KeyStore] Not initialised');
        });

        it('returns the master key after init', () => {
            initKeyStore(dir);
            expect(() => getMasterKey()).not.toThrow();
        });
    });

    describe('getLegacyKey', () => {
        it('derives a 32-byte legacy key without init', () => {
            const key = getLegacyKey();
            expect(Buffer.isBuffer(key)).toBe(true);
            expect(key.length).toBe(32);
        });

        it('is deterministic for the same machine', () => {
            const k1 = getLegacyKey().toString('hex');
            _reset(null, null);
            const k2 = getLegacyKey().toString('hex');
            expect(k1).toBe(k2);
        });
    });

    describe('_reset', () => {
        it('clears master key so getMasterKey throws again', () => {
            initKeyStore(dir);
            _reset(null, null);
            expect(() => getMasterKey()).toThrow();
        });

        it('allows injecting a custom master key', () => {
            const fakeKey = Buffer.alloc(32, 0xab);
            _reset(fakeKey, null);
            expect(getMasterKey().toString('hex')).toBe(fakeKey.toString('hex'));
        });
    });
});
