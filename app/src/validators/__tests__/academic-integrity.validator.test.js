const { academicIntegrityValidator } = require('../academic-integrity.validator');

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

const BASE = { district_id: 1, college_id: 2, degree_id: 3, course_id: 4 };
const CURRENT_YEAR = new Date().getFullYear();

describe('academicIntegrityValidator', () => {
    // ── Required ID fields ────────────────────────────────────────────────────

    it('returns 400 when district_id is missing', () => {
        const { district_id: _d, ...body } = BASE;
        const { req, res, next } = mockReqRes({ ...body, student_status: 'student', year_of_study: 1 });
        academicIntegrityValidator(req, res, next);
        expect(res._status).toBe(400);
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 400 when college_id is missing', () => {
        const { college_id: _c, ...body } = BASE;
        const { req, res, next } = mockReqRes({ ...body, student_status: 'student', year_of_study: 1 });
        academicIntegrityValidator(req, res, next);
        expect(res._status).toBe(400);
    });

    it('returns 400 when degree_id is missing', () => {
        const { degree_id: _d, ...body } = BASE;
        const { req, res, next } = mockReqRes({ ...body, student_status: 'student', year_of_study: 1 });
        academicIntegrityValidator(req, res, next);
        expect(res._status).toBe(400);
    });

    it('returns 400 when course_id is missing', () => {
        const { course_id: _c, ...body } = BASE;
        const { req, res, next } = mockReqRes({ ...body, student_status: 'student', year_of_study: 1 });
        academicIntegrityValidator(req, res, next);
        expect(res._status).toBe(400);
    });

    // ── Student path ──────────────────────────────────────────────────────────

    it('calls next() for a valid student with year_of_study in [1,8]', () => {
        for (const year of [1, 4, 8]) {
            const { req, res, next } = mockReqRes({ ...BASE, student_status: 'student', year_of_study: year });
            academicIntegrityValidator(req, res, next);
            expect(next).toHaveBeenCalledTimes(1);
        }
    });

    it.each([
        ['year_of_study = 0', { year_of_study: 0 }],
        ['year_of_study = 9', { year_of_study: 9 }],
        ['year_of_study = -1', { year_of_study: -1 }],
        ['year_of_study is a float', { year_of_study: 2.5 }],
        ['year_of_study is a string', { year_of_study: '3' }],
        ['year_of_study is missing', {}],
    ])('student: returns 400 when %s', (_label, override) => {
        const { req, res, next } = mockReqRes({ ...BASE, student_status: 'student', ...override });
        academicIntegrityValidator(req, res, next);
        expect(res._status).toBe(400);
        expect(next).not.toHaveBeenCalled();
    });

    it('student: returns 400 when graduation_year is provided', () => {
        const { req, res, next } = mockReqRes({
            ...BASE,
            student_status: 'student',
            year_of_study: 2,
            graduation_year: 2022,
        });
        academicIntegrityValidator(req, res, next);
        expect(res._status).toBe(400);
    });

    // ── Alumni path ───────────────────────────────────────────────────────────

    it('calls next() for a valid alumni with graduation_year in [1950, currentYear+1]', () => {
        for (const year of [1950, 2000, CURRENT_YEAR, CURRENT_YEAR + 1]) {
            const { req, res, next } = mockReqRes({ ...BASE, student_status: 'alumni', graduation_year: year });
            academicIntegrityValidator(req, res, next);
            expect(next).toHaveBeenCalledTimes(1);
        }
    });

    it.each([
        ['graduation_year = 1949', { graduation_year: 1949 }],
        ['graduation_year = currentYear + 2', { graduation_year: CURRENT_YEAR + 2 }],
        ['graduation_year is a float', { graduation_year: 2020.5 }],
        ['graduation_year is a string', { graduation_year: '2020' }],
        ['graduation_year is missing', {}],
    ])('alumni: returns 400 when %s', (_label, override) => {
        const { req, res, next } = mockReqRes({ ...BASE, student_status: 'alumni', ...override });
        academicIntegrityValidator(req, res, next);
        expect(res._status).toBe(400);
        expect(next).not.toHaveBeenCalled();
    });

    it('alumni: returns 400 when year_of_study is provided', () => {
        const { req, res, next } = mockReqRes({
            ...BASE,
            student_status: 'alumni',
            graduation_year: 2020,
            year_of_study: 3,
        });
        academicIntegrityValidator(req, res, next);
        expect(res._status).toBe(400);
    });

    // ── Neither student nor alumni (unknown status passes through) ────────────
    it('calls next() when student_status is undefined (validation left to enum validator)', () => {
        const { req, res, next } = mockReqRes({ ...BASE });
        academicIntegrityValidator(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
    });
});
