/**
 * Offline Identity Management
 *
 * Stores and retrieves a local identity snapshot so users can
 * "Continue Offline" without internet after an initial login.
 *
 * localStorage key: "cortex-local-identity"
 */

import { generateIdentityHash } from './identityIntegrity.js';

const IDENTITY_KEY = 'cortex-local-identity';
const STORAGE_HINT_KEY = 'cortex-storage-hint-shown';
const DEVICE_ID_KEY = 'cortex-device-id';
const GUEST_SESSION_KEY = 'cortex-guest-session';

function getOrCreateDeviceId() {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const generated = `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
}

/**
 * Save local identity after a successful online login.
 * @param {Object} profile — the profile object from auth
 */
export function saveLocalIdentity(profile) {
    if (!profile) return Promise.resolve();

    return (async () => {
        const userId = profile.id || profile.userId || profile.email || 'local';
        const deviceId = getOrCreateDeviceId();
        const token = btoa(JSON.stringify({
            ts: Date.now(),
            email: profile.email,
        }));
        const integrityHash = await generateIdentityHash({ userId }, deviceId);

        const identity = {
            userId,
            email: profile.email || '',
            displayName: profile.name || profile.displayName || '',
            token,
            deviceId,
            integrityHash,
        };

        localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
    })().catch(() => {
        // Keep auth flow non-blocking when localStorage or hashing fails.
    });
}

/**
 * Retrieve the stored local identity (sync).
 * Returns null if none exists.
 */
export function getLocalIdentity() {
    try {
        const raw = localStorage.getItem(IDENTITY_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export async function getValidatedLocalIdentity() {
    const identity = getLocalIdentity();
    if (!identity) return null;

    const requiredKeys = ['userId', 'email', 'displayName', 'token', 'deviceId', 'integrityHash'];
    const hasAllFields = requiredKeys.every((key) => !!identity[key]);
    if (!hasAllFields) {
        clearLocalIdentity();
        return null;
    }

    try {
        const expectedHash = await generateIdentityHash({ userId: identity.userId }, identity.deviceId);
        if (expectedHash !== identity.integrityHash) {
            clearLocalIdentity();
            return null;
        }
        return identity;
    } catch {
        clearLocalIdentity();
        return null;
    }
}

/**
 * Check whether an offline identity is available.
 */
export function hasLocalIdentity() {
    return !!localStorage.getItem(IDENTITY_KEY);
}

/**
 * Clear the offline identity (e.g. on explicit logout).
 */
export function clearLocalIdentity() {
    localStorage.removeItem(IDENTITY_KEY);
}

export function clearGuestSession() {
    localStorage.removeItem(GUEST_SESSION_KEY);
}

// ── Storage Hint Banner ────────────────────────────────────────────────────

/**
 * Whether the one-time storage hint banner has already been shown.
 */
export function wasStorageHintShown() {
    return localStorage.getItem(STORAGE_HINT_KEY) === 'true';
}

/**
 * Mark the storage hint as shown (call on dismiss).
 */
export function markStorageHintShown() {
    localStorage.setItem(STORAGE_HINT_KEY, 'true');
}

// ── Mesh Consent ───────────────────────────────────────────────────────────

const MESH_CONSENT_KEY = 'cortex-mesh-consent';

export function getMeshConsent() {
    return localStorage.getItem(MESH_CONSENT_KEY) === 'true';
}

export function setMeshConsent(enabled) {
    localStorage.setItem(MESH_CONSENT_KEY, String(enabled));
    window.dispatchEvent(
        new CustomEvent('mesh-consent-updated', { detail: { enabled } })
    );
}
