/**
 * Input validation utilities
 * @module utils/validators
 */

import { ValidationError } from '../types/errors';

/**
 * Validates a domain name
 */
export function validateDomain(domain: string): void {
  if (!domain || typeof domain !== 'string') {
    throw new ValidationError('Domain must be a non-empty string');
  }

  const trimmed = domain.trim().toLowerCase();

  if (trimmed.length === 0) {
    throw new ValidationError('Domain cannot be empty');
  }

  if (trimmed.length > 253) {
    throw new ValidationError('Domain name too long (max 253 characters)');
  }

  // Basic domain validation regex
  const domainRegex =
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

  if (!domainRegex.test(trimmed)) {
    throw new ValidationError(`Invalid domain format: ${domain}`);
  }

  // Check for invalid characters
  if (/[^a-z0-9.-]/i.test(trimmed)) {
    throw new ValidationError(`Domain contains invalid characters: ${domain}`);
  }

  // Check for consecutive dots
  if (/\.\./.test(trimmed)) {
    throw new ValidationError(`Domain contains consecutive dots: ${domain}`);
  }

  // Check for leading/trailing dots or hyphens
  if (/^[.-]|[.-]$/.test(trimmed)) {
    throw new ValidationError(`Domain cannot start or end with dot or hyphen: ${domain}`);
  }
}

/**
 * Validates an IPv4 address
 */
export function validateIPv4(ip: string): void {
  if (!ip || typeof ip !== 'string') {
    throw new ValidationError('IP address must be a non-empty string');
  }

  const trimmed = ip.trim();
  const parts = trimmed.split('.');

  if (parts.length !== 4) {
    throw new ValidationError(`Invalid IPv4 format: ${ip}`);
  }

  for (const part of parts) {
    const num = parseInt(part, 10);

    if (isNaN(num) || num < 0 || num > 255) {
      throw new ValidationError(`Invalid IPv4 octet: ${part} in ${ip}`);
    }

    // Check for leading zeros (except for "0" itself)
    if (part.length > 1 && part[0] === '0') {
      throw new ValidationError(`IPv4 octet cannot have leading zeros: ${part} in ${ip}`);
    }
  }
}

/**
 * Validates an IPv6 address
 */
export function validateIPv6(ip: string): void {
  if (!ip || typeof ip !== 'string') {
    throw new ValidationError('IP address must be a non-empty string');
  }

  const trimmed = ip.trim().toLowerCase();

  // Basic IPv6 validation regex
  const ipv6Regex =
    /^(([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|([0-9a-f]{1,4}:){1,7}:|([0-9a-f]{1,4}:){1,6}:[0-9a-f]{1,4}|([0-9a-f]{1,4}:){1,5}(:[0-9a-f]{1,4}){1,2}|([0-9a-f]{1,4}:){1,4}(:[0-9a-f]{1,4}){1,3}|([0-9a-f]{1,4}:){1,3}(:[0-9a-f]{1,4}){1,4}|([0-9a-f]{1,4}:){1,2}(:[0-9a-f]{1,4}){1,5}|[0-9a-f]{1,4}:((:[0-9a-f]{1,4}){1,6})|:((:[0-9a-f]{1,4}){1,7}|:)|fe80:(:[0-9a-f]{0,4}){0,4}%[0-9a-z]+|::(ffff(:0{1,4})?:)?((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9])|([0-9a-f]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9]))$/;

  if (!ipv6Regex.test(trimmed)) {
    throw new ValidationError(`Invalid IPv6 format: ${ip}`);
  }
}

/**
 * Validates an IP address (IPv4 or IPv6)
 */
export function validateIP(ip: string): 'v4' | 'v6' {
  if (!ip || typeof ip !== 'string') {
    throw new ValidationError('IP address must be a non-empty string');
  }

  const trimmed = ip.trim();

  // Try IPv4 first
  if (trimmed.includes('.')) {
    validateIPv4(trimmed);
    return 'v4';
  }

  // Try IPv6
  if (trimmed.includes(':')) {
    validateIPv6(trimmed);
    return 'v6';
  }

  throw new ValidationError(`Invalid IP address format: ${ip}`);
}

/**
 * Validates an ASN (Autonomous System Number)
 */
export function validateASN(asn: string | number): number {
  let asnNumber: number;

  if (typeof asn === 'string') {
    // Remove "AS" prefix if present
    const cleaned = asn.trim().replace(/^AS/i, '');
    asnNumber = parseInt(cleaned, 10);
  } else if (typeof asn === 'number') {
    asnNumber = asn;
  } else {
    throw new ValidationError('ASN must be a string or number');
  }

  if (isNaN(asnNumber)) {
    throw new ValidationError(`Invalid ASN format: ${asn}`);
  }

  // ASN range: 0 to 4294967295 (32-bit)
  if (asnNumber < 0 || asnNumber > 4294967295) {
    throw new ValidationError(`ASN out of valid range (0-4294967295): ${asnNumber}`);
  }

  return asnNumber;
}

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

/**
 * Normalizes a domain name (lowercase, trim, remove trailing dot)
 */
export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/\.$/, '');
}

/**
 * Normalizes an IP address
 */
export function normalizeIP(ip: string): string {
  return ip.trim().toLowerCase();
}

/**
 * Normalizes an ASN
 */
export function normalizeASN(asn: string | number): string {
  const asnNumber = validateASN(asn);
  return `AS${asnNumber}`;
}
