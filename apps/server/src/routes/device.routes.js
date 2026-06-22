const express = require('express');
const deviceController = require('../controllers/device.controller');
const { authJwt } = require('../middleware/auth-jwt.middleware');
const { requestSchemaValidator } = require('../validators/request-schema.validator');
const { asyncHandler } = require('../utils/async-handler.util');

const router = express.Router();

router.post(
  '/register',
  authJwt,
  requestSchemaValidator({
    required: ['fingerprint'],
    types: {
      fingerprint: 'string',
      ram: 'number',
      cpu: 'number',
      gpu: 'boolean',
      npu: 'boolean',
    },
  }),
  asyncHandler(deviceController.registerDevice)
);

module.exports = router;
