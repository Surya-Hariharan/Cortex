const { pool } = require('../../../supabase/db/pool');

async function registerOrUpdateDevice({ userId, fingerprint, ram, cpu, gpu, npu }, db = pool) {
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

  const result = await db.query(query, [userId, fingerprint, ram ?? null, cpu ?? null, gpu ?? null, npu ?? null]);
  return result.rows[0];
}

module.exports = { registerOrUpdateDevice };
