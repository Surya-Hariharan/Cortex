const rateLimit = require('express-rate-limit');
const { getRedisClient } = require('../utils/redis.util');

function buildStore() {
  const redis = getRedisClient();
  if (!redis) return undefined;
  const { RedisStore } = require('rate-limit-redis');
  return new RedisStore({ sendCommand: (...args) => redis.call(...args) });
}

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore(),
});

module.exports = {
  authRateLimiter,
};
