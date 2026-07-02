const { renderLayout } = require('./layout');

function workspaceInvitation({ workspaceName, inviteLink, inviterName }) {
    const from = inviterName || 'Someone';
    const subject = `You've been invited to "${workspaceName}" on Cortex`;
    const text = `${from} invited you to the "${workspaceName}" notebook on Cortex. Open the invite: ${inviteLink}`;
    const html = renderLayout({
        title: subject,
        bodyHtml: `<p>${from} invited you to collaborate on <strong>${workspaceName}</strong>.</p>
            <p><a href="${inviteLink}" style="color:#2563eb;">Open the invitation</a></p>`,
    });
    return { subject, html, text };
}

function projectInvitation({ projectName, inviteLink, inviterName }) {
    const from = inviterName || 'Someone';
    const subject = `You've been invited to "${projectName}" on Cortex`;
    const text = `${from} invited you to the "${projectName}" project on Cortex. Open the invite: ${inviteLink}`;
    const html = renderLayout({
        title: subject,
        bodyHtml: `<p>${from} invited you to collaborate on the project <strong>${projectName}</strong>.</p>
            <p><a href="${inviteLink}" style="color:#2563eb;">Open the invitation</a></p>`,
    });
    return { subject, html, text };
}

function shareNotification({ resourceName, sharedByName }) {
    const from = sharedByName || 'Someone';
    const subject = `${from} shared "${resourceName}" with you`;
    const text = `${from} shared "${resourceName}" with you on Cortex.`;
    const html = renderLayout({
        title: subject,
        bodyHtml: `<p>${from} shared <strong>${resourceName}</strong> with you on Cortex.</p>`,
    });
    return { subject, html, text };
}

function teamUpdate({ workspaceName, summary }) {
    const subject = `Update in "${workspaceName}"`;
    const html = renderLayout({ title: subject, bodyHtml: `<p><strong>${workspaceName}</strong>: ${summary}</p>` });
    return { subject, html, text: summary };
}

module.exports = { workspaceInvitation, projectInvitation, shareNotification, teamUpdate };
