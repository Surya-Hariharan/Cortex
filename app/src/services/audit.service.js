const { pool } = require('../../../supabase/db/pool');

async function writeAuditEvent({
  userId = null,
  deviceId = null,
  eventType,
  eventData = {},
  ipAddress = null,
  userAgent = null,
  db = pool,
}) {
  if (!eventType) return;

  const payload = [userId, deviceId, eventType, eventData, ipAddress, userAgent];

  const tableAttempts = [
    `INSERT INTO audit_log (user_id, device_id, event_type, event_data, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    `INSERT INTO audit_logs (user_id, device_id, event_type, event_data, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
  ];

  for (const sql of tableAttempts) {
    try {
      await db.query(sql, payload);
      return;
    } catch {
      // Try next known audit table shape.
    }
  }
}

module.exports = {
  writeAuditEvent,
};
