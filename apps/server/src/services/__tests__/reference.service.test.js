jest.mock('../../../../../database/pool', () => ({
    pool: { query: jest.fn() },
}));

const { pool } = require('../../../../../database/pool');
const { getDistricts, getColleges, getDegrees, getCourses } = require('../reference.service');

describe('getDistricts', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns all districts ordered by name', async () => {
        const rows = [{ id: 1, name: 'Chennai', state: 'Tamil Nadu' }];
        pool.query.mockResolvedValueOnce({ rows });

        const result = await getDistricts();

        expect(pool.query).toHaveBeenCalledTimes(1);
        expect(pool.query.mock.calls[0][0]).toMatch(/ORDER BY name ASC/);
        expect(result).toEqual(rows);
    });
});

describe('getColleges', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns all colleges when no districtId is given', async () => {
        const rows = [{ id: 1, name: 'IIT Madras', district_id: 1, is_verified: true }];
        pool.query.mockResolvedValueOnce({ rows });

        const result = await getColleges();

        const [sql, values] = pool.query.mock.calls[0];
        expect(sql).not.toMatch(/WHERE/);
        expect(values).toEqual([]);
        expect(result).toEqual(rows);
    });

    it('filters by districtId when provided', async () => {
        const rows = [{ id: 2, name: 'Anna University', district_id: 3, is_verified: true }];
        pool.query.mockResolvedValueOnce({ rows });

        await getColleges(3);

        const [sql, values] = pool.query.mock.calls[0];
        expect(sql).toMatch(/WHERE district_id/);
        expect(values).toEqual([3]);
    });
});

describe('getDegrees', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns all degrees', async () => {
        const rows = [{ id: 1, name: 'B.E' }];
        pool.query.mockResolvedValueOnce({ rows });

        const result = await getDegrees();

        expect(pool.query).toHaveBeenCalledTimes(1);
        expect(result).toEqual(rows);
    });
});

describe('getCourses', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns all courses when no degreeId is given', async () => {
        const rows = [{ id: 1, name: 'Computer Science', degree_id: 1 }];
        pool.query.mockResolvedValueOnce({ rows });

        const result = await getCourses();

        const [sql, values] = pool.query.mock.calls[0];
        expect(sql).not.toMatch(/WHERE/);
        expect(values).toEqual([]);
        expect(result).toEqual(rows);
    });

    it('filters by degreeId when provided', async () => {
        const rows = [{ id: 5, name: 'IT', degree_id: 2 }];
        pool.query.mockResolvedValueOnce({ rows });

        await getCourses(2);

        const [sql, values] = pool.query.mock.calls[0];
        expect(sql).toMatch(/WHERE degree_id/);
        expect(values).toEqual([2]);
    });
});
