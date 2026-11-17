import request from 'supertest';
import { createApp } from '../../src/app';
import { urlRepository } from '../../src/modules/urls/url.repository';
import { analyticsRepository } from '../../src/modules/analytics/analytics.repository';
import { UrlEntity } from '../../src/modules/urls/url.types';
import { env } from '../../src/config/env';

describe('URL Management & Redirection Endpoints (Integration)', () => {
  const app = createApp();

  const sampleUrl: UrlEntity = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    originalUrl: 'https://github.com/features/actions',
    shortCode: 'ghActions',
    isActive: true,
    createdAt: new Date('2026-11-04T12:00:00Z'),
    updatedAt: new Date('2026-11-04T12:00:00Z'),
    expiresAt: null,
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/v1/urls', () => {
    it('should successfully create a shortened URL', async () => {
      jest.spyOn(urlRepository, 'create').mockResolvedValueOnce(sampleUrl);

      const response = await request(app).post('/api/v1/urls').send({
        originalUrl: 'https://github.com/features/actions',
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        shortCode: sampleUrl.shortCode,
        originalUrl: sampleUrl.originalUrl,
      });
      expect(response.body.data.shortUrl).toContain(sampleUrl.shortCode);
    });

    it('should return 400 when given an invalid URL scheme', async () => {
      const response = await request(app).post('/api/v1/urls').send({
        originalUrl: 'ftp://invalidscheme.com',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when targeting localhost/private IP', async () => {
      const response = await request(app).post('/api/v1/urls').send({
        originalUrl: 'http://localhost:3000/admin',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/urls/:shortCode', () => {
    it('should retrieve URL details for an existing short code', async () => {
      jest.spyOn(urlRepository, 'findByShortCode').mockResolvedValueOnce(sampleUrl);

      const response = await request(app).get(`/api/v1/urls/${sampleUrl.shortCode}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.shortCode).toBe(sampleUrl.shortCode);
      expect(response.body.data.originalUrl).toBe(sampleUrl.originalUrl);
    });

    it('should return 404 for a nonexistent short code', async () => {
      jest.spyOn(urlRepository, 'findByShortCode').mockResolvedValueOnce(null);

      const response = await request(app).get('/api/v1/urls/unknownCode');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('URL_NOT_FOUND');
    });
  });

  describe('GET /:shortCode (Redirection)', () => {
    it('should redirect with HTTP 302 and Location header to original URL', async () => {
      jest.spyOn(urlRepository, 'findByShortCode').mockResolvedValueOnce(sampleUrl);
      const clickSpy = jest.spyOn(analyticsRepository, 'createClick').mockResolvedValueOnce();

      const response = await request(app)
        .get(`/${sampleUrl.shortCode}`)
        .set('User-Agent', 'Jest-Supertest')
        .set('Referer', 'https://google.com');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(sampleUrl.originalUrl);
      expect(clickSpy).toHaveBeenCalled();
    });

    it('should return 410 Gone for deactivated URL', async () => {
      jest.spyOn(urlRepository, 'findByShortCode').mockResolvedValueOnce({
        ...sampleUrl,
        isActive: false,
      });

      const response = await request(app).get(`/${sampleUrl.shortCode}`);

      expect(response.status).toBe(410);
      expect(response.body.error.code).toBe('URL_INACTIVE');
    });

    it('should return 410 Gone for expired URL', async () => {
      jest.spyOn(urlRepository, 'findByShortCode').mockResolvedValueOnce({
        ...sampleUrl,
        expiresAt: new Date(Date.now() - 60000), // Expired 1 min ago
      });

      const response = await request(app).get(`/${sampleUrl.shortCode}`);

      expect(response.status).toBe(410);
      expect(response.body.error.code).toBe('URL_EXPIRED');
    });
  });

  describe('GET /api/v1/urls/:shortCode/stats', () => {
    it('should retrieve URL click statistics', async () => {
      jest.spyOn(urlRepository, 'findByShortCode').mockResolvedValueOnce(sampleUrl);
      jest.spyOn(analyticsRepository, 'getClickCount').mockResolvedValueOnce(42);
      jest
        .spyOn(analyticsRepository, 'getLastClickedAt')
        .mockResolvedValueOnce(new Date('2026-11-04T12:30:00Z'));

      const response = await request(app)
        .get(`/api/v1/urls/${sampleUrl.shortCode}/stats`)
        .set('x-api-key', env.ADMIN_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        shortCode: sampleUrl.shortCode,
        totalClicks: 42,
        isActive: true,
      });
      expect(response.body.data.lastClickedAt).toBe('2026-11-04T12:30:00.000Z');
    });
  });

  describe('DELETE /api/v1/urls/:shortCode', () => {
    it('should reject request with 401 Unauthorized if API key is missing', async () => {
      const response = await request(app).delete(`/api/v1/urls/${sampleUrl.shortCode}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('should reject request with 401 Unauthorized if API key is invalid', async () => {
      const response = await request(app)
        .delete(`/api/v1/urls/${sampleUrl.shortCode}`)
        .set('x-api-key', 'wrong-invalid-key');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should deactivate URL when valid API key is supplied', async () => {
      jest.spyOn(urlRepository, 'findByShortCode').mockResolvedValueOnce(sampleUrl);
      jest.spyOn(urlRepository, 'deactivateByShortCode').mockResolvedValueOnce(true);

      const response = await request(app)
        .delete(`/api/v1/urls/${sampleUrl.shortCode}`)
        .set('x-api-key', env.ADMIN_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('deactivated');
    });
  });
});
