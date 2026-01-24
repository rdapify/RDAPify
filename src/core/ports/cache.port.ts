/**
 * Cache port interface (Dependency Inversion)
 * @module core/ports
 */

import type { RDAPResponse } from '../../shared/types';

/**
 * Cache port - defines contract for cache implementations
 */
export interface ICachePort {
  get(key: string): Promise<RDAPResponse | null>;
  set(key: string, value: RDAPResponse, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  size(): Promise<number>;
}
