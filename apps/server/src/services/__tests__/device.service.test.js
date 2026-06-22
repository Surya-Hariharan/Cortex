jest.mock('../../../../../database/pool', () => ({
    pool: { query: jest.fn() },
}));

const { pool } = require('../../../../../database/pool');
const { registerOrUpdateDevice, isDeviceRevoked, isDeviceTrusted } = require('../device.service');

const DEVICE_ROW = {
    id: 'dev-001',
    user_id: 'user-001',
    fingerprint: 'fp-abc',
    ram: 8,
    cpu: 'Intel i7',
    gpu: null,
    npu: null,
    trusted: false,
    revoked: false,
    revoked_at: null,
};

describe('registerOrUpdateDevice', () => {
    beforeEach(() => jest.clearAllMocks());

    it('inserts or updates a device row and returns it', async () => {
        pool.query.mockResolvedValueOnce({ rows: [DEVICE_ROW] });

        const result = await registerOrUpdateDevice({
            userId: 'user-001',
            fingerprint: 'fp-abc',
            ram: 8,
            cpu: 'Intel i7',
        });

        expect(pool.query).toHaveBeenCalledTimes(1);
        const [sql, params] = pool.query.mock.calls[0];
        expect(sql).toMatch(/INSERT INTO devices/);
        expect(params[0]).toBe('user-001');
        expect(params[1]).toBe('fp-abc');
        expect(result).toEqual(DEVICE_ROW);
    });

    it('uses null for missing optional hardware fields', async () => {
        pool.query.mockResolvedValueOnce({ rows: [DEVICE_ROW] });

        await registerOrUpdateDevice({ userId: 'u1', fingerprint: 'fp' });

        const [, params] = pool.query.mock.calls[0];
        expect(params[2]).toBeNull(); // ram
        expect(params[3]).toBeNull(); // cpu
        expect(params[4]).toBeNull(); // gpu
        expect(params[5]).toBeNull(); // npu
    });

    it('accepts a custom db pool', async () => {
        const customDb = { query: jest.fn().mockResolvedValueOnce({ rows: [DEVICE_ROW] }) };
        await registerOrUpdateDevice({ userId: 'u1', fingerprint: 'fp' }, customDb);
        expect(customDb.query).toHaveBeenCalledTimes(1);
        expect(pool.query).not.toHaveBeenCalled();
    });

    it('sets trusted to false by default', async () => {
        pool.query.mockResolvedValueOnce({ rows: [DEVICE_ROW] });
        await registerOrUpdateDevice({ userId: 'u1', fingerprint: 'fp' });
        const [, params] = pool.query.mock.calls[0];
        expect(params[6]).toBe(false);
    });
});

describe('isDeviceRevoked', () => {
    it('returns false for null/undefined', () => {
        expect(isDeviceRevoked(null)).toBe(false);
        expect(isDeviceRevoked(undefined)).toBe(false);
    });

    it('returns true when revoked is true', () => {
        expect(isDeviceRevoked({ revoked: true })).toBe(true);
    });

    it('returns true when revoked_at is set', () => {
        expect(isDeviceRevoked({ revoked: false, revoked_at: new Date() })).toBe(true);
    });

    it('returns false when revoked is false and revoked_at is null', () => {
        expect(isDeviceRevoked({ revoked: false, revoked_at: null })).toBe(false);
    });
});

describe('isDeviceTrusted', () => {
    it('returns false for null/undefined', () => {
        expect(isDeviceTrusted(null)).toBe(false);
        expect(isDeviceTrusted(undefined)).toBe(false);
    });

    it('returns true when trusted is true', () => {
        expect(isDeviceTrusted({ trusted: true })).toBe(true);
    });

    it('returns false when trusted is false', () => {
        expect(isDeviceTrusted({ trusted: false })).toBe(false);
    });
});
