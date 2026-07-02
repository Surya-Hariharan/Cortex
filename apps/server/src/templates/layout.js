// Single shared HTML shell so every transactional email looks consistent —
// this is the "centralized template management" piece: change branding once,
// here, rather than in each individual template.
function renderLayout({ title, bodyHtml, preheader = '' }) {
    return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:32px;">
        <tr><td style="font-size:20px;font-weight:600;color:#111827;padding-bottom:16px;">Cortex</td></tr>
        <tr><td style="color:#374151;font-size:14px;line-height:1.6;">${bodyHtml}</td></tr>
        <tr><td style="padding-top:24px;color:#9ca3af;font-size:12px;">Sent by Cortex. If you didn't expect this email, you can ignore it.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

module.exports = { renderLayout };
