/**
 * Domain validation utilities
 * @module utils/validators/domain
 */

import { ValidationError } from '../../types/errors';

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
 * Normalizes a domain name (lowercase, trim, remove trailing dot)
 */
export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/\.$/, '');
}
