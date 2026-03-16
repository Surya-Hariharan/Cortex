const crypto = require('crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function randomToken(size = 48) {
  return crypto.randomBytes(size).toString('hex');
}

module.exports = { sha256, randomToken };
