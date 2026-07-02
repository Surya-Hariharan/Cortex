const config = require('../config');
const logger = require('../utils/logger');
const mailerliteProvider = require('./providers/mailerlite.provider');
const accountTemplates = require('../templates/account');
const collaborationTemplates = require('../templates/collaboration');
const productTemplates = require('../templates/product');

// Provider interface: send({to, subject, html, text}) -> Promise<void>.
// Every provider is expected to be best-effort — log and return on failure,
// never throw — so a flaky email provider never fails the action that
// triggered the email (registration, invites, etc). mailerlite.provider.js
// already follows this; the console provider trivially can't fail.
const providers = {
    console: {
        async send({ to, subject, text }) {
            logger.info(`[email:console] to=${to} subject="${subject}"\n${text}`);
        },
    },
    mailerlite: mailerliteProvider,
};

function getProvider() {
    const provider = providers[config.emailProvider];
    if (!provider) {
        logger.warn(`[email] Unknown EMAIL_PROVIDER "${config.emailProvider}", falling back to console.`);
        return providers.console;
    }
    return provider;
}

async function send(to, { subject, html, text }) {
    await getProvider().send({ to, subject, html, text });
}

// ── Account ──────────────────────────────────────────────────────────────

async function sendVerificationEmail(to, otp) {
    await send(to, accountTemplates.verifyEmail({ otp }));
}

async function sendWelcomeEmail(to, { fullName } = {}) {
    await send(to, accountTemplates.welcome({ fullName }));
}

async function sendPasswordResetEmail(to, otp) {
    await send(to, accountTemplates.passwordReset({ otp }));
}

async function sendLoginNotificationEmail(to, { deviceName }) {
    await send(to, accountTemplates.loginNotification({ deviceName }));
}

async function sendNewDeviceAlertEmail(to, { deviceName }) {
    await send(to, accountTemplates.newDeviceAlert({ deviceName }));
}

async function sendAccountDeletionConfirmationEmail(to) {
    await send(to, accountTemplates.accountDeletionConfirmation());
}

// ── Collaboration ────────────────────────────────────────────────────────

async function sendWorkspaceInvitationEmail(to, workspaceName, inviteLink, inviterName) {
    await send(to, collaborationTemplates.workspaceInvitation({ workspaceName, inviteLink, inviterName }));
}

async function sendProjectInvitationEmail(to, projectName, inviteLink, inviterName) {
    await send(to, collaborationTemplates.projectInvitation({ projectName, inviteLink, inviterName }));
}

async function sendShareNotificationEmail(to, resourceName, sharedByName) {
    await send(to, collaborationTemplates.shareNotification({ resourceName, sharedByName }));
}

async function sendTeamUpdateEmail(to, workspaceName, summary) {
    await send(to, collaborationTemplates.teamUpdate({ workspaceName, summary }));
}

// ── Product (marketing/announcement — callers are responsible for only
// passing recipients who opted in, via user_profiles.preferences) ─────────

async function sendReleaseAnnouncementEmail(to, version, highlights) {
    await send(to, productTemplates.releaseAnnouncement({ version, highlights }));
}

async function sendSecurityNoticeEmail(to, summary) {
    await send(to, productTemplates.securityNotice({ summary }));
}

async function sendNewsletterOptInConfirmationEmail(to) {
    await send(to, productTemplates.newsletterOptInConfirmation());
}

module.exports = {
    sendVerificationEmail,
    sendWelcomeEmail,
    sendPasswordResetEmail,
    sendLoginNotificationEmail,
    sendNewDeviceAlertEmail,
    sendAccountDeletionConfirmationEmail,
    sendWorkspaceInvitationEmail,
    sendProjectInvitationEmail,
    sendShareNotificationEmail,
    sendTeamUpdateEmail,
    sendReleaseAnnouncementEmail,
    sendSecurityNoticeEmail,
    sendNewsletterOptInConfirmationEmail,
};
