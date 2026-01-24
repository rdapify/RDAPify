/**
 * IP address validation utilities
 * @module utils/validators/ip
 */

import { ValidationError } from '../../types/errors';

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
 * Normalizes an IP address
 */
export function normalizeIP(ip: string): string {
  return ip.trim().toLowerCase();
}
