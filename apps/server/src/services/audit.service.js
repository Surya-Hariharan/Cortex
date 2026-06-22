const { pool } = require('../../../../database/pool');

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

  await db.query(
    `INSERT INTO audit_logs (user_id, device_id, event_type, event_data, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, deviceId, eventType, eventData, ipAddress, userAgent]
  );
}

module.exports = {
  writeAuditEvent,
};
