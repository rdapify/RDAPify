/**
 * PII Redactor port interface (Dependency Inversion)
 * @module core/ports
 */

import type { RDAPResponse } from '../../shared/types';

/**
 * PII Redactor port - defines contract for PII redaction implementations
 */
export interface IPIIRedactorPort {
  redact<T extends RDAPResponse>(response: T): T;
  isEnabled(): boolean;
}
