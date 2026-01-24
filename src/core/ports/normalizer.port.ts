/**
 * Normalizer port interface (Dependency Inversion)
 * @module core/ports
 */

import type { RawRDAPResponse, RDAPResponse } from '../../shared/types';

/**
 * Normalizer port - defines contract for response normalizer implementations
 */
export interface INormalizerPort {
  normalize(
    raw: RawRDAPResponse,
    query: string,
    source: string,
    cached: boolean,
    includeRaw: boolean
  ): RDAPResponse;
}
