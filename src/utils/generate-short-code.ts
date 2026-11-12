import { randomBytes } from 'crypto';

const BASE62_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const BASE = BASE62_CHARS.length; // 62
const MAX_BYTE = 256 - (256 % BASE); // 248 (avoids modulo bias)

/**
 * Generates a cryptographically secure, URL-friendly Base62 random short code.
 * Uses rejection sampling to guarantee a completely uniform distribution.
 *
 * @param length - Length of the short code (default: 7)
 * @returns Base62 short code string
 */
export function generateShortCode(length = 7): string {
  if (length <= 0) {
    throw new Error('Short code length must be greater than zero');
  }

  let result = '';
  while (result.length < length) {
    const bytesNeeded = Math.max((length - result.length) * 2, 8);
    const buffer = randomBytes(bytesNeeded);
    for (let i = 0; i < buffer.length && result.length < length; i++) {
      const byte = buffer[i];
      if (byte !== undefined && byte < MAX_BYTE) {
        result += BASE62_CHARS[byte % BASE];
      }
    }
  }

  return result;
}

