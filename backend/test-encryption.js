const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not defined');
  }
  return crypto.createHash('sha256').update(key).digest();
}

function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

class BadRequestException extends Error {
  constructor(message) {
    super(message);
    this.name = 'BadRequestException';
  }
}

function decrypt(encryptedText) {
  if (!encryptedText) return encryptedText;
  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    throw new BadRequestException('Malformed encrypted token');
  }
  try {
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    throw new BadRequestException('Decryption failed: ' + error.message);
  }
}

// RUN TESTS
console.log('--- STARTING ENCRYPTION ROBUSTNESS TESTS ---');

const testKey = 'super-secret-encryption-key-32ch-long-here';
process.env.ENCRYPTION_KEY = testKey;

// Test 1: Successful encrypt and decrypt
const plainText = 'my-super-secret-facebook-token-123!';
const encrypted = encrypt(plainText);
console.log('Test 1 - Plaintext:', plainText);
console.log('Test 1 - Encrypted:', encrypted);
const decrypted = decrypt(encrypted);
console.log('Test 1 - Decrypted:', decrypted);
if (decrypted === plainText) {
  console.log('Test 1: PASSED (Match)');
} else {
  console.error('Test 1: FAILED');
}

// Test 2: Verify aes-256-cbc is actually used (check IV length and output format)
const parts = encrypted.split(':');
const ivHex = parts[0];
const cipherHex = parts[1];
console.log('Test 2 - IV length in hex (should be 32):', ivHex.length);
if (ivHex.length === 32 && parts.length === 2) {
  console.log('Test 2: PASSED (Format check)');
} else {
  console.error('Test 2: FAILED');
}

// Test 3: What if ENCRYPTION_KEY is missing during encryption?
process.env.ENCRYPTION_KEY = '';
try {
  encrypt(plainText);
  console.error('Test 3: FAILED (Expected throw)');
} catch (e) {
  console.log('Test 3: PASSED (Threw expected error:', e.message, ')');
}
process.env.ENCRYPTION_KEY = testKey; // restore

// Test 4: What if ENCRYPTION_KEY is missing during decryption?
process.env.ENCRYPTION_KEY = '';
try {
  decrypt(encrypted);
  console.error('Test 4: FAILED (Expected throw)');
} catch (e) {
  if (e.message.includes('ENCRYPTION_KEY environment variable is not defined')) {
    console.log('Test 4: PASSED (Threw expected error)');
  } else {
    console.error('Test 4: FAILED (Wrong error message:', e.message, ')');
  }
}
process.env.ENCRYPTION_KEY = testKey; // restore

// Test 5: What if the key changes (wrong key)?
process.env.ENCRYPTION_KEY = 'a-different-encryption-key';
try {
  decrypt(encrypted);
  console.error('Test 5: FAILED (Expected throw)');
} catch (e) {
  if (e.message.includes('Decryption failed:')) {
    console.log('Test 5: PASSED (Threw expected error)');
  } else {
    console.error('Test 5: FAILED (Wrong error message:', e.message, ')');
  }
}
process.env.ENCRYPTION_KEY = testKey; // restore

// Test 6: Malformed ciphertext - no colon
const malformed1 = 'invalidciphertextwithoutcolon';
try {
  decrypt(malformed1);
  console.error('Test 6: FAILED (Expected throw)');
} catch (e) {
  if (e.message === 'Malformed encrypted token') {
    console.log('Test 6: PASSED (Threw expected error)');
  } else {
    console.error('Test 6: FAILED (Wrong error message:', e.message, ')');
  }
}

// Test 7: Malformed ciphertext - multiple colons
const malformed2 = 'abc:def:ghi';
try {
  decrypt(malformed2);
  console.error('Test 7: FAILED (Expected throw)');
} catch (e) {
  if (e.message === 'Malformed encrypted token') {
    console.log('Test 7: PASSED (Threw expected error)');
  } else {
    console.error('Test 7: FAILED (Wrong error message:', e.message, ')');
  }
}

// Test 8: Malformed ciphertext - invalid hex in IV
const malformed3 = 'gghhggiigghhggiigghhggiigghhggii:aabbcc';
try {
  decrypt(malformed3);
  console.error('Test 8: FAILED (Expected throw)');
} catch (e) {
  if (e.message.includes('Decryption failed:')) {
    console.log('Test 8: PASSED (Threw expected error)');
  } else {
    console.error('Test 8: FAILED (Wrong error message:', e.message, ')');
  }
}

console.log('--- ENCRYPTION ROBUSTNESS TESTS COMPLETE ---');
