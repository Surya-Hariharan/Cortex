const { verifySupabaseAccessToken } = require('../utils/supabaseToken');

function authenticate(req, res, next) {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'unauthorized', detail: 'Missing bearer token.' });
    }
    try {
        const payload = verifySupabaseAccessToken(token);
        req.user = { id: payload.sub, email: payload.email };
        req.accessToken = token;
        next();
    } catch (_err) {
        return res.status(401).json({ error: 'unauthorized', detail: 'Invalid or expired access token.' });
    }
}

module.exports = { authenticate };
