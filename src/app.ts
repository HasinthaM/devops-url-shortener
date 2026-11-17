import path from 'path';
import express, { Express, RequestHandler } from 'express';
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
  // Hop count is configurable; set TRUST_PROXY=0 when the app is exposed directly.
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');

  // Security headers. A strict CSP protects the bundled frontend (scripts/styles only from 'self').
  // Swagger UI (/docs, non-production only) needs inline assets, so it gets helmet without CSP.
  const strictHelmet: RequestHandler = helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'"],
        'style-src': ["'self'"],
        'img-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
        'upgrade-insecure-requests': env.NODE_ENV === 'production' ? [] : null,
      },
    },
  });
  const docsHelmet: RequestHandler = helmet({ contentSecurityPolicy: false });
  app.use((req, res, next) =>
    req.path.startsWith('/docs') ? docsHelmet(req, res, next) : strictHelmet(req, res, next),
  );

  // CORS configuration
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-request-id'],
    }),
  );

  // Static frontend (public/). Short codes never contain dots, so files can't collide with them.
  // Resolves to the project root from both src/ (tsx, ts-jest) and dist/ (compiled).
  app.use(
    express.static(path.join(__dirname, '..', 'public'), {
      index: 'index.html',
      maxAge: env.NODE_ENV === 'production' ? '1h' : 0,
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

  // Rate limit the management API only; public redirects use their own (higher) limiter.
  app.use('/api', apiRateLimiter);

  // Route registration
  app.use(routes);

  // 404 Not Found handler
  app.use(notFoundMiddleware);

  // Centralized Error handler
  app.use(errorHandler);

  return app;
};
