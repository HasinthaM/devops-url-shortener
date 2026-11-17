import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../utils/errors';
import { env } from '../config/env';
import { createHash, timingSafeEqual } from 'crypto';

/** Constant-time comparison (hashing equalizes length so nothing leaks via timing). */
const safeEqual = (a: string, b: string): boolean =>
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

/**
 * Authentication middleware for administrative and management endpoints.
 * Validates 'x-api-key' or 'Authorization: Bearer <token>' against the configured ADMIN_API_KEY.
 * Extensible for future multi-tenant JWT user authentication.
 */
export const requireApiKey = (req: Request, _res: Response, next: NextFunction): void => {
  const headerKey = req.headers['x-api-key'];
  const authHeader = req.headers.authorization;

  let providedKey: string | undefined;

  if (typeof headerKey === 'string' && headerKey.trim() !== '') {
    providedKey = headerKey.trim();
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    providedKey = authHeader.substring(7).trim();
  }

  if (!providedKey) {
    throw new UnauthorizedError(
      'Authentication required: Missing API key or bearer token',
      'AUTH_REQUIRED',
    );
  }

  if (!safeEqual(providedKey, env.ADMIN_API_KEY)) {
    throw new UnauthorizedError('Invalid API key or credentials provided', 'INVALID_CREDENTIALS');
  }

  next();
};
