const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../../../database/pool');
const { registerOrUpdateDevice } = require('./device.service');
const { signAccessToken, signRefreshToken } = require('../utils/tokens.util');
const { randomToken, sha256 } = require('../utils/crypto.util');
const { getRedisClient } = require('../utils/redis.util');

// ── Per-email login rate limiting ─────────────────────────────────────────────
const LOGIN_ATTEMPT_MAX = 5;
const LOGIN_ATTEMPT_WINDOW_S = 15 * 60;

async function checkLoginRateLimit(email) {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    const count = Number((await redis.get(`login_attempts:${email}`)) || 0);
    if (count >= LOGIN_ATTEMPT_MAX) {
      throw new Error('Too many failed login attempts. Try again in 15 minutes.');
    }
  } catch (err) {
    if (err.message.includes('Too many failed')) throw err;
    // Redis unavailable — fail open
  }
}

async function recordLoginFailure(email) {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    const key = `login_attempts:${email}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, LOGIN_ATTEMPT_WINDOW_S);
  } catch { /* fail open */ }
}

async function resetLoginAttempts(email) {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.del(`login_attempts:${email}`);
  } catch { /* fail open */ }
}

// ── TTL parser ────────────────────────────────────────────────────────────────
function parseTtlToMs(ttl) {
  const match = /^(\d+)([smhd])$/.exec(String(ttl));
  if (!match) throw new Error(`Invalid TTL format: ${ttl}`);
  const n = Number(match[1]);
  const units = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * units[match[2]];
}

// ── Payload normalisation ─────────────────────────────────────────────────────
function normalizeSignupPayload(input) {
  return {
    email: String(input.email || '').trim().toLowerCase(),
    full_name: String(input.full_name || '').trim(),
    gender: String(input.gender || '').trim().toLowerCase(),
    district_id: Number(input.district_id),
    college_id: Number(input.college_id),
    student_status: String(input.student_status || '').trim().toLowerCase(),
    year_of_study: input.year_of_study == null || input.year_of_study === '' ? null : Number(input.year_of_study),
    graduation_year: input.graduation_year == null || input.graduation_year === '' ? null : Number(input.graduation_year),
    degree_id: Number(input.degree_id),
    course_id: Number(input.course_id),
    phone_number: input.phone_number ? String(input.phone_number).trim() : null,
    password: String(input.password || ''),
    device: input.device || null,
  };
}

async function assertAcademicIntegrity(client, payload) {
  const district = await client.query('SELECT id FROM districts WHERE id = $1', [payload.district_id]);
  if (district.rowCount === 0) throw new Error('Invalid district_id');

  const college = await client.query('SELECT id, district_id FROM colleges WHERE id = $1', [payload.college_id]);
  if (college.rowCount === 0) throw new Error('Invalid college_id');
  if (college.rows[0].district_id !== payload.district_id) {
    throw new Error('college_id does not belong to district_id');
  }

  const degree = await client.query('SELECT id FROM degrees WHERE id = $1', [payload.degree_id]);
  if (degree.rowCount === 0) throw new Error('Invalid degree_id');

  const course = await client.query('SELECT id, degree_id FROM courses WHERE id = $1', [payload.course_id]);
  if (course.rowCount === 0) throw new Error('Invalid course_id');
  if (course.rows[0].degree_id !== payload.degree_id) {
    throw new Error('course_id does not belong to degree_id');
  }

  if (payload.student_status === 'student' && payload.year_of_study == null) {
    throw new Error('year_of_study is required for student status');
  }
  if (payload.student_status === 'alumni' && payload.graduation_year == null) {
    throw new Error('graduation_year is required for alumni status');
  }
}

function buildPublicUser(row) {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    gender: row.gender,
    district_id: row.district_id,
    college_id: row.college_id,
    student_status: row.student_status,
    year_of_study: row.year_of_study,
    graduation_year: row.graduation_year,
    degree_id: row.degree_id,
    course_id: row.course_id,
    phone_number: row.phone_number || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ── Session creation ──────────────────────────────────────────────────────────
// familyId: pass the existing family UUID when rotating; omit for a fresh login.
async function createSession(client, { userId, deviceId, familyId }) {
  const refreshRaw = randomToken(64);
  const refreshHash = sha256(refreshRaw);
  const family = familyId || uuidv4();

  const refreshTtl = process.env.JWT_REFRESH_TTL || '7d';
  const expiresAt = new Date(Date.now() + parseTtlToMs(refreshTtl));

  const inserted = await client.query(
    `INSERT INTO sessions (user_id, device_id, refresh_token, expires_at, token_family)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, device_id, expires_at, created_at, token_family`,
    [userId, deviceId, refreshHash, expiresAt, family]
  );

  const session = inserted.rows[0];
  const accessToken = signAccessToken({ sub: userId, sid: session.id, did: deviceId });
  const refreshToken = signRefreshToken({
    sub: userId,
    sid: session.id,
    did: deviceId,
    rtk: refreshRaw,
    fam: family,
  });

  return { session, accessToken, refreshToken };
}

// ── Public service functions ──────────────────────────────────────────────────
async function signup(payload) {
  const normalized = normalizeSignupPayload(payload);
  const rounds = Number(process.env.BCRYPT_ROUNDS || 12);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await assertAcademicIntegrity(client, normalized);

    const existing = await client.query('SELECT id FROM users WHERE email = $1', [normalized.email]);
    if (existing.rowCount > 0) throw new Error('Account creation failed. Please check your details.');

    const passwordHash = await bcrypt.hash(normalized.password, rounds);
    const inserted = await client.query(
      `INSERT INTO users (
        email, password_hash, full_name, gender, district_id, college_id,
        student_status, year_of_study, graduation_year, degree_id, course_id,
        phone_number
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *`,
      [
        normalized.email, passwordHash, normalized.full_name, normalized.gender,
        normalized.district_id, normalized.college_id, normalized.student_status,
        normalized.year_of_study, normalized.graduation_year, normalized.degree_id,
        normalized.course_id, normalized.phone_number,
      ]
    );

    const user = inserted.rows[0];
    const device = await registerOrUpdateDevice(
      {
        userId: user.id,
        fingerprint: normalized.device?.fingerprint || 'unknown-device',
        ram: normalized.device?.ram, cpu: normalized.device?.cpu,
        gpu: normalized.device?.gpu, npu: normalized.device?.npu,
      },
      client
    );

    const { accessToken, refreshToken } = await createSession(client, {
      userId: user.id, deviceId: device.id, familyId: null,
    });

    await client.query('COMMIT');
    return { accessToken, refreshToken, user: buildPublicUser(user) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function login({ email, password, device }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  await checkLoginRateLimit(normalizedEmail);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    if (result.rowCount === 0) throw new Error('Invalid credentials');

    const user = result.rows[0];
    const valid = await bcrypt.compare(String(password || ''), user.password_hash);
    if (!valid) throw new Error('Invalid credentials');

    const deviceRow = await registerOrUpdateDevice(
      {
        userId: user.id,
        fingerprint: device?.fingerprint || 'unknown-device',
        ram: device?.ram, cpu: device?.cpu, gpu: device?.gpu, npu: device?.npu,
      },
      client
    );

    const { accessToken, refreshToken } = await createSession(client, {
      userId: user.id, deviceId: deviceRow.id, familyId: null,
    });

    await client.query('COMMIT');
    await resetLoginAttempts(normalizedEmail);
    return { accessToken, refreshToken, user: buildPublicUser(user) };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.message === 'Invalid credentials') await recordLoginFailure(normalizedEmail);
    throw error;
  } finally {
    client.release();
  }
}

// ── Refresh with rotation + reuse detection ───────────────────────────────────
// Protocol (IETF oauth-security-topics §4.14):
//   FOUND  → rotate atomically: delete old row, insert new row in same family.
//   NOT FOUND → check previous_token_hash; if matches → theft → revoke family.
async function refresh(refreshToken) {
  const { verifyRefreshToken } = require('../utils/tokens.util');
  const decoded = verifyRefreshToken(refreshToken);
  const { rtk: refreshRaw, fam: family, sid, sub: userId } = decoded;

  if (!refreshRaw) throw new Error('Invalid refresh token');

  const refreshHash = sha256(refreshRaw);

  // Fetch current session by ID + user + token hash
  const sessionResult = await pool.query(
    `SELECT id, user_id, device_id, expires_at, token_family
     FROM sessions
     WHERE id = $1 AND user_id = $2 AND refresh_token = $3`,
    [sid, userId, refreshHash]
  );

  if (sessionResult.rowCount === 0) {
    // Reuse detection: was this the most-recently-rotated-out token for this family?
    if (family) {
      const reuseCheck = await pool.query(
        `SELECT id FROM sessions
         WHERE token_family = $1 AND previous_token_hash = $2
         LIMIT 1`,
        [family, refreshHash]
      );
      if (reuseCheck.rowCount > 0) {
        // Stolen token reused — invalidate entire family immediately
        await pool.query('DELETE FROM sessions WHERE token_family = $1', [family]);
      }
    }
    throw new Error('Invalid refresh token');
  }

  const session = sessionResult.rows[0];
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await pool.query('DELETE FROM sessions WHERE id = $1', [session.id]);
    throw new Error('Refresh token expired');
  }

  // Atomic rotation: delete old session, insert new one in the same family
  const refreshRawNew = randomToken(64);
  const refreshHashNew = sha256(refreshRawNew);
  const refreshTtl = process.env.JWT_REFRESH_TTL || '7d';
  const expiresAt = new Date(Date.now() + parseTtlToMs(refreshTtl));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM sessions WHERE id = $1', [session.id]);

    const newRow = await client.query(
      `INSERT INTO sessions
         (user_id, device_id, refresh_token, previous_token_hash, expires_at, token_family)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [session.user_id, session.device_id, refreshHashNew, refreshHash, expiresAt, session.token_family]
    );

    await client.query('COMMIT');

    const newSid = newRow.rows[0].id;
    const accessToken = signAccessToken({
      sub: session.user_id, sid: newSid, did: session.device_id,
    });
    const newRefreshToken = signRefreshToken({
      sub: session.user_id, sid: newSid, did: session.device_id,
      rtk: refreshRawNew, fam: session.token_family,
    });

    return { accessToken, refreshToken: newRefreshToken };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function logout({ userId, refreshToken }) {
  const { verifyRefreshToken } = require('../utils/tokens.util');
  const decoded = verifyRefreshToken(refreshToken);
  if (decoded.sub !== userId) throw new Error('Token subject mismatch');

  const refreshHash = sha256(decoded.rtk);
  await pool.query(
    'DELETE FROM sessions WHERE id = $1 AND user_id = $2 AND refresh_token = $3',
    [decoded.sid, userId, refreshHash]
  );

  return { success: true };
}

module.exports = {
  signup,
  login,
  refresh,
  logout,
  _parseTtlToMs: parseTtlToMs,
  _createSession: createSession,
};
