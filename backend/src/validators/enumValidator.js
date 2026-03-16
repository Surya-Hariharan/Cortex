function enumValidator(field, allowedValues) {
  const normalizedAllowed = new Set(allowedValues);

  return function validateEnum(req, res, next) {
    const value = req.body[field];
    if (value == null) {
      return next();
    }
    if (!normalizedAllowed.has(value)) {
      return res.status(400).json({
        error: `${field} must be one of: ${allowedValues.join(', ')}`,
      });
    }
    return next();
  };
}

module.exports = { enumValidator };
