const { Router } = require('express');
const controller = require('../controllers/auth.controller');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const { authLimiter } = require('../middleware/rateLimit');
const schemas = require('../models/auth.schemas');

const router = Router();

router.post('/register', authLimiter, validate(schemas.registerSchema), controller.register);
router.post('/login', authLimiter, validate(schemas.loginSchema), controller.login);
router.post('/refresh', authLimiter, validate(schemas.refreshSchema), controller.refresh);

// Logout identifies the session via the bearer token itself, not a body param.
router.post('/logout', authenticate, controller.logout);
router.post('/logout-all', authenticate, controller.logoutAll);

router.post('/verify-email/request', authenticate, controller.requestEmailVerification);
router.post('/verify-email/confirm', authenticate, validate(schemas.verifyEmailConfirmSchema), controller.confirmEmailVerification);

router.post('/password/forgot', authLimiter, validate(schemas.forgotPasswordSchema), controller.forgotPassword);
router.post('/password/reset', authLimiter, validate(schemas.resetPasswordSchema), controller.resetPassword);

router.get('/devices', authenticate, controller.listDevices);
router.delete('/devices/:deviceId', authenticate, controller.revokeDevice);
router.put('/devices/:deviceId/key', authenticate, validate(schemas.setDeviceKeySchema), controller.setDeviceKey);

router.delete('/account', authenticate, controller.deleteAccount);

module.exports = router;
