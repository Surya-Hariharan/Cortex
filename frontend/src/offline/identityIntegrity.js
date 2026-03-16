const INTEGRITY_SALT = 'CORTEX_STATIC_SALT';

function toHex(buffer) {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value) {
    if (window.crypto?.subtle) {
        const encoder = new TextEncoder();
        const digest = await window.crypto.subtle.digest('SHA-256', encoder.encode(value));
        return toHex(digest);
    }

    const cryptoModule = await import('crypto');
    return cryptoModule.createHash('sha256').update(value).digest('hex');
}

export async function generateIdentityHash(profile, deviceId) {
    const userId = profile?.userId || profile?.id || profile?.email || 'local';
    const normalizedDeviceId = String(deviceId || 'unknown-device');
    return sha256Hex(`${userId}${normalizedDeviceId}${INTEGRITY_SALT}`);
}
