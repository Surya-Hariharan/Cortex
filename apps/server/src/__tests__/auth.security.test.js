const request = require('supertest');

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

// ── Helmet security headers ────────────────────────────────────────────────────

describe('Helmet security headers', () => {
    it('sets X-Content-Type-Options: nosniff', async () => {
        const res = await request(app).get('/health');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('sets X-Frame-Options', async () => {
        const res = await request(app).get('/health');
        expect(res.headers['x-frame-options']).toBeDefined();
    });

    it('sets X-DNS-Prefetch-Control', async () => {
        const res = await request(app).get('/health');
        expect(res.headers['x-dns-prefetch-control']).toBeDefined();
    });

    it('does not expose X-Powered-By header', async () => {
        const res = await request(app).get('/health');
        expect(res.headers['x-powered-by']).toBeUndefined();
    });
});

// ── Auth-required route (logout) rejects missing auth ─────────────────────────

describe('Missing auth guard', () => {
    it('POST /auth/logout returns 401 with no Authorization header', async () => {
        const res = await request(app)
            .post('/auth/logout')
            .send({ refreshToken: 'tok' });
        expect(res.status).toBe(401);
    });

    it('POST /auth/logout returns 401 with malformed Bearer token', async () => {
        const res = await request(app)
            .post('/auth/logout')
            .set('Authorization', 'Bearer invalid.token.here')
            .send({ refreshToken: 'tok' });
        expect(res.status).toBe(401);
    });
});

// ── SQL-injection-like payloads ────────────────────────────────────────────────

describe('SQL injection resilience', () => {
    beforeEach(() => jest.resetAllMocks());

    it('login: sql injection in email field reaches service as-is (service validates)', async () => {
        // The route does schema validation then passes to service.
        // Parameterised queries in the service protect against injection.
        // Here we verify the app doesn't crash and returns a controlled response.
        authService.login.mockRejectedValueOnce(new Error('Invalid credentials'));

        const res = await request(app)
            .post('/auth/login')
            .send({ email: "' OR 1=1 --", password: 'anything' });

        expect([400, 401]).toContain(res.status);
        expect(res.body).toHaveProperty('error');
    });

    it('signup: sql injection in email field does not cause 500', async () => {
        authService.signup.mockRejectedValueOnce(new Error('Account creation failed.'));

        const res = await request(app)
            .post('/auth/signup')
            .send({
                email: "'; DROP TABLE users; --",
                password: 'StrongP@ss1',
                full_name: 'Hacker',
                gender: 'male',
                district_id: 1,
                college_id: 2,
                student_status: 'student',
                year_of_study: 2,
                degree_id: 3,
                course_id: 4,
            });

        expect(res.status).not.toBe(500);
    });
});

// ── XSS-like payloads ─────────────────────────────────────────────────────────

describe('XSS payload handling', () => {
    beforeEach(() => jest.resetAllMocks());

    it('login: script tag in email field is not reflected as HTML (JSON response)', async () => {
        authService.login.mockRejectedValueOnce(new Error('Invalid credentials'));

        const res = await request(app)
            .post('/auth/login')
            .send({ email: '<script>alert(1)</script>@evil.com', password: 'pass' });

        expect(res.type).toMatch(/json/);
        // Response is JSON, not HTML — XSS is not possible via API response
        expect(res.headers['content-type']).toMatch(/application\/json/);
    });
});

// ── Payload size limit ─────────────────────────────────────────────────────────

describe('Payload size enforcement', () => {
    it('returns 413 when JSON body exceeds 1mb limit', async () => {
        const bigPayload = { email: 'a@b.com', password: 'x', data: 'A'.repeat(1.1 * 1024 * 1024) };
        const res = await request(app)
            .post('/auth/login')
            .set('Content-Type', 'application/json')
            .send(JSON.stringify(bigPayload));
        expect(res.status).toBe(413);
    });
});

// ── Password never echoed ──────────────────────────────────────────────────────

describe('Password not echoed in response', () => {
    beforeEach(() => jest.resetAllMocks());

    const SIGNUP_BODY = {
        email: 'student@college.edu',
        password: 'UniqueP@ss9!',
        full_name: 'Test User',
        gender: 'male',
        district_id: 1,
        college_id: 2,
        student_status: 'student',
        year_of_study: 2,
        degree_id: 3,
        course_id: 4,
    };

    it('signup success response does not contain the plaintext password', async () => {
        authService.signup.mockResolvedValueOnce({
            accessToken: 'tok',
            refreshToken: 'rtok',
            user: { id: '1', email: 'student@college.edu', full_name: 'Test User' },
        });

        const res = await request(app).post('/auth/signup').send(SIGNUP_BODY);

        expect(JSON.stringify(res.body)).not.toContain('UniqueP@ss9!');
    });

    it('login success response does not contain the plaintext password', async () => {
        authService.login.mockResolvedValueOnce({
            accessToken: 'tok',
            refreshToken: 'rtok',
            user: { id: '1', email: 'student@college.edu', full_name: 'Test User' },
        });

        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'student@college.edu', password: 'UniqueP@ss9!' });

        expect(JSON.stringify(res.body)).not.toContain('UniqueP@ss9!');
    });

    it('login error response does not contain the plaintext password', async () => {
        authService.login.mockRejectedValueOnce(new Error('Invalid credentials'));

        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'student@college.edu', password: 'UniqueP@ss9!' });

        expect(JSON.stringify(res.body)).not.toContain('UniqueP@ss9!');
    });
});
