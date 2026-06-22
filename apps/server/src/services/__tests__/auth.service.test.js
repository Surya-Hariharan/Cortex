jest.mock('../../../../../database/pool', () => ({
    pool: { connect: jest.fn(), query: jest.fn() },
}));

jest.mock('../device.service', () => ({
    registerOrUpdateDevice: jest.fn(),
}));

jest.mock('../../utils/redis.util', () => ({
    getRedisClient: jest.fn().mockReturnValue(null),
}));

const { pool } = require('../../../../../database/pool');
const { registerOrUpdateDevice } = require('../device.service');
const { getRedisClient } = require('../../utils/redis.util');
const { sha256 } = require('../../utils/crypto.util');
const { signRefreshToken } = require('../../utils/tokens.util');

const authService = require('../auth.service');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_ROW = {
    id: 'user-001',
    email: 'student@college.edu',
    password_hash: '$2b$01$placeholder',
    full_name: 'Test User',
    gender: 'male',
    district_id: 1,
    college_id: 2,
    student_status: 'student',
    year_of_study: 2,
    graduation_year: null,
    degree_id: 3,
    course_id: 4,
    phone_number: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
};

const DEVICE_ROW = { id: 'dev-001', user_id: 'user-001' };

const SESSION_ROW = {
    id: 'sess-001',
    user_id: 'user-001',
    device_id: 'dev-001',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    token_family: 'fam-001',
};

const SIGNUP_PAYLOAD = {
    email: 'student@college.edu',
    password: 'StrongP@ss1',
    full_name: 'Test User',
    gender: 'male',
    district_id: 1,
    college_id: 2,
    student_status: 'student',
    year_of_study: 2,
    degree_id: 3,
    course_id: 4,
    phone_number: '9876543210',
};

// ── Client factory ────────────────────────────────────────────────────────────

function makeClient(...queryResults) {
    let call = 0;
    return {
        query: jest.fn().mockImplementation(() => {
            const result = queryResults[call] ?? { rows: [], rowCount: 0 };
            call += 1;
            return Promise.resolve(result);
        }),
        release: jest.fn(),
    };
}

// ── signup ────────────────────────────────────────────────────────────────────

describe('authService.signup', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        registerOrUpdateDevice.mockResolvedValue(DEVICE_ROW);
    });

    function signupClientMock({ existingUser = false, districtMissing = false } = {}) {
        return makeClient(
            { rows: [] },                                                          // BEGIN
            districtMissing ? { rowCount: 0, rows: [] }                           // district check
                           : { rowCount: 1, rows: [{ id: 1 }] },
            { rowCount: 1, rows: [{ id: 2, district_id: 1 }] },                   // college check
            { rowCount: 1, rows: [{ id: 3 }] },                                   // degree check
            { rowCount: 1, rows: [{ id: 4, degree_id: 3 }] },                     // course check
            existingUser ? { rowCount: 1, rows: [{ id: 'old-user' }] }            // duplicate email
                        : { rowCount: 0, rows: [] },
            { rowCount: 1, rows: [USER_ROW] },                                     // INSERT users
            { rowCount: 1, rows: [SESSION_ROW] },                                  // INSERT sessions
            { rows: [] },                                                           // COMMIT
        );
    }

    it('returns accessToken, refreshToken, and public user on success', async () => {
        const client = signupClientMock();
        pool.connect.mockResolvedValueOnce(client);

        const result = await authService.signup(SIGNUP_PAYLOAD);

        expect(result.accessToken).toBeTruthy();
        expect(result.refreshToken).toBeTruthy();
        expect(result.user.email).toBe('student@college.edu');
        expect(result.user.password_hash).toBeUndefined();
        expect(client.query).toHaveBeenCalledWith('COMMIT');
        expect(client.release).toHaveBeenCalled();
    });

    it('does not expose password_hash in returned user', async () => {
        pool.connect.mockResolvedValueOnce(signupClientMock());
        const { user } = await authService.signup(SIGNUP_PAYLOAD);
        expect(user).not.toHaveProperty('password_hash');
    });

    it('throws and rolls back when email already registered', async () => {
        pool.connect.mockResolvedValueOnce(signupClientMock({ existingUser: true }));
        await expect(authService.signup(SIGNUP_PAYLOAD)).rejects.toThrow('Account creation failed');
        // rollback should have been called
    });

    it('throws when district_id is invalid', async () => {
        pool.connect.mockResolvedValueOnce(signupClientMock({ districtMissing: true }));
        await expect(authService.signup(SIGNUP_PAYLOAD)).rejects.toThrow('Invalid district_id');
    });

    it('normalizes email to lowercase', async () => {
        const client = signupClientMock();
        pool.connect.mockResolvedValueOnce(client);
        await authService.signup({ ...SIGNUP_PAYLOAD, email: '  Student@College.EDU  ' });
        const emailCheck = client.query.mock.calls.find(
            (c) => typeof c[0] === 'string' && c[0].includes('SELECT id FROM users WHERE email')
        );
        expect(emailCheck[1][0]).toBe('student@college.edu');
    });
});

// ── login ─────────────────────────────────────────────────────────────────────

describe('authService.login', () => {
    const bcrypt = require('bcrypt');

    beforeEach(() => {
        jest.clearAllMocks();
        registerOrUpdateDevice.mockResolvedValue(DEVICE_ROW);
    });

    async function loginClientMock({ userExists = true, passwordMatch = true } = {}) {
        const hash = await bcrypt.hash('StrongP@ss1', 1);
        return makeClient(
            { rows: [] },                                                          // BEGIN
            userExists
                ? { rowCount: 1, rows: [{ ...USER_ROW, password_hash: passwordMatch ? hash : '$2b$01$wrong' }] }
                : { rowCount: 0, rows: [] },                                       // SELECT users
            { rowCount: 1, rows: [SESSION_ROW] },                                  // INSERT sessions
            { rows: [] },                                                           // COMMIT
        );
    }

    it('returns tokens and user on valid credentials', async () => {
        pool.connect.mockResolvedValueOnce(await loginClientMock());
        const result = await authService.login({ email: 'student@college.edu', password: 'StrongP@ss1' });
        expect(result.accessToken).toBeTruthy();
        expect(result.refreshToken).toBeTruthy();
        expect(result.user.email).toBe('student@college.edu');
    });

    it('throws when user does not exist', async () => {
        pool.connect.mockResolvedValueOnce(await loginClientMock({ userExists: false }));
        await expect(authService.login({ email: 'nobody@x.com', password: 'any' }))
            .rejects.toThrow('Invalid credentials');
    });

    it('throws when password does not match', async () => {
        const hash = await bcrypt.hash('CorrectPassword', 1);
        pool.connect.mockResolvedValueOnce(
            makeClient({ rows: [] }, { rowCount: 1, rows: [{ ...USER_ROW, password_hash: hash }] })
        );
        await expect(authService.login({ email: 'student@college.edu', password: 'WrongPassword' }))
            .rejects.toThrow('Invalid credentials');
    });

    it('does not expose password_hash in returned user', async () => {
        pool.connect.mockResolvedValueOnce(await loginClientMock());
        const { user } = await authService.login({ email: 'student@college.edu', password: 'StrongP@ss1' });
        expect(user).not.toHaveProperty('password_hash');
    });

    it('fails open when redis is unavailable', async () => {
        getRedisClient.mockReturnValueOnce(null);
        pool.connect.mockResolvedValueOnce(await loginClientMock());
        const result = await authService.login({ email: 'student@college.edu', password: 'StrongP@ss1' });
        expect(result.accessToken).toBeTruthy();
    });

    it('throws rate-limit error when redis count reaches limit', async () => {
        const redisMock = { get: jest.fn().mockResolvedValue('5'), incr: jest.fn(), expire: jest.fn(), del: jest.fn() };
        getRedisClient.mockReturnValue(redisMock);
        await expect(authService.login({ email: 'locked@x.com', password: 'any' }))
            .rejects.toThrow('Too many failed login attempts');
        getRedisClient.mockReturnValue(null);
    });
});

// ── refresh — rotation + reuse detection ─────────────────────────────────────

describe('authService.refresh — token rotation', () => {
    beforeEach(() => jest.clearAllMocks());

    function makeRefreshToken(raw, overrides = {}) {
        return signRefreshToken({
            sub: 'user-001', sid: 'sess-001', did: 'dev-001',
            rtk: raw, fam: 'family-abc',
            ...overrides,
        });
    }

    function makeRotationClient(newSessId = 'sess-002') {
        return makeClient(
            { rows: [] },                                                          // BEGIN
            { rowCount: 1 },                                                       // DELETE old session
            { rowCount: 1, rows: [{ id: newSessId }] },                            // INSERT new session
            { rows: [] },                                                           // COMMIT
        );
    }

    it('returns both a new accessToken and a new refreshToken after rotation', async () => {
        const raw = 'valid-raw-refresh-token';
        const refreshToken = makeRefreshToken(raw);

        // pool.query: session lookup found
        pool.query.mockResolvedValueOnce({
            rowCount: 1,
            rows: [{
                id: 'sess-001', user_id: 'user-001', device_id: 'dev-001',
                expires_at: new Date(Date.now() + 60_000).toISOString(),
                token_family: 'family-abc',
            }],
        });
        // pool.connect: rotation transaction
        pool.connect.mockResolvedValueOnce(makeRotationClient());

        const result = await authService.refresh(refreshToken);

        expect(result.accessToken).toBeTruthy();
        expect(result.refreshToken).toBeTruthy();
        // Must be a different token from the one we passed in
        expect(result.refreshToken).not.toBe(refreshToken);
    });

    it('new refresh token is verifiable and carries updated sid', async () => {
        const raw = 'raw-for-verification';
        const refreshToken = makeRefreshToken(raw);

        pool.query.mockResolvedValueOnce({
            rowCount: 1,
            rows: [{
                id: 'sess-001', user_id: 'user-001', device_id: 'dev-001',
                expires_at: new Date(Date.now() + 60_000).toISOString(),
                token_family: 'family-abc',
            }],
        });
        pool.connect.mockResolvedValueOnce(makeRotationClient('sess-new'));

        const result = await authService.refresh(refreshToken);
        const { verifyRefreshToken } = require('../../utils/tokens.util');
        const decoded = verifyRefreshToken(result.refreshToken);
        expect(decoded.sub).toBe('user-001');
        expect(decoded.sid).toBe('sess-new');
        expect(decoded.fam).toBe('family-abc');
        expect(decoded.rtk).toBeTruthy();
        // The raw token in the new JWT must differ from the original
        expect(decoded.rtk).not.toBe(raw);
    });

    it('stores consumed token hash as previous_token_hash for reuse detection', async () => {
        const raw = 'raw-for-reuse-tracking';
        const refreshToken = makeRefreshToken(raw);
        const expectedPrevHash = sha256(raw);

        pool.query.mockResolvedValueOnce({
            rowCount: 1,
            rows: [{
                id: 'sess-001', user_id: 'user-001', device_id: 'dev-001',
                expires_at: new Date(Date.now() + 60_000).toISOString(),
                token_family: 'family-abc',
            }],
        });
        const rotationClient = makeRotationClient();
        pool.connect.mockResolvedValueOnce(rotationClient);

        await authService.refresh(refreshToken);

        const insertCall = rotationClient.query.mock.calls.find(
            (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO sessions')
        );
        expect(insertCall).toBeTruthy();
        // previous_token_hash is the 4th parameter in the INSERT
        expect(insertCall[1][3]).toBe(expectedPrevHash);
    });

    it('throws Invalid refresh token when session is not found', async () => {
        const refreshToken = makeRefreshToken('gone-token');
        pool.query
            .mockResolvedValueOnce({ rowCount: 0, rows: [] })   // session lookup
            .mockResolvedValueOnce({ rowCount: 0, rows: [] });  // reuse check

        await expect(authService.refresh(refreshToken)).rejects.toThrow('Invalid refresh token');
    });

    it('throws Refresh token expired when session is past expiry', async () => {
        const refreshToken = makeRefreshToken('expired-raw');
        pool.query
            .mockResolvedValueOnce({
                rowCount: 1,
                rows: [{
                    id: 'sess-001', user_id: 'user-001', device_id: 'dev-001',
                    expires_at: new Date(Date.now() - 1000).toISOString(),
                    token_family: 'family-abc',
                }],
            })
            .mockResolvedValueOnce({ rowCount: 1 }); // DELETE expired

        await expect(authService.refresh(refreshToken)).rejects.toThrow('Refresh token expired');
    });

    it('revokes entire family when a rotated-out token is replayed (reuse attack)', async () => {
        const staleRaw = 'already-rotated-out-token';
        const staleHash = sha256(staleRaw);
        const refreshToken = makeRefreshToken(staleRaw, { fam: 'family-abc' });

        // Current-token lookup: not found
        pool.query
            .mockResolvedValueOnce({ rowCount: 0, rows: [] })
            // Reuse check: found — this hash is stored as previous_token_hash
            .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'sess-002' }] })
            // Family revocation DELETE
            .mockResolvedValueOnce({ rowCount: 1 });

        await expect(authService.refresh(refreshToken)).rejects.toThrow('Invalid refresh token');

        const calls = pool.query.mock.calls;
        const revokeCall = calls.find(
            (c) => typeof c[0] === 'string' && c[0].includes('DELETE FROM sessions WHERE token_family')
        );
        expect(revokeCall).toBeTruthy();
        expect(revokeCall[1][0]).toBe('family-abc');
    });

    it('does not revoke family when token is simply invalid (no previous_token_hash match)', async () => {
        const refreshToken = makeRefreshToken('totally-unknown', { fam: 'family-xyz' });

        pool.query
            .mockResolvedValueOnce({ rowCount: 0, rows: [] })   // session lookup
            .mockResolvedValueOnce({ rowCount: 0, rows: [] });  // reuse check — no match

        await expect(authService.refresh(refreshToken)).rejects.toThrow('Invalid refresh token');

        const deleteCall = pool.query.mock.calls.find(
            (c) => typeof c[0] === 'string' && c[0].includes('DELETE FROM sessions WHERE token_family')
        );
        expect(deleteCall).toBeUndefined();
    });

    it('throws on a completely invalid JWT string', async () => {
        await expect(authService.refresh('not-a-jwt')).rejects.toThrow();
    });
});

// ── logout ────────────────────────────────────────────────────────────────────

describe('authService.logout', () => {
    beforeEach(() => jest.clearAllMocks());

    it('deletes the session and returns { success: true }', async () => {
        const raw = 'logout-raw-token';
        const refreshToken = signRefreshToken({ sub: 'user-001', sid: 'sess-001', did: 'dev-001', rtk: raw });
        pool.query.mockResolvedValueOnce({ rowCount: 1 });

        const result = await authService.logout({ userId: 'user-001', refreshToken });
        expect(result.success).toBe(true);
        const [sql] = pool.query.mock.calls[0];
        expect(sql).toMatch(/DELETE FROM sessions/);
    });

    it('throws when token subject does not match userId', async () => {
        const refreshToken = signRefreshToken({ sub: 'user-other', sid: 'sess-001', did: 'dev-001', rtk: 'raw' });
        await expect(authService.logout({ userId: 'user-001', refreshToken }))
            .rejects.toThrow('Token subject mismatch');
    });

    it('throws on invalid refresh token', async () => {
        await expect(authService.logout({ userId: 'u1', refreshToken: 'garbage' })).rejects.toThrow();
    });
});

// ── _parseTtlToMs ─────────────────────────────────────────────────────────────

describe('authService._parseTtlToMs', () => {
    it('parses seconds', () => expect(authService._parseTtlToMs('30s')).toBe(30_000));
    it('parses minutes', () => expect(authService._parseTtlToMs('15m')).toBe(900_000));
    it('parses hours', () => expect(authService._parseTtlToMs('1h')).toBe(3_600_000));
    it('parses days', () => expect(authService._parseTtlToMs('7d')).toBe(604_800_000));
    it('throws on invalid format', () => expect(() => authService._parseTtlToMs('invalid')).toThrow());
});
