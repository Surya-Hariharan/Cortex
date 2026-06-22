// email.util.js caches its SMTP transporter at module level.
// jest.resetModules() in beforeEach ensures each test gets a fresh module
// (fresh cachedTransporter = null) when it calls require('../email.util').
//
// Variable names referenced inside jest.mock() factories must start with "mock".

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
const mockCreateTransport = jest.fn();

jest.mock('nodemailer', () => ({
    createTransport: mockCreateTransport,
}));

// ── Missing SMTP config → throws ──────────────────────────────────────────────

describe('email.util — missing SMTP config', () => {
    beforeEach(() => {
        jest.resetModules();
        mockCreateTransport.mockClear();
        mockSendMail.mockClear();
        delete process.env.SMTP_HOST;
        delete process.env.SMTP_USER;
        delete process.env.SMTP_PASSWORD;
    });

    it('throws when SMTP_HOST is missing', async () => {
        const { sendPasswordResetTemporaryPasswordEmail } = require('../email.util');
        await expect(
            sendPasswordResetTemporaryPasswordEmail({ to: 'a@b.com', temporaryPassword: 'X' })
        ).rejects.toThrow('SMTP configuration is missing');
    });

    it('throws when SMTP_USER is missing', async () => {
        process.env.SMTP_HOST = 'smtp.example.com';
        process.env.SMTP_PASSWORD = 'pass';
        const { sendPasswordResetTemporaryPasswordEmail } = require('../email.util');
        await expect(
            sendPasswordResetTemporaryPasswordEmail({ to: 'a@b.com', temporaryPassword: 'X' })
        ).rejects.toThrow('SMTP configuration is missing');
    });

    it('throws when SMTP_PASSWORD is missing', async () => {
        process.env.SMTP_HOST = 'smtp.example.com';
        process.env.SMTP_USER = 'user@example.com';
        const { sendPasswordResetTemporaryPasswordEmail } = require('../email.util');
        await expect(
            sendPasswordResetTemporaryPasswordEmail({ to: 'a@b.com', temporaryPassword: 'X' })
        ).rejects.toThrow('SMTP configuration is missing');
    });
});

// ── sendMail happy paths ──────────────────────────────────────────────────────

describe('email.util — sendPasswordResetTemporaryPasswordEmail', () => {
    beforeEach(() => {
        jest.resetModules();
        mockSendMail.mockClear();
        mockCreateTransport.mockClear();
        mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });

        process.env.SMTP_HOST = 'smtp.example.com';
        process.env.SMTP_PORT = '587';
        process.env.SMTP_USER = 'no-reply@example.com';
        process.env.SMTP_PASSWORD = 'secret';
        process.env.SMTP_FROM_NAME = 'Cortex';
        process.env.SMTP_FROM_EMAIL = 'no-reply@example.com';
    });

    afterEach(() => {
        delete process.env.SMTP_HOST;
        delete process.env.SMTP_USER;
        delete process.env.SMTP_PASSWORD;
        delete process.env.SMTP_PORT;
        delete process.env.SMTP_FROM_NAME;
        delete process.env.SMTP_FROM_EMAIL;
    });

    it('calls sendMail with the correct recipient and subject', async () => {
        const { sendPasswordResetTemporaryPasswordEmail } = require('../email.util');
        await sendPasswordResetTemporaryPasswordEmail({ to: 'student@example.com', temporaryPassword: 'Abc123!@' });

        expect(mockSendMail).toHaveBeenCalledTimes(1);
        const mailArgs = mockSendMail.mock.calls[0][0];
        expect(mailArgs.to).toBe('student@example.com');
        expect(mailArgs.subject).toBe('Password Reset');
    });

    it('includes the temporary password in the email body', async () => {
        const { sendPasswordResetTemporaryPasswordEmail } = require('../email.util');
        await sendPasswordResetTemporaryPasswordEmail({ to: 'a@b.com', temporaryPassword: 'TempPwd9!' });

        const mailArgs = mockSendMail.mock.calls[0][0];
        expect(mailArgs.text).toContain('TempPwd9!');
        expect(mailArgs.html).toContain('TempPwd9!');
    });

    it('uses secure:true when SMTP_PORT is 465', async () => {
        process.env.SMTP_PORT = '465';
        const { sendPasswordResetTemporaryPasswordEmail } = require('../email.util');
        await sendPasswordResetTemporaryPasswordEmail({ to: 'a@b.com', temporaryPassword: 'X' });

        const transportArgs = mockCreateTransport.mock.calls[0][0];
        expect(transportArgs.secure).toBe(true);
    });

    it('uses secure:false when SMTP_PORT is 587', async () => {
        const { sendPasswordResetTemporaryPasswordEmail } = require('../email.util');
        await sendPasswordResetTemporaryPasswordEmail({ to: 'a@b.com', temporaryPassword: 'X' });

        const transportArgs = mockCreateTransport.mock.calls[0][0];
        expect(transportArgs.secure).toBe(false);
    });
});
