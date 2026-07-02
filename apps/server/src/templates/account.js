const { renderLayout } = require('./layout');

function verifyEmail({ otp }) {
    const subject = 'Verify your Cortex account';
    const text = `Your verification code is: ${otp}\nThis code expires shortly.`;
    const html = renderLayout({
        title: subject,
        preheader: 'Verify your email to finish setting up Cortex.',
        bodyHtml: `<p>Welcome to Cortex! Use the code below to verify your email address:</p>
            <p style="font-size:28px;font-weight:700;letter-spacing:4px;color:#111827;">${otp}</p>
            <p>This code expires shortly. If you didn't create a Cortex account, you can ignore this email.</p>`,
    });
    return { subject, html, text };
}

function welcome({ fullName }) {
    const name = fullName || 'there';
    const subject = 'Welcome to Cortex';
    const text = `Hi ${name}, welcome to Cortex! Your cloud account is ready.`;
    const html = renderLayout({
        title: subject,
        bodyHtml: `<p>Hi ${name},</p>
            <p>Your Cortex cloud account is ready. Cortex still works fully offline — cloud sync, backup, and
            collaboration are optional extras you've now enabled on top of your local-first workspace.</p>`,
    });
    return { subject, html, text };
}

function passwordReset({ otp }) {
    const subject = 'Reset your Cortex password';
    const text = `Your password reset code is: ${otp}\nThis code expires shortly. If you didn't request this, ignore this email.`;
    const html = renderLayout({
        title: subject,
        bodyHtml: `<p>Use the code below to reset your Cortex password:</p>
            <p style="font-size:28px;font-weight:700;letter-spacing:4px;color:#111827;">${otp}</p>
            <p>If you didn't request this, you can safely ignore this email — your password won't change.</p>`,
    });
    return { subject, html, text };
}

function loginNotification({ deviceName }) {
    const subject = 'New sign-in to your Cortex account';
    const text = `Your Cortex account was just signed in to from "${deviceName}". If this wasn't you, revoke the device from Cloud Account settings and reset your password.`;
    const html = renderLayout({
        title: subject,
        bodyHtml: `<p>Your Cortex account was just signed in to from <strong>${deviceName}</strong>.</p>
            <p>If this wasn't you, revoke that device from Cloud Account settings and reset your password immediately.</p>`,
    });
    return { subject, html, text };
}

function newDeviceAlert({ deviceName }) {
    const subject = 'New device linked to your Cortex account';
    const text = `A new device, "${deviceName}", was just linked to your Cortex account for cloud sync.`;
    const html = renderLayout({
        title: subject,
        bodyHtml: `<p>A new device, <strong>${deviceName}</strong>, was just linked to your Cortex account for cloud sync.</p>
            <p>If this wasn't you, revoke it from Cloud Account settings.</p>`,
    });
    return { subject, html, text };
}

function accountDeletionConfirmation() {
    const subject = 'Your Cortex account has been deleted';
    const text = 'Your Cortex cloud account and all associated cloud data have been permanently deleted. Local data on your devices is unaffected.';
    const html = renderLayout({
        title: subject,
        bodyHtml: `<p>Your Cortex cloud account and all associated cloud data (profile, sync history, backups,
            collaboration memberships) have been permanently deleted.</p>
            <p>Local data on your devices is unaffected — Cortex keeps working fully offline.</p>`,
    });
    return { subject, html, text };
}

module.exports = {
    verifyEmail,
    welcome,
    passwordReset,
    loginNotification,
    newDeviceAlert,
    accountDeletionConfirmation,
};
