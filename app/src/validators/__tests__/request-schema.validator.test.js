const { requestSchemaValidator } = require('../request-schema.validator');

function mockReqRes(body = {}) {
    const req = { body };
    const res = {
        _status: null,
        _body: null,
        status(code) { this._status = code; return this; },
        json(data) { this._body = data; return this; },
    };
    const next = jest.fn();
    return { req, res, next };
}

describe('requestSchemaValidator', () => {
    it('calls next() when all required fields are present and correctly typed', () => {
        const mw = requestSchemaValidator({
            required: ['email', 'password'],
            types: { email: 'string', password: 'string' },
        });
        const { req, res, next } = mockReqRes({ email: 'a@b.com', password: 'pass' });
        mw(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res._status).toBeNull();
    });

    it('returns 400 when a required field is missing', () => {
        const mw = requestSchemaValidator({ required: ['email'] });
        const { req, res, next } = mockReqRes({});
        mw(req, res, next);
        expect(res._status).toBe(400);
        expect(res._body.details).toContain('email is required');
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 400 when a required field is null', () => {
        const mw = requestSchemaValidator({ required: ['name'] });
        const { req, res, next } = mockReqRes({ name: null });
        mw(req, res, next);
        expect(res._status).toBe(400);
    });

    it('returns 400 when a required field is empty string', () => {
        const mw = requestSchemaValidator({ required: ['name'] });
        const { req, res, next } = mockReqRes({ name: '' });
        mw(req, res, next);
        expect(res._status).toBe(400);
    });

    it('returns 400 when a field fails the string type check', () => {
        const mw = requestSchemaValidator({ required: [], types: { count: 'number' } });
        const { req, res, next } = mockReqRes({ count: 'not-a-number' });
        mw(req, res, next);
        expect(res._status).toBe(400);
        expect(res._body.details).toContain('count must be a number');
    });

    it('returns 400 when array type receives a non-array', () => {
        const mw = requestSchemaValidator({ required: [], types: { tags: 'array' } });
        const { req, res, next } = mockReqRes({ tags: 'not-an-array' });
        mw(req, res, next);
        expect(res._status).toBe(400);
        expect(res._body.details).toContain('tags must be an array');
    });

    it('calls next() when array type receives a real array', () => {
        const mw = requestSchemaValidator({ required: [], types: { tags: 'array' } });
        const { req, res, next } = mockReqRes({ tags: ['a', 'b'] });
        mw(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('returns 400 when int type receives a float', () => {
        const mw = requestSchemaValidator({ required: [], types: { year: 'int' } });
        const { req, res, next } = mockReqRes({ year: 1.5 });
        mw(req, res, next);
        expect(res._status).toBe(400);
        expect(res._body.details).toContain('year must be an integer');
    });

    it('calls next() when int type receives a whole number', () => {
        const mw = requestSchemaValidator({ required: [], types: { year: 'int' } });
        const { req, res, next } = mockReqRes({ year: 3 });
        mw(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('skips type check for undefined/null optional fields', () => {
        const mw = requestSchemaValidator({ required: [], types: { opt: 'string' } });
        const { req, res, next } = mockReqRes({});
        mw(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('accumulates multiple validation errors in one response', () => {
        const mw = requestSchemaValidator({
            required: ['a', 'b'],
            types: { c: 'number' },
        });
        const { req, res, next } = mockReqRes({ c: 'bad' });
        mw(req, res, next);
        expect(res._body.details).toHaveLength(3);
        expect(res._body.error).toBe('Validation failed');
    });
});
