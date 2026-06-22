const { sha256, randomToken } = require('../crypto.util');

describe('sha256', () => {
    it('returns a 64-character lowercase hex string', () => {
        const result = sha256('hello');
        expect(result).toHaveLength(64);
        expect(result).toMatch(/^[0-9a-f]+$/);
    });

    it('matches the known SHA-256 of "hello"', () => {
        expect(sha256('hello')).toBe(
            '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
        );
    });

    it('matches the known SHA-256 of empty string', () => {
        expect(sha256('')).toBe(
            'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
        );
    });

    it('is deterministic — same input always yields same output', () => {
        expect(sha256('cortex-test')).toBe(sha256('cortex-test'));
    });

    it('produces distinct output for distinct inputs', () => {
        expect(sha256('abc')).not.toBe(sha256('xyz'));
        expect(sha256('abc')).not.toBe(sha256('ABC'));
    });

    it('handles numeric string input', () => {
        const result = sha256('12345');
        expect(result).toHaveLength(64);
        expect(result).toMatch(/^[0-9a-f]+$/);
    });
});

describe('randomToken', () => {
    it('returns a hex string', () => {
        expect(randomToken()).toMatch(/^[0-9a-f]+$/);
    });

    it('default size (48 bytes) produces 96 hex chars', () => {
        expect(randomToken()).toHaveLength(96);
    });

    it('honours custom byte size — output length = size × 2', () => {
        expect(randomToken(32)).toHaveLength(64);
        expect(randomToken(16)).toHaveLength(32);
        expect(randomToken(1)).toHaveLength(2);
    });

    it('successive calls return different values', () => {
        const a = randomToken();
        const b = randomToken();
        expect(a).not.toBe(b);
    });

    it('size=64 produces 128 hex chars', () => {
        expect(randomToken(64)).toHaveLength(128);
    });
});
