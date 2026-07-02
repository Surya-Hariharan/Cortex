const { Router } = require('express');
const controller = require('../controllers/auth.controller');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const schemas = require('../models/auth.schemas');

const router = Router();

// Replaces login/register. Called by desktop app after Clerk authentication to register the device.
router.post('/session/init', authenticate, controller.initSession);

router.get('/devices', authenticate, controller.listDevices);
router.delete('/devices/:deviceId', authenticate, controller.revokeDevice);
router.put('/devices/:deviceId/key', authenticate, validate(schemas.setDeviceKeySchema), controller.setDeviceKey);

router.delete('/account', authenticate, controller.deleteAccount);

module.exports = router;
