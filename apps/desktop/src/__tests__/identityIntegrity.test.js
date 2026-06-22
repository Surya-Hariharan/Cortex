import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateIdentityHash } from '../services/offline/identityIntegrity.js';

describe('identityIntegrity', () => {
    describe('generateIdentityHash — SubtleCrypto available (jsdom provides it)', () => {
        it('returns a non-empty hex string', async () => {
            const hash = await generateIdentityHash({ userId: 'user1' }, 'device1');
            expect(typeof hash).toBe('string');
            expect(hash.length).toBeGreaterThan(0);
            // SHA-256 hex = 64 chars; FNV fallback = 8 chars
        });

        it('is deterministic for the same inputs', async () => {
            const h1 = await generateIdentityHash({ userId: 'alice' }, 'dev-A');
            const h2 = await generateIdentityHash({ userId: 'alice' }, 'dev-A');
            expect(h1).toBe(h2);
        });

        it('produces different hashes for different userIds', async () => {
            const h1 = await generateIdentityHash({ userId: 'alice' }, 'dev-A');
            const h2 = await generateIdentityHash({ userId: 'bob' }, 'dev-A');
            expect(h1).not.toBe(h2);
        });

        it('produces different hashes for different deviceIds', async () => {
            const h1 = await generateIdentityHash({ userId: 'alice' }, 'dev-A');
            const h2 = await generateIdentityHash({ userId: 'alice' }, 'dev-B');
            expect(h1).not.toBe(h2);
        });

        it('handles null profile with fallback userId "local"', async () => {
            const hash = await generateIdentityHash(null, 'device1');
            expect(typeof hash).toBe('string');
            expect(hash.length).toBeGreaterThan(0);
        });

        it('uses profile.email as fallback userId', async () => {
            const h1 = await generateIdentityHash({ email: 'a@b.com' }, 'dev');
            const h2 = await generateIdentityHash({ userId: 'a@b.com' }, 'dev');
            expect(h1).toBe(h2);
        });

        it('uses "unknown-device" when deviceId is null', async () => {
            const hash = await generateIdentityHash({ userId: 'u' }, null);
            expect(typeof hash).toBe('string');
        });
    });

    describe('generateIdentityHash — fallback (no SubtleCrypto)', () => {
        let originalCrypto;

        beforeEach(() => {
            originalCrypto = window.crypto;
            Object.defineProperty(window, 'crypto', {
                value: {},
                writable: true,
                configurable: true,
            });
        });

        afterEach(() => {
            Object.defineProperty(window, 'crypto', {
                value: originalCrypto,
                writable: true,
                configurable: true,
            });
        });

        it('still returns a string via FNV fallback', async () => {
            const hash = await generateIdentityHash({ userId: 'u' }, 'd');
            expect(typeof hash).toBe('string');
            expect(hash.length).toBe(8); // FNV padded to 8 hex chars
        });

        it('is deterministic in fallback mode', async () => {
            const h1 = await generateIdentityHash({ userId: 'x' }, 'y');
            const h2 = await generateIdentityHash({ userId: 'x' }, 'y');
            expect(h1).toBe(h2);
        });
    });
});
