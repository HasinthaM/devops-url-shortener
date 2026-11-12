import { prisma } from '../../config/database';
import { RecordClickInput } from './analytics.types';

export class AnalyticsRepository {
  /**
   * Persists a single click event to the database.
   */
  async createClick(data: RecordClickInput): Promise<void> {
    await prisma.urlClickAnalytics.create({
      data: {
        urlId: data.urlId,
        referrer: data.referrer ?? null,
        userAgent: data.userAgent ?? null,
      },
    });
  }

  /**
   * Retrieves the aggregate total click count for a given URL.
   */
  async getClickCount(urlId: string): Promise<number> {
    return prisma.urlClickAnalytics.count({
      where: { urlId },
    });
  }

  /**
   * Retrieves the timestamp of the most recent click for a given URL.
   */
  async getLastClickedAt(urlId: string): Promise<Date | null> {
    const lastClick = await prisma.urlClickAnalytics.findFirst({
      where: { urlId },
      orderBy: { clickedAt: 'desc' },
      select: { clickedAt: true },
    });

    return lastClick?.clickedAt ?? null;
  }
}

export const analyticsRepository = new AnalyticsRepository();

