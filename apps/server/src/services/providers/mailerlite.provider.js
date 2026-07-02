const config = require('../../config');
const logger = require('../../utils/logger');

const MAILERLITE_TRANSACTIONAL_URL = 'https://connect.mailerlite.com/api/emails';
const MAX_ATTEMPTS = 3;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Best-effort: after MAX_ATTEMPTS failures this logs and returns rather than
// throwing, so a MailerLite outage never fails the caller's primary action
// (e.g. account registration must succeed even if the welcome email can't
// be delivered right now).
async function send({ to, subject, html, text }) {
    if (!config.mailerlite.apiKey) {
        logger.warn(`[email:mailerlite] MAILERLITE_API_KEY not set — dropping email to=${to} subject="${subject}".`);
        return;
    }

    const body = {
        from: { email: config.mailerlite.fromEmail, name: config.mailerlite.fromName },
        to: [{ email: to }],
        subject,
        html,
        text,
    };

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const res = await fetch(MAILERLITE_TRANSACTIONAL_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Authorization: `Bearer ${config.mailerlite.apiKey}`,
                },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                logger.info(`[email:mailerlite] sent to=${to} subject="${subject}"`);
                return;
            }
            const detail = await res.text().catch(() => '');
            throw new Error(`MailerLite responded ${res.status}: ${detail}`);
        } catch (err) {
            logger.warn(`[email:mailerlite] attempt ${attempt}/${MAX_ATTEMPTS} failed for to=${to}: ${err.message}`);
            if (attempt === MAX_ATTEMPTS) {
                logger.error(`[email:mailerlite] giving up on to=${to} subject="${subject}" after ${MAX_ATTEMPTS} attempts.`);
                return;
            }
            await sleep(2 ** attempt * 250);
        }
    }
}

module.exports = { send };
