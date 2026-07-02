import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// require()'d rather than import'd — see the comment in this file's prior
// version for why: vi.spyOn() on a require()'d module object is visible
// from inside auth.service.js only because auth.service.js also looks up
// these dependencies via a namespace object (not destructured) at call time.
const usersRepo = require('../../src/repositories/users.repository.js');
const devicesRepo = require('../../src/repositories/devices.repository.js');
const activityLog = require('../../src/services/activityLog.service.js');
const emailService = require('../../src/services/email.service.js');
const supabaseConfig = require('../../src/config/supabase.js');
const authService = require('../../src/services/auth.service.js');

function spyAll(mod, methods) {
    const spies = {};
    for (const name of methods) {
        spies[name] = vi.spyOn(mod, name).mockResolvedValue(undefined);
    }
    return spies;
}

const DEVICE = { fingerprint: 'device-1', name: 'Test PC', platform: 'windows' };

describe('auth.service', () => {
    let devices;
    let email;
    let admin;
    let anon;

    beforeEach(() => {
        vi.spyOn(usersRepo, 'upsertProfile').mockResolvedValue({});
        devices = spyAll(devicesRepo, ['upsertDevice', 'findByFingerprint', 'touchLastSeen', 'revoke', 'revokeAllForUser']);
        vi.spyOn(activityLog, 'record').mockResolvedValue(undefined);
        email = spyAll(emailService, [
            'sendWelcomeEmail', 'sendVerificationEmail', 'sendPasswordResetEmail',
            'sendLoginNotificationEmail', 'sendNewDeviceAlertEmail',
        ]);

        admin = {
            auth: {
                admin: {
                    createUser: vi.fn(),
                    generateLink: vi.fn(),
                    signOut: vi.fn().mockResolvedValue({ error: null }),
                    updateUserById: vi.fn().mockResolvedValue({ error: null }),
                    deleteUser: vi.fn().mockResolvedValue({ error: null }),
                },
            },
        };
        anon = {
            auth: {
                signInWithPassword: vi.fn(),
                refreshSession: vi.fn(),
                verifyOtp: vi.fn(),
            },
        };
        vi.spyOn(supabaseConfig, 'supabaseAdmin').mockReturnValue(admin);
        vi.spyOn(supabaseConfig, 'supabaseAnon').mockReturnValue(anon);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('register', () => {
        it('rejects a duplicate email', async () => {
            admin.auth.admin.createUser.mockResolvedValue({ data: null, error: { message: 'User already registered' } });

            await expect(
                authService.register({ email: 'a@b.com', password: 'password123', full_name: 'A', device: DEVICE })
            ).rejects.toMatchObject({ status: 409, code: 'email_taken' });

            expect(anon.auth.signInWithPassword).not.toHaveBeenCalled();
        });

        it('creates a Supabase user, signs in, and creates a device row', async () => {
            admin.auth.admin.createUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'a@b.com' } }, error: null });
            anon.auth.signInWithPassword.mockResolvedValue({
                data: { user: { id: 'user-1', email: 'a@b.com' }, session: { access_token: 'at-1', refresh_token: 'rt-1' } },
                error: null,
            });
            devices.upsertDevice.mockResolvedValue({ id: 'device-row-1', name: 'Test PC' });

            const result = await authService.register({ email: 'a@b.com', password: 'password123', full_name: 'A', device: DEVICE });

            expect(result.user).toEqual({ id: 'user-1', email: 'a@b.com', full_name: 'A', email_verified: false });
            expect(result.accessToken).toBe('at-1');
            expect(result.refreshToken).toBe('rt-1');
            expect(devices.upsertDevice).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', fingerprint: 'device-1' }));
            expect(email.sendWelcomeEmail).toHaveBeenCalledWith('a@b.com', { fullName: 'A' });
        });
    });

    describe('login', () => {
        it('rejects invalid credentials', async () => {
            anon.auth.signInWithPassword.mockResolvedValue({ data: null, error: { message: 'Invalid login credentials' } });

            await expect(
                authService.login({ email: 'a@b.com', password: 'wrong', device: DEVICE })
            ).rejects.toMatchObject({ status: 401, code: 'invalid_credentials' });
        });

        it('succeeds and sends a new-device alert for an unseen fingerprint', async () => {
            anon.auth.signInWithPassword.mockResolvedValue({
                data: { user: { id: 'user-1', email: 'a@b.com' }, session: { access_token: 'at-1', refresh_token: 'rt-1' } },
                error: null,
            });
            devices.findByFingerprint.mockResolvedValue(null); // never seen before
            devices.upsertDevice.mockResolvedValue({ id: 'device-row-1', name: 'Test PC' });

            const result = await authService.login({ email: 'a@b.com', password: 'correct', device: DEVICE });

            expect(result.accessToken).toBe('at-1');
            expect(email.sendLoginNotificationEmail).toHaveBeenCalled();
            expect(email.sendNewDeviceAlertEmail).toHaveBeenCalled();
        });

        it('does not send a new-device alert for a known fingerprint', async () => {
            anon.auth.signInWithPassword.mockResolvedValue({
                data: { user: { id: 'user-1', email: 'a@b.com' }, session: { access_token: 'at-1', refresh_token: 'rt-1' } },
                error: null,
            });
            devices.findByFingerprint.mockResolvedValue({ id: 'device-row-1' }); // already known
            devices.upsertDevice.mockResolvedValue({ id: 'device-row-1', name: 'Test PC' });

            await authService.login({ email: 'a@b.com', password: 'correct', device: DEVICE });

            expect(email.sendNewDeviceAlertEmail).not.toHaveBeenCalled();
        });
    });

    describe('refresh', () => {
        it('rejects an invalid/expired refresh token', async () => {
            anon.auth.refreshSession.mockResolvedValue({ data: null, error: { message: 'invalid' } });
            await expect(authService.refresh({ refreshToken: 'bad' })).rejects.toMatchObject({ status: 401, code: 'invalid_token' });
        });

        it('rotates tokens and touches the device when a deviceId is given', async () => {
            anon.auth.refreshSession.mockResolvedValue({
                data: { user: { id: 'user-1', email: 'a@b.com' }, session: { access_token: 'at-2', refresh_token: 'rt-2' } },
                error: null,
            });

            const result = await authService.refresh({ refreshToken: 'good', deviceId: 'device-row-1' });

            expect(result.accessToken).toBe('at-2');
            expect(devices.touchLastSeen).toHaveBeenCalledWith('device-row-1');
        });
    });

    describe('signOutAllDevices', () => {
        it('revokes the Supabase session and every local device row', async () => {
            await authService.signOutAllDevices('user-1', 'at-1');

            expect(admin.auth.admin.signOut).toHaveBeenCalledWith('at-1', 'global');
            expect(devices.revokeAllForUser).toHaveBeenCalledWith('user-1');
            expect(activityLog.record).toHaveBeenCalledWith('user-1', 'signed_out_all_devices');
        });
    });

    describe('requestPasswordReset', () => {
        it('returns the same message whether or not the email is registered (no enumeration)', async () => {
            admin.auth.admin.generateLink.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
            const notFoundResult = await authService.requestPasswordReset('nobody@b.com');

            admin.auth.admin.generateLink.mockResolvedValueOnce({ data: { properties: { email_otp: '123456' } }, error: null });
            const foundResult = await authService.requestPasswordReset('a@b.com');

            expect(notFoundResult).toEqual(foundResult);
            expect(email.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
        });
    });

    describe('resetPassword', () => {
        it('rejects an invalid or expired OTP', async () => {
            anon.auth.verifyOtp.mockResolvedValue({ data: null, error: { message: 'expired' } });
            await expect(
                authService.resetPassword({ email: 'a@b.com', token: 'bad', new_password: 'newpassword123' })
            ).rejects.toMatchObject({ status: 400, code: 'invalid_token' });
        });

        it('updates the password and revokes existing sessions on success', async () => {
            anon.auth.verifyOtp.mockResolvedValue({
                data: { user: { id: 'user-1' }, session: { access_token: 'recovery-at' } },
                error: null,
            });

            await authService.resetPassword({ email: 'a@b.com', token: 'good', new_password: 'newpassword123' });

            expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith('user-1', { password: 'newpassword123' });
            expect(admin.auth.admin.signOut).toHaveBeenCalledWith('recovery-at', 'global');
            expect(devices.revokeAllForUser).toHaveBeenCalledWith('user-1');
        });
    });
});
