const {
    normalizeEmail,
    validateEmail,
    validatePasswordPolicy,
    validateSignupPayload,
} = require('../auth-validation.util');

// ── normalizeEmail ────────────────────────────────────────────────────────────

describe('normalizeEmail', () => {
    it('lowercases and trims', () => {
        expect(normalizeEmail('  TEST@Example.COM  ')).toBe('test@example.com');
    });

    it('handles empty string', () => {
        expect(normalizeEmail('')).toBe('');
    });

    it('handles null gracefully', () => {
        expect(normalizeEmail(null)).toBe('');
    });

    it('handles undefined gracefully', () => {
        expect(normalizeEmail(undefined)).toBe('');
    });

    it('preserves already-normalized email', () => {
        expect(normalizeEmail('user@domain.io')).toBe('user@domain.io');
    });
});

// ── validateEmail ─────────────────────────────────────────────────────────────

describe('validateEmail', () => {
    it('returns normalized email for a valid address', () => {
        expect(validateEmail('  USER@College.EDU  ')).toBe('user@college.edu');
    });

    it('accepts standard email formats', () => {
        expect(() => validateEmail('a@b.co')).not.toThrow();
        expect(() => validateEmail('user.name+tag@example.org')).not.toThrow();
    });

    it.each([
        ['no @ symbol', 'notanemail'],
        ['no domain', 'user@'],
        ['no local part', '@domain.com'],
        ['space in middle', 'us er@domain.com'],
        ['empty string', ''],
    ])('throws for invalid email: %s', (_label, email) => {
        expect(() => validateEmail(email)).toThrow();
    });

    it('thrown error has code INVALID_EMAIL and field email', () => {
        let err;
        try { validateEmail('bad-input'); } catch (e) { err = e; }
        expect(err).toBeDefined();
        expect(err.code).toBe('INVALID_EMAIL');
        expect(err.field).toBe('email');
        expect(err.statusCode).toBe(400);
    });
});

// ── validatePasswordPolicy ────────────────────────────────────────────────────

describe('validatePasswordPolicy', () => {
    it('accepts a valid password with all required character classes', () => {
        expect(() => validatePasswordPolicy('StrongP@ss1')).not.toThrow();
    });

    it.each([
        ['too short (7 chars)', 'Sh0rt!A'],
        ['no uppercase letter', 'lowercase1!'],
        ['no lowercase letter', 'UPPERCASE1!'],
        ['no digit', 'NoDigitHere!'],
        ['no special character', 'NoSpecial12'],
        ['empty string', ''],
        ['only spaces', '        '],
    ])('rejects: %s', (_label, pw) => {
        expect(() => validatePasswordPolicy(pw)).toThrow();
    });

    it('thrown error has code WEAK_PASSWORD and field password', () => {
        let err;
        try { validatePasswordPolicy('weak'); } catch (e) { err = e; }
        expect(err.code).toBe('WEAK_PASSWORD');
        expect(err.field).toBe('password');
        expect(err.statusCode).toBe(400);
    });

    it('returns the password value on success', () => {
        const pw = 'Valid@Pass9';
        expect(validatePasswordPolicy(pw)).toBe(pw);
    });
});

// ── validateSignupPayload ─────────────────────────────────────────────────────

describe('validateSignupPayload', () => {
    const VALID = {
        email: 'student@college.edu',
        full_name: 'Test User',
        phone_number: '9876543210',
        password: 'StrongP@ss1',
        confirm_password: 'StrongP@ss1',
    };

    it('returns cleaned payload for valid input', () => {
        const result = validateSignupPayload(VALID);
        expect(result.email).toBe('student@college.edu');
        expect(result.full_name).toBe('Test User');
        expect(result.phone_number).toBe('9876543210');
        expect(result.password).toBe('StrongP@ss1');
    });

    it('normalizes email to lowercase', () => {
        const result = validateSignupPayload({ ...VALID, email: 'STUDENT@COLLEGE.EDU' });
        expect(result.email).toBe('student@college.edu');
    });

    it('throws REQUIRED when full_name is empty string', () => {
        let err;
        try { validateSignupPayload({ ...VALID, full_name: '' }); } catch (e) { err = e; }
        expect(err.code).toBe('REQUIRED');
        expect(err.field).toBe('full_name');
    });

    it('throws INVALID_FULL_NAME when full_name contains digits', () => {
        let err;
        try { validateSignupPayload({ ...VALID, full_name: 'User123' }); } catch (e) { err = e; }
        expect(err.code).toBe('INVALID_FULL_NAME');
    });

    it('throws INVALID_FULL_NAME when full_name contains special chars', () => {
        expect(() => validateSignupPayload({ ...VALID, full_name: 'Test@User' })).toThrow();
    });

    it('throws INVALID_PHONE_NUMBER for too-short phone', () => {
        let err;
        try { validateSignupPayload({ ...VALID, phone_number: '12345' }); } catch (e) { err = e; }
        expect(err.code).toBe('INVALID_PHONE_NUMBER');
    });

    it('throws INVALID_PHONE_NUMBER for phone with letters', () => {
        expect(() =>
            validateSignupPayload({ ...VALID, phone_number: '98765432ab' })
        ).toThrow();
    });

    it('throws INVALID_PHONE_NUMBER for 11-digit phone', () => {
        expect(() =>
            validateSignupPayload({ ...VALID, phone_number: '12345678901' })
        ).toThrow();
    });

    it('throws WEAK_PASSWORD for weak password', () => {
        expect(() =>
            validateSignupPayload({ ...VALID, password: 'weak', confirm_password: 'weak' })
        ).toThrow();
    });

    it('throws PASSWORD_MISMATCH when passwords differ', () => {
        let err;
        try {
            validateSignupPayload({ ...VALID, confirm_password: 'DifferentP@ss1' });
        } catch (e) { err = e; }
        expect(err.code).toBe('PASSWORD_MISMATCH');
        expect(err.field).toBe('confirm_password');
    });
});
