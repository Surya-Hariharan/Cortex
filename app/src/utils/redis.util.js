const Redis = require('ioredis');

let client = null;

function getRedisClient() {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  client = new Redis(url, { lazyConnect: true, enableOfflineQueue: false });
  client.on('error', (err) => {
    console.error('[Redis] connection error:', err.message);
  });
  return client;
}

module.exports = { getRedisClient };
