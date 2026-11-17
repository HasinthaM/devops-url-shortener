import { AnalyticsRepository, analyticsRepository } from './analytics.repository';
import { RecordClickInput } from './analytics.types';
import { logger } from '../../config/logger';

export class AnalyticsService {
  constructor(private readonly repo: AnalyticsRepository = analyticsRepository) {}

  /**
   * Asynchronously records a click event in a non-blocking execution path.
   * Ensures that slow database writes or transient issues never degrade redirect latency.
   * Extensible for future Redis queue, Kafka, or RabbitMQ ingestion.
   */
  recordClickAsync(data: RecordClickInput): void {
    // Fire and forget; do not await
    this.repo.createClick(data).catch((error) => {
      logger.error(
        {
          err: error,
          urlId: data.urlId,
        },
        'Failed to record click analytics asynchronously',
      );
    });
  }

  /**
   * Retrieves aggregated click count and last click time.
   */
  async getMetrics(urlId: string): Promise<{ totalClicks: number; lastClickedAt: Date | null }> {
    const [totalClicks, lastClickedAt] = await Promise.all([
      this.repo.getClickCount(urlId),
      this.repo.getLastClickedAt(urlId),
    ]);

    return { totalClicks, lastClickedAt };
  }
}

export const analyticsService = new AnalyticsService();
