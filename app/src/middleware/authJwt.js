const { verifyAccessToken } = require('../utils/tokens');

function authJwt(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing Bearer token' });
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

module.exports = { authJwt };
