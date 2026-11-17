import request from 'supertest';
import { createApp } from '../../src/app';

describe('Bundled frontend (Integration)', () => {
  const app = createApp();

  it('serves the single-page UI at /', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('Snip');
  });

  it('serves static assets', async () => {
    const js = await request(app).get('/app.js');
    const css = await request(app).get('/styles.css');

    expect(js.status).toBe(200);
    expect(css.status).toBe(200);
  });

  it('applies a strict Content-Security-Policy (no inline scripts)', async () => {
    const response = await request(app).get('/');
    const csp = response.headers['content-security-policy'] as string;

    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("'unsafe-inline'");
  });

  it('does not treat static file names as short codes', async () => {
    const response = await request(app).get('/missing-file.js');

    expect(response.status).toBe(400);
  });
});
