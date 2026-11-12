import { z } from 'zod';

const DISALLOWED_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '169.254.169.254']);

function isPrivateIpOrHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (DISALLOWED_HOSTNAMES.has(lower)) {
    return true;
  }
  // 10.0.0.0/8
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(lower)) return true;
  // 192.168.0.0/16
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(lower)) return true;
  // 172.16.0.0/12 (172.16.x.x - 172.31.x.x)
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(lower)) return true;
  // Link-local
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(lower)) return true;

  return false;
}

export const createUrlSchema = z.object({
  originalUrl: z
    .string({ required_error: 'originalUrl is required' })
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
          return !isPrivateIpOrHost(parsed.hostname);
        } catch {
          return false;
        }
      },
      { message: 'Destination URL cannot point to internal or loopback hosts' },
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
    .string({ required_error: 'shortCode parameter is required' })
    .trim()
    .min(4, 'shortCode must be at least 4 characters')
    .max(16, 'shortCode must not exceed 16 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'shortCode can only contain alphanumeric characters, underscores, or hyphens'),
});

