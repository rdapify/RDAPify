/**
 * Enhanced validators with IDN and advanced support
 * @module shared/utils/enhanced-validators
 */

import { ValidationError } from '../errors';

/**
 * Converts IDN (Internationalized Domain Name) to Punycode
 */
export function idnToAscii(domain: string): string {
  try {
    // Use Node.js built-in URL API for punycode conversion
    const url = new URL(`http://${domain}`);
    return url.hostname;
  } catch {
    // Fallback: simple validation
    return domain;
  }
}

/**
 * Converts Punycode to IDN
 */
export function asciiToIdn(domain: string): string {
  try {
    // Decode punycode if present
    if (domain.includes('xn--')) {
      const url = new URL(`http://${domain}`);
      return url.hostname;
    }
    return domain;
  } catch {
    return domain;
  }
}

/**
 * Validates and normalizes IDN domain
 */
export function validateIdnDomain(domain: string): string {
  if (!domain || typeof domain !== 'string') {
    throw new ValidationError('Domain must be a non-empty string', {
      suggestion: 'Provide a valid domain name',
    });
  }

  // Remove whitespace
  domain = domain.trim();

  // Check for invalid characters
  if (/[\s<>]/.test(domain)) {
    throw new ValidationError('Domain contains invalid characters', {
      suggestion: 'Remove spaces and special characters',
    });
  }

  // Convert IDN to ASCII (punycode)
  const asciiDomain = idnToAscii(domain);

  // Validate ASCII domain
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
  
  if (!domainRegex.test(asciiDomain)) {
    throw new ValidationError(`Invalid domain format: ${domain}`, {
      suggestion: 'Provide a valid domain name (e.g., example.com)',
    });
  }

  return asciiDomain.toLowerCase();
}

/**
 * Validates IPv6 with zone ID support
 */
export function validateIpv6WithZone(ip: string): { ip: string; zone?: string } {
  if (!ip || typeof ip !== 'string') {
    throw new ValidationError('IP address must be a non-empty string', {
      suggestion: 'Provide a valid IPv6 address',
    });
  }

  // Check for zone ID (e.g., fe80::1%eth0)
  const zoneMatch = ip.match(/^([0-9a-f:]+)%(.+)$/i);
  
  if (zoneMatch) {
    const ipPart = zoneMatch[1];
    const zonePart = zoneMatch[2];
    
    if (!ipPart || !zonePart) {
      throw new ValidationError(`Invalid IPv6 format: ${ip}`, {
        suggestion: 'Provide a valid IPv6 address',
      });
    }
    
    // Validate IPv6 part
    const ipv6Regex = /^(([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|([0-9a-f]{1,4}:){1,7}:|([0-9a-f]{1,4}:){1,6}:[0-9a-f]{1,4}|([0-9a-f]{1,4}:){1,5}(:[0-9a-f]{1,4}){1,2}|([0-9a-f]{1,4}:){1,4}(:[0-9a-f]{1,4}){1,3}|([0-9a-f]{1,4}:){1,3}(:[0-9a-f]{1,4}){1,4}|([0-9a-f]{1,4}:){1,2}(:[0-9a-f]{1,4}){1,5}|[0-9a-f]{1,4}:((:[0-9a-f]{1,4}){1,6})|:((:[0-9a-f]{1,4}){1,7}|:))$/i;
    
    if (!ipv6Regex.test(ipPart)) {
      throw new ValidationError(`Invalid IPv6 address: ${ipPart}`, {
        suggestion: 'Provide a valid IPv6 address',
      });
    }

    return {
      ip: ipPart.toLowerCase(),
      zone: zonePart,
    };
  }

  // No zone ID, validate as regular IPv6
  const ipv6Regex = /^(([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|([0-9a-f]{1,4}:){1,7}:|([0-9a-f]{1,4}:){1,6}:[0-9a-f]{1,4}|([0-9a-f]{1,4}:){1,5}(:[0-9a-f]{1,4}){1,2}|([0-9a-f]{1,4}:){1,4}(:[0-9a-f]{1,4}){1,3}|([0-9a-f]{1,4}:){1,3}(:[0-9a-f]{1,4}){1,4}|([0-9a-f]{1,4}:){1,2}(:[0-9a-f]{1,4}){1,5}|[0-9a-f]{1,4}:((:[0-9a-f]{1,4}){1,6})|:((:[0-9a-f]{1,4}){1,7}|:))$/i;
  
  if (!ipv6Regex.test(ip)) {
    throw new ValidationError(`Invalid IPv6 address: ${ip}`, {
      suggestion: 'Provide a valid IPv6 address',
    });
  }

  return { ip: ip.toLowerCase() };
}

/**
 * Validates ASN with range support
 */
export function validateAsnRange(asn: string | number): { start: number; end?: number } {
  const asnStr = typeof asn === 'number' ? asn.toString() : asn;

  // Check for range (e.g., "AS15169-AS15200" or "15169-15200")
  const rangeMatch = asnStr.match(/^(?:AS)?(\d+)-(?:AS)?(\d+)$/i);
  
  if (rangeMatch) {
    const startStr = rangeMatch[1];
    const endStr = rangeMatch[2];
    
    if (!startStr || !endStr) {
      throw new ValidationError(`Invalid ASN range format: ${asnStr}`, {
        suggestion: 'Provide a valid ASN range',
      });
    }
    
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);

    // Validate range
    if (start < 0 || start > 4294967295) {
      throw new ValidationError(`Invalid ASN start: ${start}`, {
        suggestion: 'ASN must be between 0 and 4294967295',
      });
    }

    if (end < 0 || end > 4294967295) {
      throw new ValidationError(`Invalid ASN end: ${end}`, {
        suggestion: 'ASN must be between 0 and 4294967295',
      });
    }

    if (start >= end) {
      throw new ValidationError(`Invalid ASN range: start (${start}) must be less than end (${end})`, {
        suggestion: 'Provide a valid ASN range',
      });
    }

    return { start, end };
  }

  // Single ASN
  const asnMatch = asnStr.match(/^(?:AS)?(\d+)$/i);
  
  if (!asnMatch || !asnMatch[1]) {
    throw new ValidationError(`Invalid ASN format: ${asnStr}`, {
      suggestion: 'Provide a valid ASN (e.g., 15169 or AS15169)',
    });
  }

  const asnNumber = parseInt(asnMatch[1], 10);

  if (asnNumber < 0 || asnNumber > 4294967295) {
    throw new ValidationError(`Invalid ASN: ${asnNumber}`, {
      suggestion: 'ASN must be between 0 and 4294967295',
    });
  }

  return { start: asnNumber };
}

/**
 * Detects if a string is an IDN domain
 */
export function isIdnDomain(domain: string): boolean {
  // Check for non-ASCII characters
  return /[^\x00-\x7F]/.test(domain);
}

/**
 * Detects if a string is a punycode domain
 */
export function isPunycodeDomain(domain: string): boolean {
  return domain.includes('xn--');
}

/**
 * Validates email address (for contact information)
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates phone number (basic validation)
 */
export function validatePhone(phone: string): boolean {
  // Remove common formatting characters
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  
  // Check if it's a valid phone number (10-15 digits, optional + prefix)
  const phoneRegex = /^\+?\d{10,15}$/;
  return phoneRegex.test(cleaned);
}

/**
 * Normalizes whitespace in strings
 */
export function normalizeWhitespace(str: string): string {
  return str.trim().replace(/\s+/g, ' ');
}

/**
 * Validates URL format
 */
export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
