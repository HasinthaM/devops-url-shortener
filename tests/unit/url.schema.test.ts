import { createUrlSchema, shortCodeParamSchema } from '../../src/modules/urls/url.schema';

describe('URL Schema Validation', () => {
  describe('createUrlSchema', () => {
    it('should accept valid HTTPS URLs', () => {
      const result = createUrlSchema.safeParse({
        originalUrl: 'https://example.com/test?query=param',
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid HTTP URLs', () => {
      const result = createUrlSchema.safeParse({
        originalUrl: 'http://example.com/blog',
      });
      expect(result.success).toBe(true);
    });

    it('should reject non-HTTP protocols (e.g. ftp, javascript, file)', () => {
      const ftpResult = createUrlSchema.safeParse({
        originalUrl: 'ftp://files.example.com',
      });
      expect(ftpResult.success).toBe(false);

      const jsResult = createUrlSchema.safeParse({
        originalUrl: 'javascript:alert(1)',
      });
      expect(jsResult.success).toBe(false);
    });

    it('should reject localhost and private IP addresses (SSRF prevention)', () => {
      const hosts = [
        'http://localhost:8080',
        'http://127.0.0.1/admin',
        'http://0.0.0.0',
        'http://169.254.169.254/latest/meta-data',
        'http://10.0.0.1',
        'http://192.168.1.1',
        'http://172.16.0.1',
      ];

      hosts.forEach((host) => {
        const result = createUrlSchema.safeParse({ originalUrl: host });
        expect(result.success).toBe(false);
      });
    });

    it('should accept future expiration timestamps', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const result = createUrlSchema.safeParse({
        originalUrl: 'https://example.com',
        expiresAt: futureDate,
      });
      expect(result.success).toBe(true);
    });

    it('should reject past expiration timestamps', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const result = createUrlSchema.safeParse({
        originalUrl: 'https://example.com',
        expiresAt: pastDate,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('shortCodeParamSchema', () => {
    it('should accept valid short codes', () => {
      const result = shortCodeParamSchema.safeParse({ shortCode: 'aB9xQ2z' });
      expect(result.success).toBe(true);
    });

    it('should reject short codes that are too short (< 4 chars)', () => {
      const result = shortCodeParamSchema.safeParse({ shortCode: 'abc' });
      expect(result.success).toBe(false);
    });

    it('should reject short codes with special characters', () => {
      const result = shortCodeParamSchema.safeParse({ shortCode: 'bad$code!' });
      expect(result.success).toBe(false);
    });
  });
});
