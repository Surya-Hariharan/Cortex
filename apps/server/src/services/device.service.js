const { pool } = require('../../../../database/pool');

async function registerOrUpdateDevice({ userId, fingerprint, ram, cpu, gpu, npu, trusted = false }, db = pool) {
  const result = await db.query(
    `INSERT INTO devices (user_id, fingerprint, ram, cpu, gpu, npu, last_seen, trusted)
     VALUES ($1, $2, $3, $4, $5, $6, now(), $7)
     ON CONFLICT (user_id, fingerprint)
     DO UPDATE SET
       ram       = EXCLUDED.ram,
       cpu       = EXCLUDED.cpu,
       gpu       = EXCLUDED.gpu,
       npu       = EXCLUDED.npu,
       last_seen = now(),
       trusted   = COALESCE(devices.trusted, EXCLUDED.trusted)
     RETURNING *`,
    [userId, fingerprint, ram ?? null, cpu ?? null, gpu ?? null, npu ?? null, Boolean(trusted)]
  );
  return result.rows[0];
}

function isDeviceRevoked(deviceRow) {
  if (!deviceRow) return false;
  if (deviceRow.revoked === true) return true;
  return Boolean(deviceRow.revoked_at);
}

function isDeviceTrusted(deviceRow) {
  if (!deviceRow) return false;
  return deviceRow.trusted === true;
}

module.exports = {
  registerOrUpdateDevice,
  isDeviceRevoked,
  isDeviceTrusted,
};
