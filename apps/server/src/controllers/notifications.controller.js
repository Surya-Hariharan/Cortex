const notificationsService = require('../services/notifications.service');
const { asyncHandler } = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
    const unreadOnly = req.query.unread === 'true';
    res.status(200).json({ notifications: await notificationsService.list(req.user.id, unreadOnly) });
});

const markRead = asyncHandler(async (req, res) => {
    res.status(200).json(await notificationsService.markRead(req.params.id, req.user.id));
});

const markAllRead = asyncHandler(async (req, res) => {
    res.status(200).json(await notificationsService.markAllRead(req.user.id));
});

const registerPushToken = asyncHandler(async (req, res) => {
    res.status(201).json(await notificationsService.registerPushToken(req.user.id, req.body));
});

const removePushToken = asyncHandler(async (req, res) => {
    res.status(200).json(await notificationsService.removePushToken(req.params.id, req.user.id));
});

module.exports = { list, markRead, markAllRead, registerPushToken, removePushToken };
