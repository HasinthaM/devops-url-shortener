import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  // Fail safe: an unset NODE_ENV is treated as production (no stack traces, strict checks).
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z
    .string()
    .default('3000')
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0 && val <= 65535, {
      message: 'PORT must be a valid port number between 1 and 65535',
    }),
  HOST: z.string().default('0.0.0.0'),
  APP_BASE_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGIN: z.string().default('*'),
  // Number of reverse-proxy hops to trust for X-Forwarded-For (0 = none, e.g. directly exposed).
  TRUST_PROXY: z
    .string()
    .default('1')
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val >= 0 && val <= 10, {
      message: 'TRUST_PROXY must be between 0 and 10',
    }),
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .default('60000')
    .transform((val) => parseInt(val, 10)),
  RATE_LIMIT_MAX_REQUESTS: z
    .string()
    .default('100')
    .transform((val) => parseInt(val, 10)),
  CREATE_RATE_LIMIT_MAX: z
    .string()
    .default('20')
    .transform((val) => parseInt(val, 10)),
  ADMIN_API_KEY: z.string().min(32, 'ADMIN_API_KEY must be at least 32 characters long'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

const INSECURE_KEY_PATTERN = /(change-in-production|dev-secret|changeme|password|example)/i;

/** Extra guards that only apply to production deployments. */
const productionGuards = (data: z.infer<typeof envSchema>): string[] => {
  const problems: string[] = [];
  if (data.NODE_ENV !== 'production') return problems;
  if (INSECURE_KEY_PATTERN.test(data.ADMIN_API_KEY)) {
    problems.push(
      'ADMIN_API_KEY looks like a placeholder; set a strong random secret in production.',
    );
  }
  if (data.CORS_ORIGIN.trim() === '*') {
    problems.push("CORS_ORIGIN must be an explicit origin list (not '*') in production.");
  }
  if (new URL(data.APP_BASE_URL).protocol !== 'https:') {
    problems.push('APP_BASE_URL must use https in production.');
  }
  return problems;
};

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error(
      '❌ Environment validation failed:',
      JSON.stringify(result.error.format(), null, 2),
    );
    throw new Error('Invalid environment variables. Check .env configuration.');
  }
  const problems = productionGuards(result.data);
  if (problems.length > 0) {
    console.error(`❌ Insecure production configuration: ${problems.join(' | ')}`);
    throw new Error('Insecure production configuration. See log above.');
  }
  return result.data;
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
