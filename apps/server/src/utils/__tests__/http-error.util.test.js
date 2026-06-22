const { HttpError, badRequest, unauthorized, forbidden, tooManyRequests } = require('../http-error.util');

describe('HttpError', () => {
    it('is an instance of Error', () => {
        const err = new HttpError(400, 'bad');
        expect(err).toBeInstanceOf(Error);
    });

    it('sets statusCode, message, name', () => {
        const err = new HttpError(422, 'Unprocessable');
        expect(err.statusCode).toBe(422);
        expect(err.message).toBe('Unprocessable');
        expect(err.name).toBe('HttpError');
    });

    it('defaults code to ERROR when not provided', () => {
        const err = new HttpError(500, 'oops');
        expect(err.code).toBe('ERROR');
    });

    it('accepts custom code, field, and details', () => {
        const err = new HttpError(400, 'bad', { code: 'INVALID', field: 'email', details: ['must be valid'] });
        expect(err.code).toBe('INVALID');
        expect(err.field).toBe('email');
        expect(err.details).toEqual(['must be valid']);
    });

    it('expose defaults to true', () => {
        expect(new HttpError(400, 'msg').expose).toBe(true);
    });

    it('expose can be set to false', () => {
        expect(new HttpError(500, 'msg', { expose: false }).expose).toBe(false);
    });
});

describe('badRequest', () => {
    it('creates a 400 HttpError', () => {
        const err = badRequest('invalid input');
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe('BAD_REQUEST');
    });

    it('accepts custom code', () => {
        const err = badRequest('bad', { code: 'MISSING_FIELD' });
        expect(err.code).toBe('MISSING_FIELD');
    });
});

describe('unauthorized', () => {
    it('creates a 401 HttpError', () => {
        const err = unauthorized('not allowed');
        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
    });
});

describe('forbidden', () => {
    it('creates a 403 HttpError', () => {
        const err = forbidden('no access');
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('FORBIDDEN');
    });
});

describe('tooManyRequests', () => {
    it('creates a 429 HttpError', () => {
        const err = tooManyRequests('slow down');
        expect(err.statusCode).toBe(429);
        expect(err.code).toBe('TOO_MANY_REQUESTS');
    });
});
