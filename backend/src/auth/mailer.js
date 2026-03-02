/**
 * Cortex — Email Transporter (Nodemailer)
 * Sends OTP verification emails via Gmail SMTP.
 */

const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;

    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
        console.warn('[Mailer] SMTP_USER / SMTP_PASS not set — OTP emails disabled.');
        return null;
    }

    transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    });

    console.log(`[Mailer] ✓ SMTP configured (${host}:${port})`);
    return transporter;
}

/**
 * Send a 6-digit OTP to the given email.
 * Returns { success: true } or { success: false, error }.
 */
async function sendOtp(email, otp, studentName) {
    const t = getTransporter();
    if (!t) {
        return { success: false, error: 'Email service not configured. Set SMTP_USER and SMTP_PASS in .env' };
    }

    const html = `
    <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fafbff;border-radius:16px;border:1px solid #e2e8f0">
        <div style="text-align:center;margin-bottom:24px">
            <div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#6366f1,#4338ca);margin-bottom:12px">
                <span style="color:#fff;font-size:20px;font-weight:700">C</span>
            </div>
            <h1 style="font-size:22px;font-weight:700;color:#1e293b;margin:0">Cortex</h1>
            <p style="font-size:13px;color:#94a3b8;margin:4px 0 0">Offline AI for Students</p>
        </div>
        <p style="font-size:15px;color:#334155;line-height:1.6;margin-bottom:8px">
            Hi${studentName ? ` <strong>${studentName}</strong>` : ''},
        </p>
        <p style="font-size:15px;color:#334155;line-height:1.6;margin-bottom:24px">
            Your verification code is:
        </p>
        <div style="text-align:center;margin-bottom:24px">
            <div style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#6366f1,#4338ca);border-radius:12px;letter-spacing:8px;font-size:32px;font-weight:700;color:#fff;font-family:'Courier New',monospace">
                ${otp}
            </div>
        </div>
        <p style="font-size:13px;color:#64748b;text-align:center;margin-bottom:0">
            This code expires in <strong>10 minutes</strong>. Do not share it with anyone.
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 16px">
        <p style="font-size:11px;color:#94a3b8;text-align:center;margin:0">
            If you didn't request this, you can safely ignore this email.
        </p>
    </div>`;

    try {
        await t.sendMail({
            from: `"Cortex" <${process.env.SMTP_USER}>`,
            to: email,
            subject: `${otp} — Your Cortex Verification Code`,
            html,
        });
        console.log(`[Mailer] OTP sent to ${email}`);
        return { success: true };
    } catch (err) {
        console.error(`[Mailer] Failed to send OTP to ${email}:`, err.message);
        return { success: false, error: 'Failed to send email. Check your internet connection.' };
    }
}

module.exports = { sendOtp, getTransporter };
