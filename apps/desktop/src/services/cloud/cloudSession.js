/**
 * Cortex — Cloud Session Helper
 *
 * Wraps a cloudClient call with the current cloud session's access token,
 * transparently refreshing once on a 401 (access tokens are short-lived —
 * Supabase defaults to ~1h — and both background sync ticks and idle user
 * actions can straddle an expiry). Shared by syncEngine.js and main.js's
 * cloud IPC handlers so token-refresh logic lives in exactly one place.
 */

const cloudClient = require('./cloudClient');
const { getCloudSession, saveCloudSession } = require('../storage/cloudTokenStore');

async function withValidAccessToken(fn) {
    const session = getCloudSession();
    if (!session || !session.accessToken) throw Object.assign(new Error('No cloud session.'), { notConfigured: true });
    try {
        return await fn(session.accessToken, session);
    } catch (err) {
        // Clerk handles token refreshes from the renderer process.
        // If we get a 401, it means the main process hasn't received the updated token yet.
        // We throw the error and let the background task retry later.
        throw err;
    }
}

module.exports = { withValidAccessToken };
