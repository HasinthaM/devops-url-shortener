import { Router } from 'express';
import { urlController } from './url.controller';
import { validate } from '../../middlewares/validate.middleware';
import { createUrlSchema, shortCodeParamSchema } from './url.schema';
import { createUrlRateLimiter } from '../../middlewares/rate-limit.middleware';
import { requireApiKey } from '../../middlewares/auth.middleware';
import { asyncHandler } from '../../utils/async-handler';

export const urlRoutes = Router();

/**
 * @openapi
 * /api/v1/urls:
 *   post:
 *     summary: Create a shortened URL
 *     tags: [URLs]
 */
urlRoutes.post(
  '/',
  createUrlRateLimiter,
  validate({ body: createUrlSchema }),
  asyncHandler(urlController.create),
);

/**
 * @openapi
 * /api/v1/urls/{shortCode}:
 *   get:
 *     summary: Retrieve URL metadata
 *     tags: [URLs]
 */
urlRoutes.get(
  '/:shortCode',
  validate({ params: shortCodeParamSchema }),
  asyncHandler(urlController.getDetails),
);

/**
 * @openapi
 * /api/v1/urls/{shortCode}/stats:
 *   get:
 *     summary: Retrieve URL click statistics
 *     tags: [URLs]
 */
urlRoutes.get(
  '/:shortCode/stats',
  validate({ params: shortCodeParamSchema }),
  asyncHandler(urlController.getStats),
);

/**
 * @openapi
 * /api/v1/urls/{shortCode}:
 *   delete:
 *     summary: Deactivate a short URL
 *     tags: [URLs]
 */
urlRoutes.delete(
  '/:shortCode',
  requireApiKey,
  validate({ params: shortCodeParamSchema }),
  asyncHandler(urlController.deactivate),
);

