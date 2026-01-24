/**
 * Network utilities for IP classification
 * @module utils/validators/network
 */

/**
 * Checks if an IP is in a private range (RFC 1918)
 */
export function isPrivateIP(ip: string): boolean {
  const trimmed = ip.trim();

  // IPv4 private ranges
  if (trimmed.includes('.')) {
    const parts = trimmed.split('.').map((p) => parseInt(p, 10));

    // 10.0.0.0/8
    if (parts[0] === 10) return true;

    // 172.16.0.0/12
    const part1 = parts[1];
    if (parts[0] === 172 && part1 !== undefined && part1 >= 16 && part1 <= 31) return true;

    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;

    return false;
  }

  // IPv6 private ranges
  if (trimmed.includes(':')) {
    const lower = trimmed.toLowerCase();

    // fc00::/7 (Unique Local Addresses)
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;

    // fe80::/10 (Link-Local)
    if (lower.startsWith('fe80:')) return true;

    return false;
  }

  return false;
}

/**
 * Checks if an IP is localhost
 */
export function isLocalhost(ip: string): boolean {
  const trimmed = ip.trim().toLowerCase();

  // IPv4 localhost
  if (trimmed === '127.0.0.1' || trimmed.startsWith('127.')) return true;

  // IPv6 localhost
  if (trimmed === '::1' || trimmed === '0:0:0:0:0:0:0:1') return true;

  return false;
}

/**
 * Checks if an IP is link-local
 */
export function isLinkLocal(ip: string): boolean {
  const trimmed = ip.trim();

  // IPv4 link-local (169.254.0.0/16)
  if (trimmed.includes('.')) {
    const parts = trimmed.split('.').map((p) => parseInt(p, 10));
    if (parts[0] === 169 && parts[1] === 254) return true;
  }

  // IPv6 link-local (fe80::/10)
  if (trimmed.toLowerCase().startsWith('fe80:')) return true;

  return false;
}
