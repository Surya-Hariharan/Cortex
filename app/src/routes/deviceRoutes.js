const express = require('express');
const deviceController = require('../controllers/deviceController');
const { authJwt } = require('../middleware/authJwt');
const { requestSchemaValidator } = require('../validators/requestSchemaValidator');
const { asyncHandler } = require('../utils/asyncHandler');

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
