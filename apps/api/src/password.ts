import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { AuthError } from './auth-config.js';
const parameters = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const derive = (password: string, salt: Buffer) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, 64, parameters, (error, key) => error ? reject(error) : resolve(key));
});
export function normalizeUsername(value: unknown): string {
  if (typeof value !== 'string') throw new AuthError('invalid_credentials');
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(username)) throw new AuthError('invalid_credentials');
  return username;
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16); const key = await derive(password, salt);
  return `scrypt-v1$${salt.toString('hex')}$${key.toString('hex')}`;
}
export const generatePassword = () => randomBytes(32).toString('base64url');
export async function verifyPassword(password: unknown, encoded: string | undefined): Promise<boolean> {
  if (typeof password !== 'string' || !password || Buffer.byteLength(password) > 1024) return false;
  const match = encoded?.match(/^scrypt-v1\$([a-f0-9]{32})\$([a-f0-9]{128})$/);
  // Unknown users incur the same bounded derivation; no credential material enters diagnostics.
  const result = await derive(password, Buffer.from(match?.[1] ?? '0'.repeat(32), 'hex'));
  return !!match && timingSafeEqual(result, Buffer.from(match[2]!, 'hex'));
}
