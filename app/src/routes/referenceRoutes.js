const express = require('express');
const referenceController = require('../controllers/referenceController');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/districts', asyncHandler(referenceController.getDistricts));
router.get('/colleges', asyncHandler(referenceController.getColleges));
router.get('/degrees', asyncHandler(referenceController.getDegrees));
router.get('/courses', asyncHandler(referenceController.getCourses));

module.exports = router;
