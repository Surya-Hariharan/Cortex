const config = require('../config');
const logger = require('../utils/logger');

// Same provider-interface pattern as email.service.js. "noop" is the
// default so the server runs with zero external push dependencies.
const providers = {
    noop: {
        async send(token, notification) {
            logger.info(`[push:noop] token=${token.slice(0, 8)}… ${JSON.stringify(notification)}`);
        },
    },
};

function getProvider() {
    return providers[config.pushProvider] || providers.noop;
}

async function sendPush(token, notification) {
    await getProvider().send(token, notification);
}

module.exports = { sendPush };
