const { pool } = require('../../../supabase/db/pool');

async function tableHasColumn(db, tableName, columnName) {
  const result = await db.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [tableName, columnName]
  );
  return result.rowCount > 0;
}

async function resolveDeviceTableName(db) {
  const result = await db.query(
    `SELECT COALESCE(to_regclass('public.device')::text, to_regclass('public.devices')::text) AS table_name`
  );
  const tableName = result.rows[0]?.table_name || 'public.devices';
  return tableName.split('.').pop();
}

async function registerOrUpdateDevice({ userId, fingerprint, ram, cpu, gpu, npu, trusted = false }, db = pool) {
  const deviceTable = await resolveDeviceTableName(db);
  const hasDeviceFingerprint = await tableHasColumn(db, deviceTable, 'device_fingerprint');
  const hasLastSeenAt = await tableHasColumn(db, deviceTable, 'last_seen_at');
  const hasLastSeen = await tableHasColumn(db, deviceTable, 'last_seen');
  const hasTrusted = await tableHasColumn(db, deviceTable, 'trusted');

  const fingerprintColumn = hasDeviceFingerprint ? 'device_fingerprint' : 'fingerprint';
  const lastSeenColumn = hasLastSeenAt ? 'last_seen_at' : hasLastSeen ? 'last_seen' : null;

  const setParts = ['ram = EXCLUDED.ram', 'cpu = EXCLUDED.cpu', 'gpu = EXCLUDED.gpu', 'npu = EXCLUDED.npu'];
  const insertColumns = ['user_id', fingerprintColumn, 'ram', 'cpu', 'gpu', 'npu'];
  const insertValues = ['$1', '$2', '$3', '$4', '$5', '$6'];

  if (lastSeenColumn) {
    insertColumns.push(lastSeenColumn);
    insertValues.push('now()');
    setParts.push(`${lastSeenColumn} = now()`);
  }

  if (hasTrusted) {
    insertColumns.push('trusted');
    insertValues.push('$7');
    setParts.push(`trusted = COALESCE(${deviceTable}.trusted, EXCLUDED.trusted)`);
  }

  const values = [userId, fingerprint, ram ?? null, cpu ?? null, gpu ?? null, npu ?? null];
  if (hasTrusted) {
    values.push(Boolean(trusted));
  }

  const query = `
    INSERT INTO ${deviceTable} (${insertColumns.join(', ')})
    VALUES (${insertValues.join(', ')})
    ON CONFLICT (user_id, ${fingerprintColumn})
    DO UPDATE SET ${setParts.join(', ')}
    RETURNING *
  `;

  const result = await db.query(query, values);
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
