const INTEGRITY_SALT = 'CORTEX_STATIC_SALT';

function toHex(buffer) {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function fallbackHashHex(value) {
    // Deterministic non-crypto fallback for environments without SubtleCrypto.
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

async function sha256Hex(value) {
    if (window.crypto?.subtle) {
        const encoder = new TextEncoder();
        const digest = await window.crypto.subtle.digest('SHA-256', encoder.encode(value));
        return toHex(digest);
    }

    return fallbackHashHex(value);
}

export async function generateIdentityHash(profile, deviceId) {
    const userId = profile?.userId || profile?.id || profile?.email || 'local';
    const normalizedDeviceId = String(deviceId || 'unknown-device');
    return sha256Hex(`${userId}${normalizedDeviceId}${INTEGRITY_SALT}`);
}
