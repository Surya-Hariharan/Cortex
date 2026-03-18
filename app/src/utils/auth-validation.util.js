const { badRequest } = require('./http-error.util');

const FULL_NAME_REGEX = /^[A-Za-z ]+$/;
const PHONE_REGEX = /^\d{10}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validateEmail(email) {
  const value = normalizeEmail(email);
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (!ok) {
    throw badRequest('Enter a valid email address', { field: 'email', code: 'INVALID_EMAIL' });
  }
  return value;
}

function validatePasswordPolicy(password) {
  const value = String(password || '');
  if (!PASSWORD_REGEX.test(value)) {
    throw badRequest(
      'Password must be at least 8 characters and include uppercase, lowercase, number and special character',
      { field: 'password', code: 'WEAK_PASSWORD' }
    );
  }
  return value;
}

function validateSignupPayload(payload) {
  const fullName = String(payload.full_name || '').trim();
  const phoneNumber = String(payload.phone_number || '').trim();
  const password = String(payload.password || '');
  const confirmPassword = String(payload.confirm_password || '');
  const email = validateEmail(payload.email);

  if (!fullName) {
    throw badRequest('Full name is required', { field: 'full_name', code: 'REQUIRED' });
  }
  if (!FULL_NAME_REGEX.test(fullName)) {
    throw badRequest('Full name must contain only alphabets and spaces', {
      field: 'full_name',
      code: 'INVALID_FULL_NAME',
    });
  }

  if (!PHONE_REGEX.test(phoneNumber)) {
    throw badRequest('Phone number must be exactly 10 digits', {
      field: 'phone_number',
      code: 'INVALID_PHONE_NUMBER',
    });
  }

  validatePasswordPolicy(password);

  if (password !== confirmPassword) {
    throw badRequest('Passwords do not match', {
      field: 'confirm_password',
      code: 'PASSWORD_MISMATCH',
    });
  }

  return {
    full_name: fullName,
    email,
    phone_number: phoneNumber,
    password,
  };
}

module.exports = {
  normalizeEmail,
  validateEmail,
  validatePasswordPolicy,
  validateSignupPayload,
  FULL_NAME_REGEX,
  PHONE_REGEX,
  PASSWORD_REGEX,
};
