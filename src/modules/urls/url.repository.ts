import { prisma } from '../../config/database';
import { UrlEntity } from './url.types';

export class UrlRepository {
  /**
   * Inserts a new shortened URL record into PostgreSQL.
   */
  async create(data: { originalUrl: string; shortCode: string; expiresAt?: Date | null }): Promise<UrlEntity> {
    return prisma.url.create({
      data: {
        originalUrl: data.originalUrl,
        shortCode: data.shortCode,
        expiresAt: data.expiresAt ?? null,
      },
    });
  }

  /**
   * Retrieves a URL record by its unique shortCode.
   */
  async findByShortCode(shortCode: string): Promise<UrlEntity | null> {
    return prisma.url.findUnique({
      where: { shortCode },
    });
  }

  /**
   * Retrieves a URL record by primary key UUID.
   */
  async findById(id: string): Promise<UrlEntity | null> {
    return prisma.url.findUnique({
      where: { id },
    });
  }

  /**
   * Soft-deactivates an active URL record.
   */
  async deactivateByShortCode(shortCode: string): Promise<UrlEntity> {
    return prisma.url.update({
      where: { shortCode },
      data: { isActive: false },
    });
  }
}

export const urlRepository = new UrlRepository();

