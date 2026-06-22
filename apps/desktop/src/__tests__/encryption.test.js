// @vitest-environment node
// Tests encryption.js internal helpers directly with known keys so the test
// does not depend on keyStore module state (avoids CJS interop isolation issues).
// The public API (encryptText/decryptText) is exercised via keyStore integration
// in keyStore.test.js which runs initKeyStore and then uses _reset to validate.

import { describe, it, expect } from 'vitest';
import nodeCrypto from 'crypto';

import {
    _encrypt,
    _decrypt,
    _encryptBuffer,
    _decryptBuffer,
    encryptText,
    decryptText,
    encryptEmbedding,
    decryptEmbedding,
} from '../services/storage/encryption.js';

const KEY_A = nodeCrypto.randomBytes(32);
const KEY_B = nodeCrypto.randomBytes(32);
const WRONG = nodeCrypto.randomBytes(32);

// ── _encrypt / _decrypt ──────────────────────────────────────────────────────

describe('_encrypt / _decrypt', () => {
    it('round-trips a plaintext string', () => {
        const cipher = _encrypt('hello', KEY_A);
        expect(_decrypt(cipher, KEY_A)).toBe('hello');
    });

    it('produces base64 output longer than plaintext', () => {
        const cipher = _encrypt('test', KEY_A);
        expect(cipher.length).toBeGreaterThan(4);
        expect(Buffer.from(cipher, 'base64').length).toBeGreaterThan(0);
    });

    it('produces different ciphertext each call (random IV)', () => {
        const c1 = _encrypt('same', KEY_A);
        const c2 = _encrypt('same', KEY_A);
        expect(c1).not.toBe(c2);
    });

    it('throws when decrypting with the wrong key', () => {
        const cipher = _encrypt('secret', KEY_A);
        expect(() => _decrypt(cipher, WRONG)).toThrow();
    });

    it('throws on truncated ciphertext', () => {
        expect(() => _decrypt('aGVsbG8=', KEY_A)).toThrow();
    });
});

// ── _encryptBuffer / _decryptBuffer ──────────────────────────────────────────

describe('_encryptBuffer / _decryptBuffer', () => {
    it('round-trips a binary buffer', () => {
        const raw = nodeCrypto.randomBytes(64);
        const enc = _encryptBuffer(raw, KEY_A);
        const dec = _decryptBuffer(enc, KEY_A);
        expect(dec).toEqual(raw);
    });

    it('output buffer is longer than input (IV + auth tag overhead)', () => {
        const raw = Buffer.from([1, 2, 3, 4]);
        const enc = _encryptBuffer(raw, KEY_A);
        expect(enc.length).toBeGreaterThan(raw.length);
    });

    it('throws on wrong key', () => {
        const enc = _encryptBuffer(Buffer.from('data'), KEY_A);
        expect(() => _decryptBuffer(enc, WRONG)).toThrow();
    });
});

// ── encryptText / decryptText (public API — null/empty guards only) ──────────
// getMasterKey() paths require a live keyStore; those cases are exercised
// indirectly via keyStore.test.js → initKeyStore flow.

describe('encryptText public API — edge cases', () => {
    it('returns null for null input (no-op guard)', () => {
        expect(encryptText(null)).toBeNull();
    });

    it('returns undefined for undefined input', () => {
        expect(encryptText(undefined)).toBeUndefined();
    });

    it('returns empty string for empty string', () => {
        expect(encryptText('')).toBe('');
    });
});

describe('decryptText public API — edge cases', () => {
    it('returns null for null input', () => {
        expect(decryptText(null)).toBeNull();
    });

    it('returns empty string for empty string', () => {
        expect(decryptText('')).toBe('');
    });

    it('falls through to plaintext passthrough when both keys fail', () => {
        // When getMasterKey / getLegacyKey both produce corrupt decryption,
        // the function returns the raw value unchanged.
        // We simulate this by passing a string that looks like plain text.
        // (getMasterKey throws "not initialised" → catch → getLegacyKey is also
        //  unavailable → catch → return raw value)
        expect(decryptText('not-base64-cipher-data')).toBe('not-base64-cipher-data');
    });
});

// ── encryptEmbedding / decryptEmbedding (edge cases) ─────────────────────────

describe('encryptEmbedding / decryptEmbedding — internal helpers', () => {
    it('round-trips Float32Array via _encryptBuffer/_decryptBuffer', () => {
        const vector = [0.5, 1.5, -0.5, 3.14];
        const raw = Buffer.from(new Float32Array(vector).buffer);
        const enc = _encryptBuffer(raw, KEY_A);
        const dec = _decryptBuffer(enc, KEY_A);
        const result = Array.from(new Float32Array(dec.buffer, dec.byteOffset, dec.byteLength / 4));
        vector.forEach((v, i) => expect(result[i]).toBeCloseTo(v, 5));
    });

    it('decryptEmbedding returns raw Float32 interpretation when all keys fail', () => {
        // With no keyStore initialised, decryptEmbedding falls through to the
        // raw passthrough path which re-interprets the buffer bytes directly.
        const rawVector = new Float32Array([1.0, 2.0]);
        const rawBuffer = Buffer.from(rawVector.buffer);
        const result = decryptEmbedding(rawBuffer);
        expect(Array.isArray(result)).toBe(true);
    });
});
