import { isInternalHost } from '../../src/utils/url-safety';

const host = (url: string) => new URL(url).hostname;

describe('isInternalHost', () => {
  it.each([
    'http://localhost',
    'http://foo.localhost',
    'http://127.0.0.1',
    'http://127.0.0.2',
    'http://127.1',
    'http://2130706433',
    'http://0x7f.1',
    'http://0.0.0.0',
    'http://10.1.2.3',
    'http://172.20.0.1',
    'http://192.168.1.1',
    'http://169.254.169.254',
    'http://100.64.0.1',
    'http://[::1]',
    'http://[::]',
    'http://[::ffff:127.0.0.1]',
    'http://[::ffff:10.0.0.1]',
    'http://[fc00::1]',
    'http://[fe80::1]',
    'http://metadata.google.internal',
    'http://service.internal',
  ])('blocks %s', (url) => {
    expect(isInternalHost(host(url))).toBe(true);
  });

  it.each([
    'https://github.com',
    'https://example.com',
    'http://8.8.8.8',
    'http://172.32.0.1',
    'http://[2001:4860:4860::8888]',
  ])('allows %s', (url) => {
    expect(isInternalHost(host(url))).toBe(false);
  });
});
