function requestSchemaValidator(schema) {
  return function validateSchema(req, res, next) {
    const errors = [];

    for (const field of schema.required || []) {
      const value = req.body[field];
      if (value === undefined || value === null || value === '') {
        errors.push(`${field} is required`);
      }
    }

    for (const [field, type] of Object.entries(schema.types || {})) {
      const value = req.body[field];
      if (value === undefined || value === null) {
        continue;
      }
      if (type === 'array') {
        if (!Array.isArray(value)) {
          errors.push(`${field} must be an array`);
        }
      } else if (type === 'int') {
        if (!Number.isInteger(value)) {
          errors.push(`${field} must be an integer`);
        }
      } else if (typeof value !== type) {
        errors.push(`${field} must be a ${type}`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    return next();
  };
}

module.exports = { requestSchemaValidator };
