const bcrypt = require('bcrypt');
const { pool } = require('../../../supabase/db/pool');
const { registerOrUpdateDevice } = require('./device.service');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/tokens.util');
const { randomToken, sha256 } = require('../utils/crypto.util');

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
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function createSession(client, { userId, deviceId }) {
  const refreshRaw = randomToken(64);
  const refreshHash = sha256(refreshRaw);

  const refreshJwt = signRefreshToken({
    sub: userId,
    sid: null,
    did: deviceId,
    rtk: refreshRaw,
  });

  const decodedRefresh = verifyRefreshToken(refreshJwt);
  const expiresAt = new Date(decodedRefresh.exp * 1000);

  const inserted = await client.query(
    `INSERT INTO sessions (user_id, device_id, refresh_token, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, device_id, expires_at, created_at`,
    [userId, deviceId, refreshHash, expiresAt]
  );

  const session = inserted.rows[0];
  const accessToken = signAccessToken({ sub: userId, sid: session.id, did: deviceId });

  const refreshToken = signRefreshToken({
    sub: userId,
    sid: session.id,
    did: deviceId,
    rtk: refreshRaw,
  });

  return { session, accessToken, refreshToken };
}

async function signup(payload) {
  const normalized = normalizeSignupPayload(payload);
  const rounds = Number(process.env.BCRYPT_ROUNDS || 12);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await assertAcademicIntegrity(client, normalized);

    const existing = await client.query('SELECT id FROM users WHERE email = $1', [normalized.email]);
    if (existing.rowCount > 0) {
      throw new Error('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(normalized.password, rounds);
    const inserted = await client.query(
      `INSERT INTO users (
        email, password_hash, full_name, gender, district_id, college_id,
        student_status, year_of_study, graduation_year, degree_id, course_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *`,
      [
        normalized.email,
        passwordHash,
        normalized.full_name,
        normalized.gender,
        normalized.district_id,
        normalized.college_id,
        normalized.student_status,
        normalized.year_of_study,
        normalized.graduation_year,
        normalized.degree_id,
        normalized.course_id,
      ]
    );

    const user = inserted.rows[0];
    const device = await registerOrUpdateDevice(
      {
        userId: user.id,
        fingerprint: normalized.device?.fingerprint || 'unknown-device',
        ram: normalized.device?.ram,
        cpu: normalized.device?.cpu,
        gpu: normalized.device?.gpu,
        npu: normalized.device?.npu,
      },
      client
    );

    const { accessToken, refreshToken } = await createSession(client, {
      userId: user.id,
      deviceId: device.id,
    });

    await client.query('COMMIT');

    return {
      accessToken,
      refreshToken,
      user: buildPublicUser(user),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function login({ email, password, device }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    if (result.rowCount === 0) {
      throw new Error('Invalid credentials');
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(String(password || ''), user.password_hash);
    if (!valid) {
      throw new Error('Invalid credentials');
    }

    const deviceRow = await registerOrUpdateDevice(
      {
        userId: user.id,
        fingerprint: device?.fingerprint || 'unknown-device',
        ram: device?.ram,
        cpu: device?.cpu,
        gpu: device?.gpu,
        npu: device?.npu,
      },
      client
    );

    const { accessToken, refreshToken } = await createSession(client, {
      userId: user.id,
      deviceId: deviceRow.id,
    });

    await client.query('COMMIT');

    return {
      accessToken,
      refreshToken,
      user: buildPublicUser(user),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function refresh(refreshToken) {
  const decoded = verifyRefreshToken(refreshToken);
  const refreshRaw = decoded.rtk;
  const refreshHash = sha256(refreshRaw);

  const sessionResult = await pool.query(
    `SELECT s.id, s.user_id, s.device_id, s.expires_at
     FROM sessions s
     WHERE s.id = $1 AND s.user_id = $2 AND s.refresh_token = $3`,
    [decoded.sid, decoded.sub, refreshHash]
  );

  if (sessionResult.rowCount === 0) {
    throw new Error('Invalid refresh token');
  }

  const session = sessionResult.rows[0];
  if (new Date(session.expires_at).getTime() < Date.now()) {
    throw new Error('Refresh token expired');
  }

  const accessToken = signAccessToken({ sub: session.user_id, sid: session.id, did: session.device_id });
  return { accessToken };
}

async function logout({ userId, refreshToken }) {
  const decoded = verifyRefreshToken(refreshToken);
  if (decoded.sub !== userId) {
    throw new Error('Token subject mismatch');
  }

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
};
