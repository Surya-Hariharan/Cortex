const request = require('supertest');

// Manual factories prevent Jest from evaluating real modules that pull in pool.js
jest.mock('../../../../database/pool', () => ({
    pool: { connect: jest.fn(), query: jest.fn() },
}));

jest.mock('../services/auth.service', () => ({
    signup: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
}));

const { app } = require('../application');
const authService = require('../services/auth.service');

const FAKE_USER = {
    id: 'user-001',
    email: 'student@college.edu',
    full_name: 'Test User',
    gender: 'male',
    district_id: 1,
    college_id: 2,
    student_status: 'student',
    year_of_study: 2,
    graduation_year: null,
    degree_id: 3,
    course_id: 4,
    phone_number: '9876543210',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
};

const SIGNUP_BODY = {
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

// ── POST /auth/signup ──────────────────────────────────────────────────────────

describe('POST /auth/signup', () => {
    beforeEach(() => jest.resetAllMocks());

    it('returns 201 with tokens and user on success', async () => {
        authService.signup.mockResolvedValueOnce({
            accessToken: 'access-tok',
            refreshToken: 'refresh-tok',
            user: FAKE_USER,
        });

        const res = await request(app).post('/auth/signup').send(SIGNUP_BODY);

        expect(res.status).toBe(201);
        expect(res.body.accessToken).toBe('access-tok');
        expect(res.body.refreshToken).toBe('refresh-tok');
        expect(res.body.user.email).toBe('student@college.edu');
        expect(authService.signup).toHaveBeenCalledTimes(1);
    });

    it('returns 400 when schema validation fails (missing required field)', async () => {
        const { email: _e, ...body } = SIGNUP_BODY;
        const res = await request(app).post('/auth/signup').send(body);
        expect(res.status).toBe(400);
        expect(res.body.details).toContain('email is required');
        expect(authService.signup).not.toHaveBeenCalled();
    });

    it('returns 400 when gender enum is invalid', async () => {
        const res = await request(app)
            .post('/auth/signup')
            .send({ ...SIGNUP_BODY, gender: 'cyborg' });
        expect(res.status).toBe(400);
        expect(authService.signup).not.toHaveBeenCalled();
    });

    it('returns 400 when student_status enum is invalid', async () => {
        const res = await request(app)
            .post('/auth/signup')
            .send({ ...SIGNUP_BODY, student_status: 'professor' });
        expect(res.status).toBe(400);
        expect(authService.signup).not.toHaveBeenCalled();
    });

    it('returns 400 when year_of_study is out of range for student', async () => {
        const res = await request(app)
            .post('/auth/signup')
            .send({ ...SIGNUP_BODY, year_of_study: 10 });
        expect(res.status).toBe(400);
        expect(authService.signup).not.toHaveBeenCalled();
    });

    it('returns 400 when password is too weak', async () => {
        const res = await request(app)
            .post('/auth/signup')
            .send({ ...SIGNUP_BODY, password: 'weak' });
        expect(res.status).toBe(400);
        expect(authService.signup).not.toHaveBeenCalled();
    });

    it('returns 400 when authService.signup throws', async () => {
        authService.signup.mockRejectedValueOnce(new Error('Account creation failed. Please check your details.'));
        const res = await request(app).post('/auth/signup').send(SIGNUP_BODY);
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Account creation failed');
    });

    it('does not echo the password back in the response', async () => {
        authService.signup.mockResolvedValueOnce({
            accessToken: 'tok',
            refreshToken: 'rtok',
            user: FAKE_USER,
        });
        const res = await request(app).post('/auth/signup').send(SIGNUP_BODY);
        expect(JSON.stringify(res.body)).not.toContain('StrongP@ss1');
    });
});

// ── POST /auth/login ───────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
    beforeEach(() => jest.resetAllMocks());

    it('returns 200 with tokens and user on success', async () => {
        authService.login.mockResolvedValueOnce({
            accessToken: 'access-tok',
            refreshToken: 'refresh-tok',
            user: FAKE_USER,
        });

        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'student@college.edu', password: 'StrongP@ss1' });

        expect(res.status).toBe(200);
        expect(res.body.accessToken).toBe('access-tok');
        expect(res.body.user.email).toBe('student@college.edu');
    });

    it('returns 400 when email is missing', async () => {
        const res = await request(app).post('/auth/login').send({ password: 'StrongP@ss1' });
        expect(res.status).toBe(400);
        expect(authService.login).not.toHaveBeenCalled();
    });

    it('returns 400 when password is missing', async () => {
        const res = await request(app).post('/auth/login').send({ email: 'a@b.com' });
        expect(res.status).toBe(400);
        expect(authService.login).not.toHaveBeenCalled();
    });

    it('returns 401 on invalid credentials', async () => {
        authService.login.mockRejectedValueOnce(new Error('Invalid credentials'));
        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'student@college.edu', password: 'wrong' });
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid credentials');
    });

    it('does not echo the password back in the response', async () => {
        authService.login.mockRejectedValueOnce(new Error('Invalid credentials'));
        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'student@college.edu', password: 'MyP@ssw0rd!' });
        expect(JSON.stringify(res.body)).not.toContain('MyP@ssw0rd!');
    });
});

// ── POST /auth/refresh ─────────────────────────────────────────────────────────

describe('POST /auth/refresh', () => {
    beforeEach(() => jest.resetAllMocks());

    it('returns 200 with a new accessToken', async () => {
        authService.refresh.mockResolvedValueOnce({ accessToken: 'new-access-tok' });
        const res = await request(app)
            .post('/auth/refresh')
            .send({ refreshToken: 'some-valid-refresh-token' });
        expect(res.status).toBe(200);
        expect(res.body.accessToken).toBe('new-access-tok');
    });

    it('returns 400 when refreshToken field is absent', async () => {
        const res = await request(app).post('/auth/refresh').send({});
        expect(res.status).toBe(400);
        expect(authService.refresh).not.toHaveBeenCalled();
    });

    it('returns 401 when refresh token is invalid or expired', async () => {
        authService.refresh.mockRejectedValueOnce(new Error('Invalid refresh token'));
        const res = await request(app)
            .post('/auth/refresh')
            .send({ refreshToken: 'bad-token' });
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid refresh token');
    });
});

// ── POST /auth/logout ──────────────────────────────────────────────────────────

describe('POST /auth/logout', () => {
    beforeEach(() => jest.resetAllMocks());

    it('returns 401 when no Bearer token is provided', async () => {
        const res = await request(app)
            .post('/auth/logout')
            .send({ refreshToken: 'tok' });
        expect(res.status).toBe(401);
        expect(authService.logout).not.toHaveBeenCalled();
    });

    it('returns 401 when Bearer token is invalid', async () => {
        const res = await request(app)
            .post('/auth/logout')
            .set('Authorization', 'Bearer garbage-token')
            .send({ refreshToken: 'tok' });
        expect(res.status).toBe(401);
        expect(authService.logout).not.toHaveBeenCalled();
    });

    it('returns 200 with { success: true } when logout succeeds', async () => {
        // Sign a real access token so authJwt passes
        const { signAccessToken } = require('../utils/tokens.util');
        const accessToken = signAccessToken({ sub: 'user-001', sid: 'sess-1', did: 'dev-1' });
        authService.logout.mockResolvedValueOnce({ success: true });

        const res = await request(app)
            .post('/auth/logout')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ refreshToken: 'some-refresh-token' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('returns 400 when refreshToken field is absent', async () => {
        const { signAccessToken } = require('../utils/tokens.util');
        const accessToken = signAccessToken({ sub: 'user-001', sid: 'sess-1', did: 'dev-1' });

        const res = await request(app)
            .post('/auth/logout')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({});

        expect(res.status).toBe(400);
        expect(authService.logout).not.toHaveBeenCalled();
    });
});
