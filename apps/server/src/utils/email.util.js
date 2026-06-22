const nodemailer = require('nodemailer');

let cachedTransporter = null;

function getSmtpTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration is missing. Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD');
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return cachedTransporter;
}

async function sendPasswordResetTemporaryPasswordEmail({ to, temporaryPassword }) {
  const transporter = getSmtpTransporter();
  const fromName = process.env.SMTP_FROM_NAME || 'Cortex';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  await transporter.sendMail({
    from: `${fromName} <${fromEmail}>`,
    to,
    subject: 'Password Reset',
    text: [
      'Your password was reset.',
      '',
      `Temporary password: ${temporaryPassword}`,
      '',
      'Please log in immediately and change your password.',
    ].join('\n'),
    html: [
      '<p>Your password was reset.</p>',
      `<p><strong>Temporary password:</strong> ${temporaryPassword}</p>`,
      '<p>Please log in immediately and change your password.</p>',
    ].join(''),
  });
}

module.exports = {
  sendPasswordResetTemporaryPasswordEmail,
};
