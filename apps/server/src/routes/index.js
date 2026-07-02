const { Router } = require('express');

const router = Router();

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./users.routes'));
router.use('/sync', require('./sync.routes'));
router.use('/backups', require('./backup.routes'));
router.use('/notifications', require('./notifications.routes'));
// Collaboration covers friends/workspaces/invitations/organizations under one router.
router.use('/', require('./collaboration.routes'));

module.exports = router;
