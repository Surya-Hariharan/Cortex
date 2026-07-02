const usersRepo = require('../repositories/users.repository');
const devicesRepo = require('../repositories/devices.repository');
const activityLog = require('./activityLog.service');
const emailService = require('./email.service');
// Required as a namespace object (not destructured) so tests can
// vi.spyOn(supabase, 'supabaseAdmin') and have it take effect here — a
// destructured const would capture the original function reference at
// require-time, before any spy is installed (see tests/unit/auth.service.test.js).
const supabase = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

function publicUser(user, fallbackFullName) {
    return {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || fallbackFullName || null,
        email_verified: !!user.email_confirmed_at,
    };
}

async function register({ email, password, full_name: fullName, device }) {
    const admin = supabase.supabaseAdmin();
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        user_metadata: { full_name: fullName },
        email_confirm: false,
    });
    if (createErr) {
        if (/already registered|already exists/i.test(createErr.message || '')) {
            throw new ApiError(409, 'email_taken', 'An account with this email already exists.');
        }
        throw new ApiError(400, 'registration_failed', createErr.message || 'Could not create account.');
    }
    const user = created.user;

    // admin.createUser doesn't return a session — sign in immediately so
    // registration also logs the user in, matching the old behaviour.
    const { data: signedIn, error: signInErr } = await supabase.supabaseAnon().auth.signInWithPassword({ email, password });
    if (signInErr || !signedIn?.session) {
        throw new ApiError(500, 'registration_failed', 'Account created but automatic sign-in failed. Please log in.');
    }

    const deviceRow = await devicesRepo.upsertDevice({ userId: user.id, ...device });
    await usersRepo.upsertProfile(user.id, { displayName: fullName });
    await activityLog.record(user.id, 'account_created', { resourceType: 'device', resourceId: deviceRow.id });
    await emailService.sendWelcomeEmail(email, { fullName });

    return {
        user: publicUser(user, fullName),
        device: deviceRow,
        accessToken: signedIn.session.access_token,
        refreshToken: signedIn.session.refresh_token,
    };
}

async function login({ email, password, device }) {
    const { data, error } = await supabase.supabaseAnon().auth.signInWithPassword({ email, password });
    if (error || !data?.session) throw new ApiError(401, 'invalid_credentials', 'Invalid email or password.');

    const isNewDevice = !(await devicesRepo.findByFingerprint(data.user.id, device.fingerprint));
    const deviceRow = await devicesRepo.upsertDevice({ userId: data.user.id, ...device });
    await activityLog.record(data.user.id, 'login', { resourceType: 'device', resourceId: deviceRow.id });

    // Best-effort — email.service.js never throws, so a flaky email provider
    // can't fail login.
    await emailService.sendLoginNotificationEmail(data.user.email, { deviceName: deviceRow.name });
    if (isNewDevice) {
        await emailService.sendNewDeviceAlertEmail(data.user.email, { deviceName: deviceRow.name });
    }

    return {
        user: publicUser(data.user),
        device: deviceRow,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
    };
}

async function refresh({ refreshToken, deviceId }) {
    const { data, error } = await supabase.supabaseAnon().auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data?.session) throw new ApiError(401, 'invalid_token', 'Refresh token invalid or expired.');

    if (deviceId) await devicesRepo.touchLastSeen(deviceId).catch(() => {});

    return {
        user: publicUser(data.user),
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
    };
}

// Signs out the single session tied to this access token ("log out of this
// device"). See signOutAllDevices for "sign out everywhere."
async function logout(accessToken) {
    try {
        await supabase.supabaseAdmin().auth.admin.signOut(accessToken, 'local');
    } catch (err) {
        logger.warn(`[auth] logout signOut failed: ${err.message}`);
    }
    return { success: true };
}

async function signOutAllDevices(userId, accessToken) {
    try {
        await supabase.supabaseAdmin().auth.admin.signOut(accessToken, 'global');
    } catch (err) {
        logger.warn(`[auth] signOutAllDevices failed: ${err.message}`);
    }
    await devicesRepo.revokeAllForUser(userId);
    await activityLog.record(userId, 'signed_out_all_devices');
    return { success: true };
}

async function requestEmailVerification(userId, email) {
    const { data, error } = await supabase.supabaseAdmin().auth.admin.generateLink({ type: 'signup', email });
    if (error) {
        logger.warn(`[auth] generateLink(signup) failed for ${email}: ${error.message}`);
        return;
    }
    const otp = data?.properties?.email_otp;
    if (otp) await emailService.sendVerificationEmail(email, otp);
}

async function confirmEmailVerification(email, token) {
    const { data, error } = await supabase.supabaseAnon().auth.verifyOtp({ email, token, type: 'signup' });
    if (error || !data?.user) {
        throw new ApiError(400, 'invalid_token', 'This verification code is invalid or has expired.');
    }
    await activityLog.record(data.user.id, 'email_verified');
    return { success: true };
}

// Always returns the same shape regardless of whether the email exists —
// prevents account enumeration via the forgot-password flow.
async function requestPasswordReset(email) {
    const { data, error } = await supabase.supabaseAdmin().auth.admin.generateLink({ type: 'recovery', email });
    if (!error && data?.properties?.email_otp) {
        await emailService.sendPasswordResetEmail(email, data.properties.email_otp);
    } else if (error) {
        logger.warn(`[auth] generateLink(recovery) failed for ${email}: ${error.message}`);
    }
    return { message: 'If that email is registered, a reset code has been sent.' };
}

async function resetPassword({ email, token, new_password: newPassword }) {
    const { data, error } = await supabase.supabaseAnon().auth.verifyOtp({ email, token, type: 'recovery' });
    if (error || !data?.user) {
        throw new ApiError(400, 'invalid_token', 'This reset code is invalid or has expired.');
    }

    const admin = supabase.supabaseAdmin();
    const { error: updateErr } = await admin.auth.admin.updateUserById(data.user.id, { password: newPassword });
    if (updateErr) throw new ApiError(500, 'reset_failed', 'Could not update password.');

    // Revoke every existing session — matches the old behaviour of revoking
    // all device sessions on a successful password reset.
    if (data.session?.access_token) {
        await admin.auth.admin.signOut(data.session.access_token, 'global').catch(() => {});
    }
    await devicesRepo.revokeAllForUser(data.user.id);
    await activityLog.record(data.user.id, 'password_reset');

    return { message: 'Password reset. You can now log in with your new password.' };
}

async function listDevices(userId) {
    return devicesRepo.listForUser(userId);
}

async function revokeDevice(deviceId, userId) {
    await devicesRepo.revoke(deviceId, userId);
    await activityLog.record(userId, 'device_revoked', { resourceType: 'device', resourceId: deviceId });
    return { success: true };
}

async function setDeviceWrappedKey(deviceId, userId, wrappedUserKey) {
    const device = await devicesRepo.setWrappedUserKey(deviceId, userId, wrappedUserKey);
    if (!device) throw new ApiError(404, 'not_found', 'Device not found.');
    return { success: true };
}

async function deleteAccount(userId, email) {
    await emailService.sendAccountDeletionConfirmationEmail(email);
    await activityLog.record(userId, 'account_deleted');
    const { error } = await supabase.supabaseAdmin().auth.admin.deleteUser(userId);
    if (error) throw new ApiError(500, 'deletion_failed', 'Could not delete account.');
    return { success: true };
}

module.exports = {
    register,
    login,
    refresh,
    logout,
    signOutAllDevices,
    requestEmailVerification,
    confirmEmailVerification,
    requestPasswordReset,
    resetPassword,
    listDevices,
    revokeDevice,
    setDeviceWrappedKey,
    deleteAccount,
    publicUser,
};
