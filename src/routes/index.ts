import { Router, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { urlRoutes } from '../modules/urls/url.routes';
import { urlController } from '../modules/urls/url.controller';
import { validate } from '../middlewares/validate.middleware';
import { shortCodeParamSchema } from '../modules/urls/url.schema';
import { redirectRateLimiter } from '../middlewares/rate-limit.middleware';
import { asyncHandler } from '../utils/async-handler';
import { checkDatabaseConnection } from '../config/database';
import { swaggerSpec } from '../config/swagger';

export const routes = Router();

/**
 * Liveness probe: verifies process health and event-loop responsiveness.
 */
routes.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'pass',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

/**
 * Readiness probe: actively tests PostgreSQL connectivity.
 */
routes.get(
  '/ready',
  asyncHandler(async (_req: Request, res: Response) => {
    const isDbConnected = await checkDatabaseConnection();
    if (isDbConnected) {
      res.status(200).json({
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        database: 'disconnected',
        error: 'Database connectivity check failed',
        timestamp: new Date().toISOString(),
      });
    }
  }),
);

// Swagger Documentation endpoints
routes.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
routes.get('/docs-json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// API v1 sub-routes
routes.use('/api/v1/urls', urlRoutes);

// Root short URL redirection (GET /:shortCode)
routes.get(
  '/:shortCode',
  redirectRateLimiter,
  validate({ params: shortCodeParamSchema }),
  asyncHandler(urlController.redirect),
);

