const Redis = require('ioredis');
const { logger } = require('./logger');

let client = null;

function getRedisClient() {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  client = new Redis(url, { lazyConnect: true, enableOfflineQueue: false });
  client.on('error', (err) => {
    logger.error({ err }, '[Redis] connection error');
  });
  return client;
}

module.exports = { getRedisClient };
