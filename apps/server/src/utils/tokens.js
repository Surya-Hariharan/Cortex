const crypto = require('crypto');

// Opaque random token (refresh tokens, invitation links). Only the sha256
// hash of this value is ever persisted — the raw token is shown to the
// client exactly once.
function generateOpaqueToken() {
    return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { generateOpaqueToken, hashToken };
