const { Router } = require('express');
const controller = require('../controllers/users.controller');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const schemas = require('../models/users.schemas');

const router = Router();
router.use(authenticate);

router.get('/me', controller.getMe);
router.patch('/me', validate(schemas.updateProfileSchema), controller.updateMe);
router.get('/me/preferences', controller.getPreferences);
router.put('/me/preferences', validate(schemas.updatePreferencesSchema), controller.setPreferences);
router.get('/me/subscription', controller.getSubscription);

module.exports = router;
