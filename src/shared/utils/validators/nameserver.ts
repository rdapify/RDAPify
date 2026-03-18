/**
 * Nameserver hostname validator and normalizer
 * @module utils/validators/nameserver
 */

import { ValidationError } from '../../types/errors';

/**
 * Validates a nameserver hostname.
 * A nameserver must be a valid fully-qualified domain name (FQDN).
 *
 * @param nameserver - Nameserver hostname to validate (e.g., "ns1.example.com")
 * @throws {ValidationError} If the nameserver hostname is invalid
 */
export function validateNameserver(nameserver: string): void {
  if (!nameserver || typeof nameserver !== 'string') {
    throw new ValidationError('Nameserver must be a non-empty string', { nameserver });
  }

  const trimmed = nameserver.trim();

  if (trimmed.length === 0) {
    throw new ValidationError('Nameserver cannot be empty', { nameserver });
  }

  if (trimmed.length > 253) {
    throw new ValidationError('Nameserver hostname exceeds maximum length of 253 characters', {
      nameserver,
      length: trimmed.length,
    });
  }

  // Must contain at least one dot (be a qualified hostname)
  if (!trimmed.includes('.')) {
    throw new ValidationError(
      'Nameserver must be a fully-qualified hostname (e.g., ns1.example.com)',
      { nameserver }
    );
  }

  // Validate each label
  const labels = trimmed.split('.');
  for (const label of labels) {
    if (label.length === 0) {
      throw new ValidationError('Nameserver hostname contains empty label (double dot or leading/trailing dot)', {
        nameserver,
      });
    }
    if (label.length > 63) {
      throw new ValidationError(`Nameserver label "${label}" exceeds maximum length of 63 characters`, {
        nameserver,
        label,
      });
    }
    // Allow alphanumeric and hyphens (not starting/ending with hyphen)
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(label) && !/^[a-zA-Z0-9]$/.test(label)) {
      // Also allow punycode labels (xn--)
      if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(label)) {
        throw new ValidationError(`Nameserver label "${label}" contains invalid characters`, {
          nameserver,
          label,
        });
      }
    }
  }
}

/**
 * Normalizes a nameserver hostname to lowercase.
 *
 * @param nameserver - Nameserver hostname to normalize
 * @returns Normalized nameserver hostname (lowercase)
 */
export function normalizeNameserver(nameserver: string): string {
  return nameserver.trim().toLowerCase();
}
