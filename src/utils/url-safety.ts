import { isIP } from 'net';

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain', '.home.arpa'];
const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal']);

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map(Number) as [number, number, number, number];
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

// [network, prefix length]
const BLOCKED_IPV4_RANGES: Array<[string, number]> = [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local / cloud metadata
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved + broadcast
];

function isBlockedIPv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  return BLOCKED_IPV4_RANGES.some(([network, prefix]) => {
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (value & mask) === (ipv4ToInt(network) & mask);
  });
}

/** Expands any valid IPv6 literal into 8 numeric 16-bit groups. */
function expandIPv6(ip: string): number[] {
  let address = ip;
  // Convert a trailing dotted IPv4 part into two hex groups.
  const lastColon = address.lastIndexOf(':');
  const tail = address.slice(lastColon + 1);
  if (tail.includes('.')) {
    const n = ipv4ToInt(tail);
    address = `${address.slice(0, lastColon + 1)}${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }

  const [head = '', rest] = address.split('::');
  const headGroups = head ? head.split(':') : [];
  const restGroups = rest !== undefined && rest !== '' ? rest.split(':') : [];
  const missing = rest === undefined ? 0 : 8 - headGroups.length - restGroups.length;
  const groups = [...headGroups, ...Array<string>(Math.max(missing, 0)).fill('0'), ...restGroups];
  return groups.map((g) => parseInt(g, 16));
}

function isBlockedIPv6(ip: string): boolean {
  const g = expandIPv6(ip);
  if (g.length !== 8 || g.some((x) => Number.isNaN(x))) return true; // fail closed

  const first = g[0] as number;
  const allZeroUntil = (n: number) => g.slice(0, n).every((x) => x === 0);

  if (allZeroUntil(7) && (g[7] === 0 || g[7] === 1)) return true; // :: and ::1
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast

  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible/NAT64 (64:ff9b::/96) addresses
  const embedsIPv4 =
    (allZeroUntil(5) && g[5] === 0xffff) ||
    (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0));
  if (embedsIPv4) {
    const v4 = `${(g[6] as number) >> 8}.${(g[6] as number) & 0xff}.${(g[7] as number) >> 8}.${(g[7] as number) & 0xff}`;
    return isBlockedIPv4(v4);
  }

  return false;
}

/**
 * Returns true when the hostname (as produced by `new URL().hostname`) is a loopback,
 * private, link-local, reserved or otherwise internal destination.
 * The WHATWG URL parser already normalizes decimal/hex/octal IPv4 forms (e.g. 2130706433 -> 127.0.0.1).
 */
export function isInternalHost(hostname: string): boolean {
  const host = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');

  const ipVersion = isIP(host);
  if (ipVersion === 4) return isBlockedIPv4(host);
  if (ipVersion === 6) return isBlockedIPv6(host);

  if (BLOCKED_HOSTNAMES.has(host)) return true;
  return BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}
