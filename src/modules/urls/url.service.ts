import { Prisma } from '@prisma/client';
import { UrlRepository, urlRepository } from './url.repository';
import { CreateUrlInput, CreateUrlResponseDto, UrlDetailsResponseDto, UrlEntity } from './url.types';
import { UrlMapper } from './url.mapper';
import { generateShortCode } from '../../utils/generate-short-code';
import { NotFoundError, GoneError, ConflictError } from '../../utils/errors';
import { logger } from '../../config/logger';

export class UrlService {
  constructor(private readonly repo: UrlRepository = urlRepository) {}

  /**
   * Creates a shortened URL with collision-resilient retry logic.
   */
  async createUrl(input: CreateUrlInput): Promise<CreateUrlResponseDto> {
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const shortCode = generateShortCode(7);
      try {
        const entity = await this.repo.create({
          originalUrl: input.originalUrl,
          shortCode,
          expiresAt,
        });
        return UrlMapper.toCreateResponse(entity);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          logger.warn({ shortCode, attempt }, 'Short code collision detected. Retrying with new code.');
          if (attempt === maxRetries) {
            throw new ConflictError('Unable to generate a unique short code after multiple attempts. Please retry.');
          }
          continue;
        }
        throw error;
      }
    }

    throw new ConflictError('Failed to generate short code');
  }

  /**
   * Finds and validates a URL for public redirection.
   * Enforces active state and expiration checks.
   */
  async getForRedirect(shortCode: string): Promise<UrlEntity> {
    const entity = await this.repo.findByShortCode(shortCode);

    if (!entity) {
      throw new NotFoundError(`Short URL '/${shortCode}' does not exist.`, 'URL_NOT_FOUND');
    }

    if (!entity.isActive) {
      throw new GoneError('The requested short URL has been deactivated.', 'URL_INACTIVE');
    }

    if (entity.expiresAt && entity.expiresAt.getTime() <= Date.now()) {
      throw new GoneError('The requested short URL has expired.', 'URL_EXPIRED');
    }

    return entity;
  }

  /**
   * Retrieves public URL metadata without sensitive internal identifiers.
   */
  async getUrlDetails(shortCode: string): Promise<UrlDetailsResponseDto> {
    const entity = await this.repo.findByShortCode(shortCode);

    if (!entity) {
      throw new NotFoundError(`Short URL '/${shortCode}' does not exist.`, 'URL_NOT_FOUND');
    }

    return UrlMapper.toDetailsResponse(entity);
  }

  /**
   * Deactivates (soft-deletes) an active short URL.
   */
  async deactivateUrl(shortCode: string): Promise<void> {
    const entity = await this.repo.findByShortCode(shortCode);

    if (!entity) {
      throw new NotFoundError(`Short URL '/${shortCode}' does not exist.`, 'URL_NOT_FOUND');
    }

    if (!entity.isActive) {
      throw new GoneError('The requested short URL is already inactive.', 'URL_ALREADY_INACTIVE');
    }

    await this.repo.deactivateByShortCode(shortCode);
  }
}

export const urlService = new UrlService();

