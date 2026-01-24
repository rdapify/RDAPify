/**
 * ASN validation utilities
 * @module utils/validators/asn
 */

import { ValidationError } from '../../types/errors';

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
 * Normalizes an ASN
 */
export function normalizeASN(asn: string | number): string {
  const asnNumber = validateASN(asn);
  return `AS${asnNumber}`;
}
