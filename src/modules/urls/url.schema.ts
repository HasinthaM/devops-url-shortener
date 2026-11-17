import { z } from 'zod';
import { isInternalHost } from '../../utils/url-safety';

export const createUrlSchema = z.object({
  originalUrl: z
    .string({ error: 'originalUrl is required' })
    .trim()
    .url({ message: 'originalUrl must be a valid URL' })
    .max(2048, 'URL must not exceed 2048 characters')
    .refine(
      (val) => {
        try {
          const parsed = new URL(val);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
          return false;
        }
      },
      { message: 'Only http and https protocols are supported' },
    )
    .refine(
      (val) => {
        try {
          const parsed = new URL(val);
          return !isInternalHost(parsed.hostname) && !parsed.username && !parsed.password;
        } catch {
          return false;
        }
      },
      { message: 'Destination URL cannot point to internal hosts or contain embedded credentials' },
    ),
  expiresAt: z
    .string()
    .datetime({ message: 'expiresAt must be a valid ISO 8601 datetime string' })
    .refine((val) => new Date(val).getTime() > Date.now(), {
      message: 'expiresAt must be a future timestamp',
    })
    .nullable()
    .optional(),
});

export const shortCodeParamSchema = z.object({
  shortCode: z
    .string({ error: 'shortCode parameter is required' })
    .trim()
    .min(4, 'shortCode must be at least 4 characters')
    .max(16, 'shortCode must not exceed 16 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'shortCode can only contain alphanumeric characters, underscores, or hyphens',
    ),
});
