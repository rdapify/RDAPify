/**
 * PII (Personally Identifiable Information) redactor
 * @module normalizer/PIIRedactor
 */

import type { RDAPResponse, RDAPEntity } from '../../shared/types';
import type { PrivacyOptions } from '../../shared/types/options';

/**
 * Redacts PII from RDAP responses for GDPR/CCPA compliance
 */
export class PIIRedactor {
  private readonly options: Required<PrivacyOptions>;

  constructor(options: PrivacyOptions = {}) {
    this.options = {
      redactPII: options.redactPII ?? true,
      redactFields: options.redactFields || ['email', 'phone', 'fax'],
      redactionText: options.redactionText || '[REDACTED]',
    };
  }

  /**
   * Redacts PII from an RDAP response
   */
  redact<T extends RDAPResponse>(response: T): T {
    if (!this.options.redactPII) {
      return response;
    }

    // Create a deep copy to avoid mutating the original
    const redacted = JSON.parse(JSON.stringify(response)) as T;

    // Redact entities
    if (redacted.entities && Array.isArray(redacted.entities)) {
      redacted.entities = redacted.entities.map((entity) => this.redactEntity(entity));
    }

    return redacted;
  }

  /**
   * Redacts PII from an entity
   */
  private redactEntity(entity: RDAPEntity): RDAPEntity {
    const redacted = { ...entity };

    // Redact vCard data
    if (redacted.vcardArray && Array.isArray(redacted.vcardArray)) {
      redacted.vcardArray = this.redactVCard(redacted.vcardArray);
    }

    // Recursively redact nested entities
    if (redacted.entities && Array.isArray(redacted.entities)) {
      redacted.entities = redacted.entities.map((e) => this.redactEntity(e));
    }

    return redacted;
  }

  /**
   * Redacts PII from vCard data
   */
  private redactVCard(vcardArray: any[]): any[] {
    if (!Array.isArray(vcardArray) || vcardArray.length < 2) {
      return vcardArray;
    }

    const [version, fields] = vcardArray;

    if (!Array.isArray(fields)) {
      return vcardArray;
    }

    const redactedFields = fields.map((field) => {
      if (!Array.isArray(field) || field.length < 4) {
        return field;
      }

      const [fieldName, params, type] = field;

      // Check if this field should be redacted
      if (this.shouldRedactField(fieldName)) {
        return [fieldName, params, type, this.options.redactionText];
      }

      return field;
    });

    return [version, redactedFields];
  }

  /**
   * Checks if a field should be redacted
   */
  private shouldRedactField(fieldName: string): boolean {
    const normalizedName = fieldName.toLowerCase();

    // Check against configured fields
    for (const field of this.options.redactFields) {
      if (normalizedName === field.toLowerCase() || normalizedName.includes(field.toLowerCase())) {
        return true;
      }
    }

    // Additional PII field patterns
    const piiPatterns = [
      'email',
      'tel',
      'phone',
      'fax',
      'adr',
      'address',
      'geo',
      'key',
      'photo',
      'sound',
      'uid',
      'url',
    ];

    return piiPatterns.some(
      (pattern) => normalizedName === pattern || normalizedName.includes(pattern)
    );
  }

  /**
   * Gets redactor configuration
   */
  getConfig(): Required<PrivacyOptions> {
    return { ...this.options };
  }

  /**
   * Checks if PII redaction is enabled
   */
  isEnabled(): boolean {
    return this.options.redactPII;
  }
}
