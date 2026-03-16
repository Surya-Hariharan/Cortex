/**
 * Offline Identity Management
 *
 * Stores and retrieves a local identity snapshot so users can
 * "Continue Offline" without internet after an initial login.
 *
 * localStorage key: "cortex-local-identity"
 */

const IDENTITY_KEY = 'cortex-local-identity';
const STORAGE_HINT_KEY = 'cortex-storage-hint-shown';

/**
 * Save local identity after a successful online login.
 * @param {Object} profile — the profile object from auth
 */
export function saveLocalIdentity(profile) {
    if (!profile) return;
    try {
        const identity = {
            userId: profile.id || profile.userId || profile.email || 'local',
            email: profile.email || '',
            displayName: profile.name || profile.displayName || '',
            encryptedSessionToken: btoa(JSON.stringify({
                ts: Date.now(),
                email: profile.email,
            })),
            lastLoginAt: new Date().toISOString(),
        };
        localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
    } catch (err) {
        console.warn('[Cortex] Failed to save local identity:', err);
    }
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
