import { randomBytes, scrypt as _scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(_scrypt);

/**
 * Hashes a plaintext password with a random 16-byte salt using scrypt.
 */
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${Buffer.from(derivedKey).toString('hex')}`;
}

/**
 * Compares a plaintext password against a stored salt:hash string using constant-time comparison.
 */
export async function verifyPassword(password, savedHash) {
  try {
    const [salt, key] = savedHash.split(':');
    if (!salt || !key) return false;
    const derivedKey = await scrypt(password, salt, 64);
    return timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(derivedKey));
  } catch {
    return false;
  }
}

/**
 * Creates SHA-256 hash of a session token for secure database storage.
 */
export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}
