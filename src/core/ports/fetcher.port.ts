/**
 * Fetcher port interface (Dependency Inversion)
 * @module core/ports
 */

import type { RawRDAPResponse } from '../../shared/types';

/**
 * Fetcher port - defines contract for HTTP fetcher implementations
 */
export interface IFetcherPort {
  fetch(url: string): Promise<RawRDAPResponse>;
}
