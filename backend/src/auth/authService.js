/**
 * Cortex — Authentication Service
 * Offline-first: registration works without internet.
 * Optional online email verification when connected.
 * Passwords hashed with bcryptjs, sessions via UUID tokens stored in SQLite.
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const os = require('os');
const { sendOtp } = require('./mailer');

const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10);
const BCRYPT_ROUNDS = 10;
const SESSION_EXPIRY_DAYS = 30;

// ── Academic Options (configurable dropdown lists) ──────────────────────────

const ACADEMIC_OPTIONS = {
    colleges: [
        'Amrita Vishwa Vidyapeetham, Coimbatore',
        'PSG College of Technology',
    ],
    degrees: ['B.Tech', 'B.Sc', 'MBA', 'M.Tech', 'PhD'],
    courses: [
        'Computer Science',
        'Mechanical Engineering',
        'Electrical Engineering',
        'Civil Engineering',
        'MBA Finance',
        'MBA Marketing',
    ],
    academicLevels: ['Undergraduate', 'Postgraduate', 'Doctorate'],
};

function getAcademicOptions() {
    return ACADEMIC_OPTIONS;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function generateUUID() {
    return crypto.randomUUID();
}

function generateOtp() {
    return String(crypto.randomInt(100000, 999999));
}

function getDeviceId() {
    // Deterministic device fingerprint
    const raw = `${os.hostname()}-${os.userInfo().username}-${os.arch()}-${os.platform()}`;
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

function getDeviceName() {
    return `${os.hostname()} (${os.platform()} ${os.arch()})`;
}

// ── Registration ────────────────────────────────────────────────────────────

const REQUIRED_FIELDS = ['fullName', 'email', 'password', 'collegeName', 'rollNumber', 'degree', 'courseName', 'academicLevel', 'phoneNumber'];

function validateRegistration(data) {
    for (const field of REQUIRED_FIELDS) {
        if (!data[field] || !String(data[field]).trim()) {
            return `${field.replace(/([A-Z])/g, ' $1').trim()} is required.`;
        }
    }
    if (data.password.length < 8) return 'Password must be at least 8 characters.';
    if (data.password !== data.confirmPassword) return 'Passwords do not match.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return 'Invalid email format.';
    if (!/^\d{7,15}$/.test(data.phoneNumber.replace(/[\s\-\+]/g, ''))) return 'Invalid phone number.';
    return null;
}

async function registerUser(db, data, isOnline) {
    const email = data.email.toLowerCase().trim();

    // Check duplicate
    const existing = db.getUserByEmail(email);
    if (existing) {
        return { error: 'An account with this email already exists.' };
    }

    // Validate
    const validationError = validateRegistration(data);
    if (validationError) return { error: validationError };

    // Create user
    const userId = generateUUID();
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    db.createUser({
        userId,
        fullName: data.fullName.trim(),
        email,
        collegeName: data.collegeName.trim(),
        rollNumber: data.rollNumber.trim(),
        degree: data.degree.trim(),
        courseName: data.courseName.trim(),
        academicLevel: data.academicLevel.trim(),
        phoneNumber: data.phoneNumber.trim(),
        passwordHash,
    });

    // Register device
    const deviceId = getDeviceId();
    db.createDevice(deviceId, userId, getDeviceName());

    // If online, send verification email
    let verificationMessage = 'Registered locally. Verify your email when online.';
    if (isOnline) {
        const otp = generateOtp();
        db.storeOtp(email, otp, OTP_EXPIRY_MINUTES);
        const mailResult = await sendOtp(email, otp, data.fullName);
        if (mailResult.success) {
            verificationMessage = 'Verification email sent! Check your inbox.';
        } else {
            verificationMessage = 'Registered successfully. Email verification unavailable — you can verify later.';
        }
    }

    // Create session so user is logged in immediately
    const sessionId = generateUUID();
    const expiresAt = Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    db.createSession(sessionId, userId, expiresAt);

    const user = db.getUserByEmail(email);

    return {
        success: true,
        message: verificationMessage,
        token: sessionId,
        user: sanitizeUser(user),
        needsVerification: !user.isVerified,
    };
}

// ── OTP Verification ────────────────────────────────────────────────────────

function verifyOtp(db, email, code) {
    email = email.toLowerCase().trim();
    const otpRecord = db.getValidOtp(email, code);
    if (!otpRecord) return { error: 'Invalid or expired OTP. Please try again.' };

    db.markOtpUsed(otpRecord.id);
    db.markUserVerified(email);

    return { success: true, message: 'Email verified successfully!' };
}

async function resendOtp(db, email) {
    email = email.toLowerCase().trim();
    const user = db.getUserByEmail(email);
    if (!user) return { error: 'No account found with this email.' };
    if (user.isVerified) return { error: 'Account already verified.' };

    const otp = generateOtp();
    db.storeOtp(email, otp, OTP_EXPIRY_MINUTES);
    const mailResult = await sendOtp(email, otp, user.fullName);
    if (!mailResult.success) return { error: mailResult.error };
    return { success: true, message: 'New verification code sent.' };
}

// ── Login ───────────────────────────────────────────────────────────────────

async function loginUser(db, email, password) {
    email = email.toLowerCase().trim();

    const user = db.getUserByEmail(email);
    if (!user) return { error: 'No account found with this email.' };

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return { error: 'Incorrect password.' };

    // Create session
    const sessionId = generateUUID();
    const expiresAt = Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    db.createSession(sessionId, user.userId, expiresAt);

    // Clean up expired sessions
    db.deleteExpiredSessions();

    return {
        success: true,
        token: sessionId,
        user: sanitizeUser(user),
    };
}

// ── Session Middleware ──────────────────────────────────────────────────────

function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required.' });
    }

    const sessionId = header.slice(7);
    const { getDatabase } = require('./database');
    const db = getDatabase();
    if (!db) return res.status(500).json({ error: 'Database not ready.' });

    const session = db.getSession(sessionId);
    if (!session) return res.status(401).json({ error: 'Invalid or expired session.' });

    const user = db.getUserById(session.userId);
    if (!user) return res.status(401).json({ error: 'User not found.' });

    req.user = user;
    req.sessionId = sessionId;
    next();
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function sanitizeUser(user) {
    return {
        userId: user.userId,
        fullName: user.fullName,
        email: user.email,
        collegeName: user.collegeName,
        rollNumber: user.rollNumber,
        degree: user.degree,
        courseName: user.courseName,
        academicLevel: user.academicLevel,
        phoneNumber: user.phoneNumber,
        isVerified: user.isVerified,
        authMode: user.authMode,
    };
}

module.exports = {
    registerUser,
    verifyOtp,
    resendOtp,
    loginUser,
    authMiddleware,
    getAcademicOptions,
    getDeviceId,
};
