const express = require('express');
const authController = require('../controllers/authController');
const { authJwt } = require('../middleware/authJwt');
const { authRateLimiter } = require('../middleware/rateLimiters');
const { requestSchemaValidator } = require('../validators/requestSchemaValidator');
const { enumValidator } = require('../validators/enumValidator');
const { academicIntegrityValidator } = require('../validators/academicIntegrityValidator');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.post(
  '/signup',
  authRateLimiter,
  requestSchemaValidator({
    required: [
      'email',
      'password',
      'full_name',
      'gender',
      'district_id',
      'college_id',
      'student_status',
      'degree_id',
      'course_id',
    ],
    types: {
      email: 'string',
      password: 'string',
      full_name: 'string',
      gender: 'string',
      district_id: 'number',
      college_id: 'number',
      student_status: 'string',
      year_of_study: 'number',
      graduation_year: 'number',
      degree_id: 'number',
      course_id: 'number',
    },
  }),
  enumValidator('gender', ['male', 'female', 'other', 'prefer_not_to_say']),
  enumValidator('student_status', ['student', 'alumni']),
  academicIntegrityValidator,
  asyncHandler(authController.signup)
);

router.post(
  '/login',
  authRateLimiter,
  requestSchemaValidator({
    required: ['email', 'password'],
    types: {
      email: 'string',
      password: 'string',
    },
  }),
  asyncHandler(authController.login)
);

router.post(
  '/refresh',
  authRateLimiter,
  requestSchemaValidator({
    required: ['refreshToken'],
    types: { refreshToken: 'string' },
  }),
  asyncHandler(authController.refresh)
);

router.post(
  '/logout',
  authJwt,
  requestSchemaValidator({
    required: ['refreshToken'],
    types: { refreshToken: 'string' },
  }),
  asyncHandler(authController.logout)
);

module.exports = router;
