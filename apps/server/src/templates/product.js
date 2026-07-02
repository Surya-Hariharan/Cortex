const { renderLayout } = require('./layout');

function releaseAnnouncement({ version, highlights = [] }) {
    const subject = `Cortex ${version} is here`;
    const text = `Cortex ${version} is out.\n${highlights.join('\n')}`;
    const html = renderLayout({
        title: subject,
        bodyHtml: `<p>Cortex ${version} is out.</p><ul>${highlights.map((h) => `<li>${h}</li>`).join('')}</ul>`,
    });
    return { subject, html, text };
}

function securityNotice({ summary }) {
    const subject = 'Cortex security notice';
    const html = renderLayout({ title: subject, bodyHtml: `<p>${summary}</p>` });
    return { subject, html, text: summary };
}

function newsletterOptInConfirmation() {
    const subject = "You're subscribed to Cortex updates";
    const text = "You're now subscribed to occasional Cortex product updates. You can opt out anytime from Cloud Account settings.";
    const html = renderLayout({
        title: subject,
        bodyHtml: `<p>You're now subscribed to occasional Cortex product updates.</p>
            <p>You can opt out anytime from Cloud Account settings.</p>`,
    });
    return { subject, html, text };
}

module.exports = { releaseAnnouncement, securityNotice, newsletterOptInConfirmation };
