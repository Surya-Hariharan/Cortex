const syncService = require('../services/sync.service');
const { asyncHandler } = require('../utils/asyncHandler');

const push = asyncHandler(async (req, res) => {
    const result = await syncService.push(req.user.id, req.body);
    // 207 Multi-Status: some blobs may be accepted while others conflict.
    res.status(207).json(result);
});

const pull = asyncHandler(async (req, res) => {
    const result = await syncService.pull(req.user.id, req.query);
    res.status(200).json(result);
});

const versions = asyncHandler(async (req, res) => {
    const result = await syncService.versions(req.user.id, req.params.type, req.params.id);
    res.status(200).json({ versions: result });
});

const status = asyncHandler(async (req, res) => {
    const result = await syncService.status(req.user.id);
    res.status(200).json({ metadata: result });
});

module.exports = { push, pull, versions, status };
