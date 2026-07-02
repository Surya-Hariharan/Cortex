const backupService = require('../services/backup.service');
const { asyncHandler } = require('../utils/asyncHandler');

const create = asyncHandler(async (req, res) => {
    const backup = await backupService.createBackup(req.user.id, req.body);
    res.status(201).json(backup);
});

const list = asyncHandler(async (req, res) => {
    const backups = await backupService.listBackups(req.user.id);
    res.status(200).json({ backups });
});

const restore = asyncHandler(async (req, res) => {
    const result = await backupService.restoreBackup(req.params.backupId, req.user.id);
    res.status(200).json(result);
});

module.exports = { create, list, restore };
