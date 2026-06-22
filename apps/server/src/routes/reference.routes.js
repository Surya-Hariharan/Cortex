const express = require('express');
const referenceController = require('../controllers/reference.controller');
const { asyncHandler } = require('../utils/async-handler.util');

const router = express.Router();

router.get('/districts', asyncHandler(referenceController.getDistricts));
router.get('/colleges', asyncHandler(referenceController.getColleges));
router.get('/degrees', asyncHandler(referenceController.getDegrees));
router.get('/courses', asyncHandler(referenceController.getCourses));

module.exports = router;
