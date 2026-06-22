// jest.setup.js already set JWT_ACCESS_SECRET / JWT_REFRESH_SECRET before
// this module is loaded, so tokens.util captures the test secrets at require-time.

const jwt = require('jsonwebtoken');

let signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken;

beforeAll(() => {
    // Reload the module inside an isolated registry so that the env vars set
    // by jest.setup.js are picked up fresh (avoids stale cached values in
    // watch mode or when tests share a worker).
    jest.isolateModules(() => {
        ({ signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } =
            require('../tokens.util'));
    });
});

describe('signAccessToken / verifyAccessToken', () => {
    const payload = { sub: 'user-abc', sid: 'session-1', did: 'device-1' };

    it('produces a non-empty string', () => {
        expect(typeof signAccessToken(payload)).toBe('string');
        expect(signAccessToken(payload).length).toBeGreaterThan(10);
    });

    it('round-trips payload through sign→verify', () => {
        const token = signAccessToken(payload);
        const decoded = verifyAccessToken(token);
        expect(decoded.sub).toBe('user-abc');
        expect(decoded.sid).toBe('session-1');
        expect(decoded.did).toBe('device-1');
    });

    it('throws JsonWebTokenError for a garbage token', () => {
        expect(() => verifyAccessToken('not.a.token')).toThrow();
    });

    it('throws when verified with the wrong secret', () => {
        const fake = jwt.sign(payload, 'wrong-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
        expect(() => verifyAccessToken(fake)).toThrow();
    });

    it('throws TokenExpiredError for an already-expired token', () => {
        const expired = jwt.sign(
            payload,
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: '-1s' }
        );
        expect(() => verifyAccessToken(expired)).toThrow(/expired/i);
    });
});

describe('signRefreshToken / verifyRefreshToken', () => {
    const payload = { sub: 'user-xyz', sid: 'session-2', did: 'device-2', rtk: 'rawtoken123' };

    it('produces a non-empty string', () => {
        expect(typeof signRefreshToken(payload)).toBe('string');
    });

    it('round-trips payload through sign→verify', () => {
        const token = signRefreshToken(payload);
        const decoded = verifyRefreshToken(token);
        expect(decoded.sub).toBe('user-xyz');
        expect(decoded.rtk).toBe('rawtoken123');
    });

    it('throws on a tampered signature', () => {
        const token = signRefreshToken(payload);
        const tampered = token.slice(0, -4) + 'XXXX';
        expect(() => verifyRefreshToken(tampered)).toThrow();
    });

    it('throws when verified with the wrong secret', () => {
        const fake = jwt.sign(payload, 'wrong-refresh-secret-xxxxxxxxxxxxxxxxxxxxxxxxxx');
        expect(() => verifyRefreshToken(fake)).toThrow();
    });

    it('access and refresh tokens use different secrets (cross-verify throws)', () => {
        const access = signAccessToken({ sub: 'u1' });
        expect(() => verifyRefreshToken(access)).toThrow();

        const refresh = signRefreshToken({ sub: 'u1' });
        expect(() => verifyAccessToken(refresh)).toThrow();
    });
});
