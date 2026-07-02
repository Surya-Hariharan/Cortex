const { Router } = require('express');
const controller = require('../controllers/backup.controller');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const schemas = require('../models/backup.schemas');

const router = Router();
router.use(authenticate);

router.post('/', validate(schemas.createBackupSchema), controller.create);
router.get('/', controller.list);
router.post('/:backupId/restore', controller.restore);

module.exports = router;
