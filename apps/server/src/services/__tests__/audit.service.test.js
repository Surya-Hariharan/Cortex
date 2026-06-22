jest.mock('../../../../../database/pool', () => ({
    pool: { query: jest.fn() },
}));

const { pool } = require('../../../../../database/pool');
const { writeAuditEvent } = require('../audit.service');

describe('writeAuditEvent', () => {
    beforeEach(() => jest.clearAllMocks());

    it('inserts an audit log row with all provided fields', async () => {
        pool.query.mockResolvedValueOnce({ rowCount: 1 });

        await writeAuditEvent({
            userId: 'user-001',
            deviceId: 'dev-001',
            eventType: 'LOGIN',
            eventData: { method: 'password' },
            ipAddress: '127.0.0.1',
            userAgent: 'Jest/1.0',
        });

        expect(pool.query).toHaveBeenCalledTimes(1);
        const [sql, params] = pool.query.mock.calls[0];
        expect(sql).toMatch(/INSERT INTO audit_logs/);
        expect(params).toEqual(['user-001', 'dev-001', 'LOGIN', { method: 'password' }, '127.0.0.1', 'Jest/1.0']);
    });

    it('inserts with null defaults when optional fields are omitted', async () => {
        pool.query.mockResolvedValueOnce({ rowCount: 1 });

        await writeAuditEvent({ eventType: 'LOGOUT' });

        const [, params] = pool.query.mock.calls[0];
        expect(params[0]).toBeNull(); // userId
        expect(params[1]).toBeNull(); // deviceId
        expect(params[4]).toBeNull(); // ipAddress
        expect(params[5]).toBeNull(); // userAgent
    });

    it('does nothing when eventType is missing', async () => {
        await writeAuditEvent({ userId: 'user-001' });
        expect(pool.query).not.toHaveBeenCalled();
    });

    it('accepts a custom db pool via the db parameter', async () => {
        const customDb = { query: jest.fn().mockResolvedValueOnce({ rowCount: 1 }) };
        await writeAuditEvent({ eventType: 'CUSTOM', db: customDb });
        expect(customDb.query).toHaveBeenCalledTimes(1);
        expect(pool.query).not.toHaveBeenCalled();
    });
});
