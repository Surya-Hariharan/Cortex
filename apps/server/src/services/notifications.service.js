const notificationsRepo = require('../repositories/notifications.repository');

async function list(userId, unreadOnly) {
    return notificationsRepo.listForUser(userId, { unreadOnly });
}

async function markRead(id, userId) {
    return notificationsRepo.markRead(id, userId);
}

async function markAllRead(userId) {
    await notificationsRepo.markAllRead(userId);
    return { success: true };
}

async function registerPushToken(userId, { deviceId, platform, token }) {
    return notificationsRepo.registerPushToken({ userId, deviceId, platform, token });
}

async function removePushToken(id, userId) {
    await notificationsRepo.removePushToken(id, userId);
    return { success: true };
}

module.exports = { list, markRead, markAllRead, registerPushToken, removePushToken };
