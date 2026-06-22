import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock identityIntegrity so tests don't depend on SubtleCrypto timing
vi.mock('../services/offline/identityIntegrity.js', () => ({
    generateIdentityHash: vi.fn().mockResolvedValue('mock-hash-abc123'),
}));

import {
    saveLocalIdentity,
    getLocalIdentity,
    getValidatedLocalIdentity,
    hasLocalIdentity,
    clearLocalIdentity,
    clearGuestSession,
    wasStorageHintShown,
    markStorageHintShown,
    getMeshConsent,
    setMeshConsent,
} from '../services/offline/offlineIdentity.js';

import { generateIdentityHash } from '../services/offline/identityIntegrity.js';

describe('offlineIdentity', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        generateIdentityHash.mockResolvedValue('mock-hash-abc123');
    });

    afterEach(() => {
        localStorage.clear();
    });

    // ── saveLocalIdentity ──────────────────────────────────────────────────
    describe('saveLocalIdentity', () => {
        it('returns a Promise when called with null', async () => {
            const result = saveLocalIdentity(null);
            expect(result).toBeInstanceOf(Promise);
            await result;
        });

        it('stores identity in localStorage with all required fields', async () => {
            await saveLocalIdentity({ id: 'user1', email: 'test@test.com', name: 'Test User' });

            const stored = JSON.parse(localStorage.getItem('cortex-local-identity'));
            expect(stored).toHaveProperty('userId', 'user1');
            expect(stored).toHaveProperty('email', 'test@test.com');
            expect(stored).toHaveProperty('displayName', 'Test User');
            expect(stored).toHaveProperty('token');
            expect(stored).toHaveProperty('deviceId');
            expect(stored).toHaveProperty('integrityHash', 'mock-hash-abc123');
        });

        it('uses email as userId when id is missing', async () => {
            await saveLocalIdentity({ email: 'user@x.com' });
            const stored = JSON.parse(localStorage.getItem('cortex-local-identity'));
            expect(stored.userId).toBe('user@x.com');
        });

        it('uses "local" as userId when no id or email', async () => {
            await saveLocalIdentity({ displayName: 'Anonymous' });
            const stored = JSON.parse(localStorage.getItem('cortex-local-identity'));
            expect(stored.userId).toBe('local');
        });

        it('reuses an existing deviceId', async () => {
            localStorage.setItem('cortex-device-id', 'existing-device-id');
            await saveLocalIdentity({ id: 'u1', email: 'a@b.com' });
            const stored = JSON.parse(localStorage.getItem('cortex-local-identity'));
            expect(stored.deviceId).toBe('existing-device-id');
        });

        it('creates a new deviceId when none exists', async () => {
            await saveLocalIdentity({ id: 'u2', email: 'b@c.com' });
            const stored = JSON.parse(localStorage.getItem('cortex-local-identity'));
            expect(stored.deviceId).toMatch(/^device-/);
        });

        it('does not throw even when generateIdentityHash rejects', async () => {
            generateIdentityHash.mockRejectedValueOnce(new Error('hash failed'));
            await expect(saveLocalIdentity({ id: 'x', email: 'x@y.com' })).resolves.toBeUndefined();
        });
    });

    // ── getLocalIdentity ───────────────────────────────────────────────────
    describe('getLocalIdentity', () => {
        it('returns null when localStorage is empty', () => {
            expect(getLocalIdentity()).toBeNull();
        });

        it('returns the parsed identity object when present', async () => {
            await saveLocalIdentity({ id: 'u3', email: 'c@d.com', name: 'C D' });
            const identity = getLocalIdentity();
            expect(identity).not.toBeNull();
            expect(identity.userId).toBe('u3');
        });

        it('returns null for corrupted JSON', () => {
            localStorage.setItem('cortex-local-identity', 'not-json');
            expect(getLocalIdentity()).toBeNull();
        });
    });

    // ── hasLocalIdentity ───────────────────────────────────────────────────
    describe('hasLocalIdentity', () => {
        it('returns false when no identity stored', () => {
            expect(hasLocalIdentity()).toBe(false);
        });

        it('returns true when identity is stored', async () => {
            await saveLocalIdentity({ id: 'u4', email: 'e@f.com' });
            expect(hasLocalIdentity()).toBe(true);
        });
    });

    // ── clearLocalIdentity ─────────────────────────────────────────────────
    describe('clearLocalIdentity', () => {
        it('removes the identity from localStorage', async () => {
            await saveLocalIdentity({ id: 'u5', email: 'g@h.com' });
            clearLocalIdentity();
            expect(localStorage.getItem('cortex-local-identity')).toBeNull();
        });
    });

    // ── clearGuestSession ─────────────────────────────────────────────────
    describe('clearGuestSession', () => {
        it('removes the guest session key', () => {
            localStorage.setItem('cortex-guest-session', 'abc');
            clearGuestSession();
            expect(localStorage.getItem('cortex-guest-session')).toBeNull();
        });
    });

    // ── getValidatedLocalIdentity ──────────────────────────────────────────
    describe('getValidatedLocalIdentity', () => {
        it('returns null when no identity stored', async () => {
            expect(await getValidatedLocalIdentity()).toBeNull();
        });

        it('returns null and clears when fields are missing', async () => {
            localStorage.setItem('cortex-local-identity', JSON.stringify({ userId: 'x' }));
            const result = await getValidatedLocalIdentity();
            expect(result).toBeNull();
            expect(localStorage.getItem('cortex-local-identity')).toBeNull();
        });

        it('returns null and clears when integrity hash does not match', async () => {
            await saveLocalIdentity({ id: 'u6', email: 'i@j.com', name: 'IJ' });
            generateIdentityHash.mockResolvedValueOnce('different-hash');
            const result = await getValidatedLocalIdentity();
            expect(result).toBeNull();
            expect(localStorage.getItem('cortex-local-identity')).toBeNull();
        });

        it('returns the identity when hash matches', async () => {
            await saveLocalIdentity({ id: 'u7', email: 'k@l.com', name: 'KL' });
            // generateIdentityHash still returns 'mock-hash-abc123' (same as saved)
            const result = await getValidatedLocalIdentity();
            expect(result).not.toBeNull();
            expect(result.userId).toBe('u7');
        });

        it('returns null and clears when generateIdentityHash throws', async () => {
            await saveLocalIdentity({ id: 'u8', email: 'm@n.com', name: 'MN' });
            generateIdentityHash.mockRejectedValueOnce(new Error('SubtleCrypto unavailable'));
            const result = await getValidatedLocalIdentity();
            expect(result).toBeNull();
        });
    });

    // ── Storage Hint Banner ────────────────────────────────────────────────
    describe('wasStorageHintShown / markStorageHintShown', () => {
        it('wasStorageHintShown returns false initially', () => {
            expect(wasStorageHintShown()).toBe(false);
        });

        it('wasStorageHintShown returns true after markStorageHintShown', () => {
            markStorageHintShown();
            expect(wasStorageHintShown()).toBe(true);
        });
    });

    // ── Mesh Consent ───────────────────────────────────────────────────────
    describe('getMeshConsent / setMeshConsent', () => {
        it('getMeshConsent returns false initially', () => {
            expect(getMeshConsent()).toBe(false);
        });

        it('setMeshConsent stores true and dispatches event', () => {
            const eventSpy = vi.fn();
            window.addEventListener('mesh-consent-updated', eventSpy);
            setMeshConsent(true);
            expect(getMeshConsent()).toBe(true);
            expect(eventSpy).toHaveBeenCalled();
            const detail = eventSpy.mock.calls[0][0].detail;
            expect(detail.enabled).toBe(true);
            window.removeEventListener('mesh-consent-updated', eventSpy);
        });

        it('setMeshConsent stores false and dispatches event', () => {
            setMeshConsent(true);
            const eventSpy = vi.fn();
            window.addEventListener('mesh-consent-updated', eventSpy);
            setMeshConsent(false);
            expect(getMeshConsent()).toBe(false);
            expect(eventSpy.mock.calls[0][0].detail.enabled).toBe(false);
            window.removeEventListener('mesh-consent-updated', eventSpy);
        });
    });
});
