/**
 * RFC 7483 Response Validator for RDAP responses
 * @module infrastructure/validation/ResponseValidator
 */

import type { DomainResponse, IPResponse, ASNResponse, RDAPResponse } from '../../shared/types';
import { RDAPifyError } from '../../shared/errors/base.error';

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error';
}

export interface ValidationWarning {
  field: string;
  message: string;
  severity: 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export type ValidationMode = 'strict' | 'lenient' | 'off';

export interface ResponseValidatorOptions {
  /** Validation mode (default: 'lenient') */
  mode?: ValidationMode;
  /** Behavior on violations (default: 'warn') */
  onViolation?: 'throw' | 'warn' | 'ignore';
}

/**
 * Error thrown when onViolation is 'throw' and validation errors are found
 */
export class ResponseValidationError extends RDAPifyError {
  public readonly validationResult: ValidationResult;

  constructor(validationResult: ValidationResult) {
    const errorMessages = validationResult.errors.map((e) => e.message).join('; ');
    super(
      `RDAP response validation failed: ${errorMessages}`,
      'RESPONSE_VALIDATION_ERROR',
      422,
      { errorCount: validationResult.errors.length }
    );
    this.validationResult = validationResult;
  }
}

/**
 * RFC 7483 Response Validator
 */
export class ResponseValidator {
  private readonly mode: ValidationMode;
  private readonly onViolation: 'throw' | 'warn' | 'ignore';

  constructor(options?: ResponseValidatorOptions) {
    this.mode = options?.mode ?? 'lenient';
    this.onViolation = options?.onViolation ?? 'warn';
  }

  /**
   * Validates a domain RDAP response (RFC 7483)
   */
  validateDomain(response: DomainResponse): ValidationResult {
    const result: ValidationResult = { valid: true, errors: [], warnings: [] };

    if (this.mode === 'off') {
      return result;
    }

    // Required: objectClass must be 'domain'
    if (response.objectClass !== 'domain') {
      result.errors.push({
        field: 'objectClass',
        message: `Expected objectClass 'domain', got '${response.objectClass}'`,
        severity: 'error',
      });
    }

    // Required: query must be a non-empty string
    if (!response.query || typeof response.query !== 'string' || response.query.trim() === '') {
      result.errors.push({
        field: 'query',
        message: 'Field "query" must be a non-empty string',
        severity: 'error',
      });
    }

    // Warning: ldhName should be present
    if (response.ldhName === undefined || response.ldhName === null) {
      result.warnings.push({
        field: 'ldhName',
        message: 'Field "ldhName" is recommended for domain responses (RFC 7483 §5.3)',
        severity: 'warning',
      });
    }

    // Warning: status should be an array if present
    if (response.status !== undefined && !Array.isArray(response.status)) {
      result.warnings.push({
        field: 'status',
        message: 'Field "status" should be an array',
        severity: 'warning',
      });
    }

    // Validate events entries
    if (response.events !== undefined) {
      response.events.forEach((event, index) => {
        if (!event.type) {
          result.errors.push({
            field: `events[${index}].type`,
            message: `Event at index ${index} is missing required field "type" (eventAction)`,
            severity: 'error',
          });
        }
        if (!event.date) {
          result.errors.push({
            field: `events[${index}].date`,
            message: `Event at index ${index} is missing required field "date" (eventDate)`,
            severity: 'error',
          });
        }
      });
    }

    // Validate nameservers entries - in normalized form these are strings (ldhNames)
    if (response.nameservers !== undefined) {
      response.nameservers.forEach((ns, index) => {
        if (!ns || typeof ns !== 'string' || ns.trim() === '') {
          result.errors.push({
            field: `nameservers[${index}]`,
            message: `Nameserver at index ${index} must be a non-empty ldhName string`,
            severity: 'error',
          });
        }
      });
    }

    // Validate entities entries
    if (response.entities !== undefined) {
      response.entities.forEach((entity, index) => {
        if (!entity.roles || !Array.isArray(entity.roles)) {
          result.warnings.push({
            field: `entities[${index}].roles`,
            message: `Entity at index ${index} should have a "roles" array`,
            severity: 'warning',
          });
        }
      });
    }

    result.valid = result.errors.length === 0;
    return this.handleResult(result);
  }

  /**
   * Validates an IP network RDAP response (RFC 7483)
   */
  validateIP(response: IPResponse): ValidationResult {
    const result: ValidationResult = { valid: true, errors: [], warnings: [] };

    if (this.mode === 'off') {
      return result;
    }

    // Required: objectClass must be 'ip network'
    if (response.objectClass !== 'ip network') {
      result.errors.push({
        field: 'objectClass',
        message: `Expected objectClass 'ip network', got '${response.objectClass}'`,
        severity: 'error',
      });
    }

    // Warning: startAddress should be present
    if (response.startAddress === undefined || response.startAddress === null) {
      result.warnings.push({
        field: 'startAddress',
        message: 'Field "startAddress" is recommended for IP network responses (RFC 7483 §5.4)',
        severity: 'warning',
      });
    }

    // Warning: endAddress should be present
    if (response.endAddress === undefined || response.endAddress === null) {
      result.warnings.push({
        field: 'endAddress',
        message: 'Field "endAddress" is recommended for IP network responses (RFC 7483 §5.4)',
        severity: 'warning',
      });
    }

    // ipVersion should be 'v4' or 'v6' if present
    if (response.ipVersion !== undefined && response.ipVersion !== 'v4' && response.ipVersion !== 'v6') {
      result.errors.push({
        field: 'ipVersion',
        message: `Field "ipVersion" must be 'v4' or 'v6', got '${response.ipVersion}'`,
        severity: 'error',
      });
    }

    result.valid = result.errors.length === 0;
    return this.handleResult(result);
  }

  /**
   * Validates an ASN RDAP response (RFC 7483)
   */
  validateASN(response: ASNResponse): ValidationResult {
    const result: ValidationResult = { valid: true, errors: [], warnings: [] };

    if (this.mode === 'off') {
      return result;
    }

    // Required: objectClass must be 'autnum'
    if (response.objectClass !== 'autnum') {
      result.errors.push({
        field: 'objectClass',
        message: `Expected objectClass 'autnum', got '${response.objectClass}'`,
        severity: 'error',
      });
    }

    // Warning: startAutnum should be present
    if (response.startAutnum === undefined || response.startAutnum === null) {
      result.warnings.push({
        field: 'startAutnum',
        message: 'Field "startAutnum" is recommended for ASN responses (RFC 7483 §5.5)',
        severity: 'warning',
      });
    }

    result.valid = result.errors.length === 0;
    return this.handleResult(result);
  }

  /**
   * Dispatches validation to the correct type-specific validator
   */
  validate(response: RDAPResponse): ValidationResult {
    if (this.mode === 'off') {
      return { valid: true, errors: [], warnings: [] };
    }

    switch (response.objectClass) {
      case 'domain':
        return this.validateDomain(response as DomainResponse);
      case 'ip network':
        return this.validateIP(response as IPResponse);
      case 'autnum':
        return this.validateASN(response as ASNResponse);
      default: {
        const result: ValidationResult = {
          valid: false,
          errors: [
            {
              field: 'objectClass',
              message: `Unknown objectClass: '${(response as RDAPResponse).objectClass}'`,
              severity: 'error',
            },
          ],
          warnings: [],
        };
        return this.handleResult(result);
      }
    }
  }

  getMode(): ValidationMode {
    return this.mode;
  }

  private handleResult(result: ValidationResult): ValidationResult {
    if (result.errors.length === 0) {
      return result;
    }

    switch (this.onViolation) {
      case 'throw':
        throw new ResponseValidationError(result);
      case 'warn':
        result.errors.forEach((e) => {
          // eslint-disable-next-line no-console
          console.warn(`[RDAPify] Validation error on field "${e.field}": ${e.message}`);
        });
        return result;
      case 'ignore':
        return result;
    }
  }
}
