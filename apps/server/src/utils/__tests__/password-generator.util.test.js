const { generateTemporaryPassword } = require('../password-generator.util');

describe('generateTemporaryPassword', () => {
    it('returns a string', () => {
        expect(typeof generateTemporaryPassword()).toBe('string');
    });

    it('has at least 14 characters by default', () => {
        expect(generateTemporaryPassword().length).toBeGreaterThanOrEqual(14);
    });

    it('accepts a custom length (minimum clamped to 12)', () => {
        expect(generateTemporaryPassword(20).length).toBeGreaterThanOrEqual(20);
        expect(generateTemporaryPassword(4).length).toBeGreaterThanOrEqual(12);
    });

    it('contains at least one uppercase letter', () => {
        const pwd = generateTemporaryPassword();
        expect(/[A-Z]/.test(pwd)).toBe(true);
    });

    it('contains at least one lowercase letter', () => {
        const pwd = generateTemporaryPassword();
        expect(/[a-z]/.test(pwd)).toBe(true);
    });

    it('contains at least one digit', () => {
        const pwd = generateTemporaryPassword();
        expect(/[0-9]/.test(pwd)).toBe(true);
    });

    it('contains at least one special character', () => {
        const pwd = generateTemporaryPassword();
        expect(/[!@#$%^&*()\-_=+\[\]{}]/.test(pwd)).toBe(true);
    });

    it('produces different passwords on each call', () => {
        const a = generateTemporaryPassword();
        const b = generateTemporaryPassword();
        // Extremely unlikely to collide for 14-char random passwords
        expect(a).not.toBe(b);
    });

    it('handles NaN length gracefully (uses minimum 12)', () => {
        expect(generateTemporaryPassword(NaN).length).toBeGreaterThanOrEqual(12);
    });
});
