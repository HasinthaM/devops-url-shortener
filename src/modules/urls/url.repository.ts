import { prisma } from '../../config/database';
import { UrlEntity } from './url.types';

export class UrlRepository {
  /**
   * Inserts a new shortened URL record into PostgreSQL.
   */
  async create(data: {
    originalUrl: string;
    shortCode: string;
    expiresAt?: Date | null;
  }): Promise<UrlEntity> {
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
  async deactivateByShortCode(shortCode: string): Promise<boolean> {
    // Atomic check-and-set: only flips records that are still active (no read-then-write race).
    const result = await prisma.url.updateMany({
      where: { shortCode, isActive: true },
      data: { isActive: false },
    });
    return result.count > 0;
  }
}

export const urlRepository = new UrlRepository();
