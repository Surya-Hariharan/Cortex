const { Router } = require('express');
const controller = require('../controllers/sync.controller');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const schemas = require('../models/sync.schemas');

const router = Router();
router.use(authenticate);

router.post('/push', validate(schemas.pushSchema), controller.push);
router.get('/pull', validate(schemas.pullQuerySchema, 'query'), controller.pull);
router.get('/resource/:type/:id/versions', controller.versions);
router.get('/status', controller.status);

module.exports = router;
