const crypto = require('crypto');

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGIT = '0123456789';
const SPECIAL = '!@#$%^&*()-_=+[]{}';
const ALL = UPPER + LOWER + DIGIT + SPECIAL;

function pick(charset) {
  const index = crypto.randomInt(0, charset.length);
  return charset[index];
}

function shuffle(chars) {
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars;
}

function generateTemporaryPassword(length = 14) {
  const safeLength = Math.max(12, Number(length) || 12);
  const chars = [pick(UPPER), pick(LOWER), pick(DIGIT), pick(SPECIAL)];

  while (chars.length < safeLength) {
    chars.push(pick(ALL));
  }

  return shuffle(chars).join('');
}

module.exports = {
  generateTemporaryPassword,
};
