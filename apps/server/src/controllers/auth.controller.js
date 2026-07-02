const devicesRepo = require('../repositories/devices.repository');
const usersRepo = require('../repositories/users.repository');
const activityLog = require('../services/activityLog.service');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../middleware/errorHandler');

// Replaces the old login/register flow. 
// Called by the desktop app after Clerk authenticates them, to register the device.
const initSession = asyncHandler(async (req, res) => {
    const { device } = req.body;
    
    // Ensure the user exists in our local DB (since Clerk handles the primary identity)
    await usersRepo.upsertProfile(req.user.id, { 
        displayName: req.user.email?.split('@')[0] || 'Cortex User'
    });

    const isNewDevice = !(await devicesRepo.findByFingerprint(req.user.id, device.fingerprint));
    const deviceRow = await devicesRepo.upsertDevice({ userId: req.user.id, ...device });
    
    await activityLog.record(req.user.id, isNewDevice ? 'device_registered' : 'session_started', { 
        resourceType: 'device', 
        resourceId: deviceRow.id 
    });

    res.status(200).json({ device: deviceRow });
});

const listDevices = asyncHandler(async (req, res) => {
    const devices = await devicesRepo.listForUser(req.user.id);
    res.status(200).json({ devices });
});

const revokeDevice = asyncHandler(async (req, res) => {
    await devicesRepo.revoke(req.params.deviceId, req.user.id);
    await activityLog.record(req.user.id, 'device_revoked', { resourceType: 'device', resourceId: req.params.deviceId });
    res.status(200).json({ success: true });
});

const setDeviceKey = asyncHandler(async (req, res) => {
    const device = await devicesRepo.setWrappedUserKey(req.params.deviceId, req.user.id, req.body.wrappedUserKey);
    if (!device) throw new ApiError(404, 'not_found', 'Device not found.');
    res.status(200).json({ success: true });
});

const deleteAccount = asyncHandler(async (req, res) => {
    // Clerk handles the actual deletion, this just records it locally or cleans up
    await activityLog.record(req.user.id, 'account_deleted');
    // Note: To fully delete from Clerk, a webhook should be used.
    res.status(200).json({ success: true, message: 'Local data marked for deletion.' });
});

module.exports = {
    initSession,
    listDevices,
    revokeDevice,
    setDeviceKey,
    deleteAccount,
};
