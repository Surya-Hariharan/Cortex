const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const accessSecret = process.env.JWT_ACCESS_SECRET;
const refreshSecret = process.env.JWT_REFRESH_SECRET;
const accessTtl = process.env.JWT_ACCESS_TTL || '15m';
const refreshTtl = process.env.JWT_REFRESH_TTL || '7d';

function signAccessToken(payload) {
  return jwt.sign(payload, accessSecret, { expiresIn: accessTtl });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, refreshSecret, { expiresIn: refreshTtl });
}

function verifyAccessToken(token) {
  return jwt.verify(token, accessSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, refreshSecret);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
