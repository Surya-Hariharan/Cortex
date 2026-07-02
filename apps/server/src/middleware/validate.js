// Validates req[part] against a zod schema, replacing it with the parsed
// (and defaulted/coerced) value. Rejects with 400 on failure.
function validate(schema, part = 'body') {
    return (req, res, next) => {
        const result = schema.safeParse(req[part]);
        if (!result.success) {
            return res.status(400).json({
                error: 'validation_error',
                detail: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
            });
        }
        req[part] = result.data;
        next();
    };
}

module.exports = { validate };
