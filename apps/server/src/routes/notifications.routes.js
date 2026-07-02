const { Router } = require('express');
const controller = require('../controllers/notifications.controller');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const schemas = require('../models/notifications.schemas');

const router = Router();
router.use(authenticate);

router.get('/', controller.list);
router.patch('/:id/read', controller.markRead);
router.patch('/read-all', controller.markAllRead);
router.post('/push-tokens', validate(schemas.registerPushTokenSchema), controller.registerPushToken);
router.delete('/push-tokens/:id', controller.removePushToken);

module.exports = router;
