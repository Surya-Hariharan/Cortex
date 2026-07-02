const usersService = require('../services/users.service');
const { asyncHandler } = require('../utils/asyncHandler');

const getMe = asyncHandler(async (req, res) => {
    res.status(200).json(await usersService.getMe(req.user.id));
});

const updateMe = asyncHandler(async (req, res) => {
    res.status(200).json(await usersService.updateMe(req.user.id, req.body));
});

const getPreferences = asyncHandler(async (req, res) => {
    res.status(200).json({ preferences: await usersService.getPreferences(req.user.id) });
});

const setPreferences = asyncHandler(async (req, res) => {
    res.status(200).json({ preferences: await usersService.setPreferences(req.user.id, req.body.preferences) });
});

const getSubscription = asyncHandler(async (req, res) => {
    res.status(200).json(await usersService.getSubscription(req.user.id));
});

module.exports = { getMe, updateMe, getPreferences, setPreferences, getSubscription };
