import { PrismaClient } from '@prisma/client';
import { logger } from './logger';
import { env } from './env';

declare global {
  // eslint-disable-next-line no-var
  var __prismaInstance: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prismaInstance ||
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? [
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
          ]
        : [{ emit: 'stdout', level: 'error' }],
  });

if (env.NODE_ENV !== 'production') {
  globalThis.__prismaInstance = prisma;
}

/**
 * Validates database connectivity by executing a raw ping query.
 * Used for the /ready readiness probe.
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Database connectivity check failed');
    return false;
  }
}

