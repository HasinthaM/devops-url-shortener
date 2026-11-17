import { Request, Response } from 'express';
import { UrlService, urlService } from './url.service';
import { AnalyticsService, analyticsService } from '../analytics/analytics.service';
import { UrlRepository, urlRepository } from './url.repository';
import { NotFoundError } from '../../utils/errors';

export class UrlController {
  constructor(
    private readonly service: UrlService = urlService,
    private readonly analytics: AnalyticsService = analyticsService,
    private readonly repo: UrlRepository = urlRepository,
  ) {}

  /**
   * POST /api/v1/urls
   */
  create = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.createUrl(req.body);
    res.status(201).json({
      success: true,
      data: result,
    });
  };

  /**
   * GET /:shortCode
   * Fast HTTP 302 redirect with decoupled, asynchronous analytics ingestion.
   */
  redirect = async (req: Request, res: Response): Promise<void> => {
    const shortCode = req.params['shortCode'] as string | undefined;
    if (!shortCode) {
      throw new NotFoundError('Missing short code parameter');
    }

    const entity = await this.service.getForRedirect(shortCode);

    // Asynchronous non-blocking analytics ingestion
    this.analytics.recordClickAsync({
      urlId: entity.id,
      referrer: req.get('referrer') ?? null,
      userAgent: req.get('user-agent') ?? null,
    });

    // HTTP 302 Found to prevent aggressive client/browser permanent caching
    res.redirect(302, entity.originalUrl);
  };

  /**
   * GET /api/v1/urls/:shortCode
   */
  getDetails = async (req: Request, res: Response): Promise<void> => {
    const shortCode = req.params['shortCode'] as string | undefined;
    if (!shortCode) {
      throw new NotFoundError('Missing short code parameter');
    }

    const details = await this.service.getUrlDetails(shortCode);
    res.status(200).json({
      success: true,
      data: details,
    });
  };

  /**
   * GET /api/v1/urls/:shortCode/stats
   */
  getStats = async (req: Request, res: Response): Promise<void> => {
    const shortCode = req.params['shortCode'] as string | undefined;
    if (!shortCode) {
      throw new NotFoundError('Missing short code parameter');
    }

    const entity = await this.repo.findByShortCode(shortCode);
    if (!entity) {
      throw new NotFoundError(`Short URL '/${shortCode}' does not exist.`, 'URL_NOT_FOUND');
    }

    const metrics = await this.analytics.getMetrics(entity.id);

    res.status(200).json({
      success: true,
      data: {
        shortCode: entity.shortCode,
        originalUrl: entity.originalUrl,
        totalClicks: metrics.totalClicks,
        isActive: entity.isActive,
        createdAt: entity.createdAt.toISOString(),
        updatedAt: entity.updatedAt.toISOString(),
        expiresAt: entity.expiresAt ? entity.expiresAt.toISOString() : null,
        lastClickedAt: metrics.lastClickedAt ? metrics.lastClickedAt.toISOString() : null,
      },
    });
  };

  /**
   * DELETE /api/v1/urls/:shortCode
   */
  deactivate = async (req: Request, res: Response): Promise<void> => {
    const shortCode = req.params['shortCode'] as string | undefined;
    if (!shortCode) {
      throw new NotFoundError('Missing short code parameter');
    }

    await this.service.deactivateUrl(shortCode);

    res.status(200).json({
      success: true,
      data: {
        message: 'URL has been successfully deactivated.',
        shortCode,
      },
    });
  };
}

export const urlController = new UrlController();
