import { prisma } from '../../config/database';
import { RecordClickInput } from './analytics.types';

const MAX_REFERRER_LENGTH = 2048;
const MAX_USER_AGENT_LENGTH = 512;

const truncate = (value: string | null | undefined, max: number): string | null =>
  value ? value.slice(0, max) : null;

export class AnalyticsRepository {
  /**
   * Persists a single click event to the database.
   */
  async createClick(data: RecordClickInput): Promise<void> {
    await prisma.urlClickAnalytics.create({
      data: {
        urlId: data.urlId,
        referrer: truncate(data.referrer, MAX_REFERRER_LENGTH),
        userAgent: truncate(data.userAgent, MAX_USER_AGENT_LENGTH),
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
