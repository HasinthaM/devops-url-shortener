import { UrlService } from '../../src/modules/urls/url.service';
import { UrlRepository } from '../../src/modules/urls/url.repository';
import { UrlEntity } from '../../src/modules/urls/url.types';
import { NotFoundError, GoneError, ConflictError } from '../../src/utils/errors';
import { Prisma } from '@prisma/client';

describe('UrlService', () => {
  let mockRepo: jest.Mocked<UrlRepository>;
  let service: UrlService;

  beforeEach(() => {
    mockRepo = {
      create: jest.fn(),
      findByShortCode: jest.fn(),
      findById: jest.fn(),
      deactivateByShortCode: jest.fn(),
    } as unknown as jest.Mocked<UrlRepository>;

    service = new UrlService(mockRepo);
  });

  describe('createUrl', () => {
    it('should create and return a short URL successfully', async () => {
      const mockEntity: UrlEntity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        originalUrl: 'https://example.com',
        shortCode: 'abc1234',
        isActive: true,
        createdAt: new Date('2026-11-04T12:00:00Z'),
        updatedAt: new Date('2026-11-04T12:00:00Z'),
        expiresAt: null,
      };

      mockRepo.create.mockResolvedValueOnce(mockEntity);

      const result = await service.createUrl({ originalUrl: 'https://example.com' });

      expect(mockRepo.create).toHaveBeenCalledTimes(1);
      expect(result.shortCode).toBe('abc1234');
      expect(result.originalUrl).toBe('https://example.com');
      expect(result.shortUrl).toContain('abc1234');
    });

    it('should retry when a collision (Prisma P2002) occurs', async () => {
      const collisionError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.10.1',
      });

      const mockEntity: UrlEntity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        originalUrl: 'https://example.com',
        shortCode: 'success1',
        isActive: true,
        createdAt: new Date('2026-11-04T12:00:00Z'),
        updatedAt: new Date('2026-11-04T12:00:00Z'),
        expiresAt: null,
      };

      mockRepo.create
        .mockRejectedValueOnce(collisionError) // First attempt collision
        .mockResolvedValueOnce(mockEntity); // Second attempt success

      const result = await service.createUrl({ originalUrl: 'https://example.com' });

      expect(mockRepo.create).toHaveBeenCalledTimes(2);
      expect(result.shortCode).toBe('success1');
    });

    it('should throw ConflictError if max retries exceeded', async () => {
      const collisionError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.10.1',
      });

      mockRepo.create.mockRejectedValue(collisionError);

      await expect(service.createUrl({ originalUrl: 'https://example.com' })).rejects.toThrow(
        ConflictError,
      );
      expect(mockRepo.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('getForRedirect', () => {
    it('should return the URL entity if valid and active', async () => {
      const mockEntity: UrlEntity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        originalUrl: 'https://example.com',
        shortCode: 'abc1234',
        isActive: true,
        createdAt: new Date('2026-11-04T12:00:00Z'),
        updatedAt: new Date('2026-11-04T12:00:00Z'),
        expiresAt: null,
      };

      mockRepo.findByShortCode.mockResolvedValueOnce(mockEntity);

      const result = await service.getForRedirect('abc1234');
      expect(result).toEqual(mockEntity);
    });

    it('should throw NotFoundError if code does not exist', async () => {
      mockRepo.findByShortCode.mockResolvedValueOnce(null);

      await expect(service.getForRedirect('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw GoneError if URL is deactivated', async () => {
      const inactiveEntity: UrlEntity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        originalUrl: 'https://example.com',
        shortCode: 'inactive1',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
      };

      mockRepo.findByShortCode.mockResolvedValueOnce(inactiveEntity);

      await expect(service.getForRedirect('inactive1')).rejects.toThrow(GoneError);
    });

    it('should throw GoneError if URL has expired', async () => {
      const expiredEntity: UrlEntity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        originalUrl: 'https://example.com',
        shortCode: 'expired1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() - 10000), // Past
      };

      mockRepo.findByShortCode.mockResolvedValueOnce(expiredEntity);

      await expect(service.getForRedirect('expired1')).rejects.toThrow(GoneError);
    });
  });

  describe('deactivateUrl', () => {
    it('should deactivate active URL', async () => {
      const mockEntity: UrlEntity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        originalUrl: 'https://example.com',
        shortCode: 'active1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
      };

      mockRepo.findByShortCode.mockResolvedValueOnce(mockEntity);
      mockRepo.deactivateByShortCode.mockResolvedValueOnce(true);

      await service.deactivateUrl('active1');
      expect(mockRepo.deactivateByShortCode).toHaveBeenCalledWith('active1');
    });

    it('should throw GoneError if URL is already deactivated', async () => {
      const inactiveEntity: UrlEntity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        originalUrl: 'https://example.com',
        shortCode: 'inactive1',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
      };

      mockRepo.findByShortCode.mockResolvedValueOnce(inactiveEntity);

      await expect(service.deactivateUrl('inactive1')).rejects.toThrow(GoneError);
    });
  });
});
