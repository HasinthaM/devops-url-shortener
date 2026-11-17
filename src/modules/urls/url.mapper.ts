import { env } from '../../config/env';
import { UrlEntity, CreateUrlResponseDto, UrlDetailsResponseDto } from './url.types';

export class UrlMapper {
  static toCreateResponse(entity: UrlEntity): CreateUrlResponseDto {
    return {
      shortCode: entity.shortCode,
      shortUrl: `${env.APP_BASE_URL}/${entity.shortCode}`,
      originalUrl: entity.originalUrl,
      createdAt: entity.createdAt.toISOString(),
      expiresAt: entity.expiresAt ? entity.expiresAt.toISOString() : null,
    };
  }

  static toDetailsResponse(entity: UrlEntity): UrlDetailsResponseDto {
    return {
      shortCode: entity.shortCode,
      shortUrl: `${env.APP_BASE_URL}/${entity.shortCode}`,
      originalUrl: entity.originalUrl,
      isActive: entity.isActive,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      expiresAt: entity.expiresAt ? entity.expiresAt.toISOString() : null,
    };
  }
}
