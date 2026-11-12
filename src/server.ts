import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/database';

const app = createApp();

const server = app.listen(env.PORT, env.HOST, () => {
  logger.info(
    {
      port: env.PORT,
      host: env.HOST,
      environment: env.NODE_ENV,
      baseUrl: env.APP_BASE_URL,
    },
    `🚀 Server listening at ${env.APP_BASE_URL}`,
  );
  logger.info(`📚 Swagger documentation available at ${env.APP_BASE_URL}/docs`);
});

// Graceful Shutdown Handler (Kubernetes pod lifecycle / SIGTERM / SIGINT)
const gracefulShutdown = (signal: string) => {
  logger.info({ signal }, 'Graceful shutdown signal received. Closing active HTTP connections...');

  server.close(async () => {
    logger.info('HTTP server closed.');

    try {
      await prisma.$disconnect();
      logger.info('Database connection pool disconnected.');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during database disconnection.');
      process.exit(1);
    }
  });

  // Force shutdown after timeout if graceful close hangs
  setTimeout(() => {
    logger.error('Forcefully terminating process due to shutdown timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled Promise Rejection detected');
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception detected');
  process.exit(1);
});

