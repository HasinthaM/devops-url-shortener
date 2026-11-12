import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import { requestIdMiddleware } from './middlewares/request-id.middleware';
import { apiRateLimiter } from './middlewares/rate-limit.middleware';
import { notFoundMiddleware } from './middlewares/not-found.middleware';
import { errorHandler } from './middlewares/error.middleware';
import { routes } from './routes';

export const createApp = (): Express => {
  const app = express();

  // Reverse proxy support (Docker, Kubernetes Ingress, Nginx)
  app.set('trust proxy', 1);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows Swagger UI to load inline assets
    }),
  );

  // CORS configuration
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-request-id'],
    }),
  );

  // Correlation ID injection
  app.use(requestIdMiddleware);

  // Structured HTTP request logging with correlation ID
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as unknown as { id?: string }).id ?? 'anonymous',
      customLogLevel: (_req, res, err) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      serializers: {
        req: (req) => ({
          id: (req as unknown as { id?: string }).id,
          method: req.method,
          url: req.url,
        }),
      },
    }),
  );

  // Request payload size limitations
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // Global rate limiter
  app.use(apiRateLimiter);

  // Route registration
  app.use(routes);

  // 404 Not Found handler
  app.use(notFoundMiddleware);

  // Centralized Error handler
  app.use(errorHandler);

  return app;
};

