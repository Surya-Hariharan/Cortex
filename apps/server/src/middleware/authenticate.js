const { requireAuth } = require('@clerk/express');
const { createClerkClient } = require('@clerk/clerk-sdk-node');
const config = require('../config');

const clerkClient = createClerkClient({
    publishableKey: config.clerk.publishableKey,
    secretKey: config.clerk.secretKey,
});

const clerkAuth = requireAuth({
    publishableKey: config.clerk.publishableKey,
    secretKey: config.clerk.secretKey,
});

async function authenticate(req, res, next) {
    clerkAuth(req, res, async (err) => {
        if (err) {
            return res.status(401).json({ error: 'unauthorized', detail: 'Invalid or expired access token.' });
        }
        try {
            // Fetch the user details to match the previous shape { id, email }
            const user = await clerkClient.users.getUser(req.auth.userId);
            req.user = { 
                id: req.auth.userId, 
                email: user.emailAddresses[0]?.emailAddress 
            };
            req.accessToken = req.auth.getToken();
            next();
        } catch (fetchErr) {
            return res.status(500).json({ error: 'internal_error', detail: 'Failed to fetch user details from Clerk.' });
        }
    });
}

module.exports = { authenticate };
