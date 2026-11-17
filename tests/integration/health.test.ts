import request from 'supertest';
import { createApp } from '../../src/app';
import * as dbModule from '../../src/config/database';

describe('Health & Readiness Probes (Integration)', () => {
  const app = createApp();

  describe('GET /health', () => {
    it('should return 200 OK with liveness metadata', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'pass',
        version: '1.0.0',
      });
      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /ready', () => {
    it('should return 200 OK when database connection succeeds', async () => {
      jest.spyOn(dbModule, 'checkDatabaseConnection').mockResolvedValueOnce(true);

      const response = await request(app).get('/ready');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'ready',
        database: 'connected',
      });
    });

    it('should return 503 Service Unavailable when database connection fails', async () => {
      jest.spyOn(dbModule, 'checkDatabaseConnection').mockResolvedValueOnce(false);

      const response = await request(app).get('/ready');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        status: 'not_ready',
        database: 'disconnected',
        error: 'Database connectivity check failed',
      });
    });
  });
});
