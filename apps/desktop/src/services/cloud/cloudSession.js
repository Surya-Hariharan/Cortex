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
    if (!session) throw Object.assign(new Error('No cloud session.'), { notConfigured: true });
    try {
        return await fn(session.accessToken, session);
    } catch (err) {
        if (err.status !== 401) throw err;
        const refreshed = await cloudClient.refresh(session.refreshToken, session.device?.id);
        const nextSession = {
            ...session,
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken ?? session.refreshToken,
            user: refreshed.user ?? session.user,
        };
        saveCloudSession(nextSession);
        return fn(refreshed.accessToken, nextSession);
    }
}

module.exports = { withValidAccessToken };
