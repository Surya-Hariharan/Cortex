const { pool } = require('../db/pool');

async function registerOrUpdateDevice({ userId, fingerprint, ram, cpu, gpu, npu }) {
  const query = `
    INSERT INTO devices (user_id, fingerprint, ram, cpu, gpu, npu, last_seen)
    VALUES ($1, $2, $3, $4, $5, $6, now())
    ON CONFLICT (user_id, fingerprint)
    DO UPDATE SET
      ram = EXCLUDED.ram,
      cpu = EXCLUDED.cpu,
      gpu = EXCLUDED.gpu,
      npu = EXCLUDED.npu,
      last_seen = now()
    RETURNING id, user_id, fingerprint, ram, cpu, gpu, npu, last_seen
  `;

  const result = await pool.query(query, [userId, fingerprint, ram ?? null, cpu ?? null, gpu ?? null, npu ?? null]);
  return result.rows[0];
}

module.exports = { registerOrUpdateDevice };
