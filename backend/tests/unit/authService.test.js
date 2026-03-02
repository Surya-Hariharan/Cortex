const bcrypt = require('bcryptjs');
const { registerUser, loginUser } = require('../../src/auth/authService');
const { getDb } = require('../../src/storage/dbInit');

describe('Authentication Service', () => {
    let db;
    const testUser = {
        fullName: 'Test Student',
        email: 'student@example.com',
        password: 'SecurePassword123!',
        confirmPassword: 'SecurePassword123!',
        collegeName: 'Test College',
        rollNumber: 'CB.EN.U4CYS21000',
        degree: 'B.Tech',
        courseName: 'Computer Science',
        academicLevel: 'Undergraduate',
        phoneNumber: '9876543210'
    };

    beforeAll(() => {
        db = getDb();
    });

    it('should successfully register a valid new user', async () => {
        const response = await registerUser(db, testUser, false);
        expect(response.success).toBe(true);
        expect(response.token).toBeDefined();
        expect(response.user.email).toBe(testUser.email);
    });

    it('should hash passwords via bcrypt (not plaintext)', () => {
        const userRow = db.getUserByEmail(testUser.email);
        expect(userRow).toBeDefined();
        expect(userRow.passwordHash).not.toBe(testUser.password);
        expect(userRow.passwordHash.length).toBeGreaterThan(50); // Bcrypt hashes are 60 chars
    });

    it('should fail to register a duplicate email', async () => {
        const response = await registerUser(db, testUser, false);
        expect(response.error).toBeDefined();
        expect(response.error).toContain('already exists');
    });

    it('should login successfully with correct credentials', async () => {
        const response = await loginUser(db, testUser.email, testUser.password);
        expect(response.success).toBe(true);
        expect(response.token).toBeDefined();
    });

    it('should reject login with incorrect password', async () => {
        const response = await loginUser(db, testUser.email, 'WrongPassword123!');
        expect(response.error).toBeDefined();
        expect(response.error).toContain('Incorrect password');
    });

    it('should reject login for non-existent users', async () => {
        const response = await loginUser(db, 'ghost@nobody.com', 'GhostPass!');
        expect(response.error).toBeDefined();
        expect(response.error).toContain('No account found');
    });
});
