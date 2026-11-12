import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

/**
 * Standard rate limiter for general API endpoints.
 */
export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
      details: null,
    },
  },
});

/**
 * Stricter rate limiter for resource-creation endpoints (e.g. POST /api/v1/urls)
 * to prevent spam and link generation abuse.
 */
export const createUrlRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.CREATE_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'CREATE_RATE_LIMIT_EXCEEDED',
      message: 'Too many URLs created from this IP, please try again later.',
      details: null,
    },
  },
});

/**
 * High-throughput rate limiter for public redirection endpoints.
 */
export const redirectRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS * 5, // 500 requests per minute by default
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'REDIRECT_RATE_LIMIT_EXCEEDED',
      message: 'Too many redirect requests, please try again later.',
      details: null,
    },
  },
});

