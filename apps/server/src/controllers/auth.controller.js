const authService = require('../services/auth.service');
const { asyncHandler } = require('../utils/asyncHandler');

const register = asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    await authService.requestEmailVerification(result.user.id, result.user.email);
    res.status(201).json(result);
});

const login = asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    res.status(200).json(result);
});

const refresh = asyncHandler(async (req, res) => {
    const result = await authService.refresh(req.body);
    res.status(200).json(result);
});

// Authenticated — signs out the session tied to the presented access token.
const logout = asyncHandler(async (req, res) => {
    const result = await authService.logout(req.accessToken);
    res.status(200).json(result);
});

const logoutAll = asyncHandler(async (req, res) => {
    const result = await authService.signOutAllDevices(req.user.id, req.accessToken);
    res.status(200).json(result);
});

const requestEmailVerification = asyncHandler(async (req, res) => {
    await authService.requestEmailVerification(req.user.id, req.user.email);
    res.status(200).json({ message: 'Verification code sent.' });
});

const confirmEmailVerification = asyncHandler(async (req, res) => {
    const result = await authService.confirmEmailVerification(req.user.email, req.body.token);
    res.status(200).json(result);
});

const forgotPassword = asyncHandler(async (req, res) => {
    const result = await authService.requestPasswordReset(req.body.email);
    res.status(200).json(result);
});

const resetPassword = asyncHandler(async (req, res) => {
    const result = await authService.resetPassword(req.body);
    res.status(200).json(result);
});

const listDevices = asyncHandler(async (req, res) => {
    const devices = await authService.listDevices(req.user.id);
    res.status(200).json({ devices });
});

const revokeDevice = asyncHandler(async (req, res) => {
    const result = await authService.revokeDevice(req.params.deviceId, req.user.id);
    res.status(200).json(result);
});

const setDeviceKey = asyncHandler(async (req, res) => {
    const result = await authService.setDeviceWrappedKey(req.params.deviceId, req.user.id, req.body.wrappedUserKey);
    res.status(200).json(result);
});

const deleteAccount = asyncHandler(async (req, res) => {
    const result = await authService.deleteAccount(req.user.id, req.user.email);
    res.status(200).json(result);
});

module.exports = {
    register,
    login,
    refresh,
    logout,
    logoutAll,
    requestEmailVerification,
    confirmEmailVerification,
    forgotPassword,
    resetPassword,
    listDevices,
    revokeDevice,
    setDeviceKey,
    deleteAccount,
};
