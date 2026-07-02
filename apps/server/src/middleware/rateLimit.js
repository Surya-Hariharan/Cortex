const rateLimit = require('express-rate-limit');

// General API limiter — generous, just a backstop.
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
});

// Tighter limiter for auth endpoints (login/register/password reset) to
// slow down credential stuffing and enumeration attacks.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'rate_limited', detail: 'Too many attempts. Try again later.' },
});

module.exports = { apiLimiter, authLimiter };
