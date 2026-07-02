const jwt = require('jsonwebtoken');
const config = require('../config');

// Supabase issues and rotates access/refresh tokens itself (Supabase Auth) —
// this server never signs a token, only verifies the ones Supabase issued.
// Access tokens are HS256-signed with the project's JWT secret, the default
// signing method for Supabase projects (newer projects may opt into
// asymmetric JWKS signing; switching to that only touches this function).
function verifySupabaseAccessToken(token) {
    const payload = jwt.verify(token, config.supabase.jwtSecret);
    if (payload.aud !== 'authenticated') throw new Error('Not a Supabase user access token');
    return payload;
}

module.exports = { verifySupabaseAccessToken };
