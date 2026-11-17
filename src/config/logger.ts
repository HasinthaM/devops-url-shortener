import pino from 'pino';
import { env } from './env';

/** pino-pretty is a devDependency; only use it when present (absent in the production image). */
const hasPrettyTransport = (): boolean => {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
};

export const logger = pino({
  level: env.LOG_LEVEL,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-api-key"]',
      'password',
      'secret',
      'adminApiKey',
      'ADMIN_API_KEY',
    ],
    censor: '[REDACTED]',
  },
  transport:
    env.NODE_ENV === 'development' && hasPrettyTransport()
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'SYS:standard',
          },
        }
      : undefined,
});
