const { enumValidator } = require('../enum.validator');

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

describe('enumValidator', () => {
    const mw = enumValidator('gender', ['male', 'female', 'other', 'prefer_not_to_say']);

    it('calls next() for an allowed value', () => {
        const { req, res, next } = mockReqRes({ gender: 'male' });
        mw(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res._status).toBeNull();
    });

    it('calls next() for each allowed value', () => {
        for (const val of ['male', 'female', 'other', 'prefer_not_to_say']) {
            const { req, res, next } = mockReqRes({ gender: val });
            mw(req, res, next);
            expect(next).toHaveBeenCalledTimes(1);
        }
    });

    it('returns 400 for a value not in the allowed set', () => {
        const { req, res, next } = mockReqRes({ gender: 'robot' });
        mw(req, res, next);
        expect(res._status).toBe(400);
        expect(res._body.error).toMatch(/gender/);
        expect(next).not.toHaveBeenCalled();
    });

    it('error message lists allowed values', () => {
        const { req, res } = mockReqRes({ gender: 'alien' });
        mw(req, res, jest.fn());
        expect(res._body.error).toMatch(/male/);
    });

    it('calls next() when the field is null (optional field absent)', () => {
        const { req, res, next } = mockReqRes({ gender: null });
        mw(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('calls next() when the field is undefined', () => {
        const { req, res, next } = mockReqRes({});
        mw(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('is case-sensitive — uppercase variant is rejected', () => {
        const { req, res, next } = mockReqRes({ gender: 'Male' });
        mw(req, res, next);
        expect(res._status).toBe(400);
    });

    describe('enumValidator for student_status', () => {
        const statusMw = enumValidator('student_status', ['student', 'alumni']);

        it('accepts "student"', () => {
            const { req, res, next } = mockReqRes({ student_status: 'student' });
            statusMw(req, res, next);
            expect(next).toHaveBeenCalledTimes(1);
        });

        it('accepts "alumni"', () => {
            const { req, res, next } = mockReqRes({ student_status: 'alumni' });
            statusMw(req, res, next);
            expect(next).toHaveBeenCalledTimes(1);
        });

        it('rejects "employee"', () => {
            const { req, res, next } = mockReqRes({ student_status: 'employee' });
            statusMw(req, res, next);
            expect(res._status).toBe(400);
        });
    });
});
