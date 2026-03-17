/**
 * Runtime detection utilities
 * @module utils/helpers/runtime
 */

/**
 * Checks if code is running in Node.js environment
 */
export function isNode(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.versions?.node != null
  );
}

/**
 * Checks if code is running in browser environment
 */
export function isBrowser(): boolean {
  return typeof globalThis !== 'undefined' &&
         'window' in globalThis &&
         typeof (globalThis as any).window !== 'undefined';
}

/**
 * Checks if code is running in Deno environment
 */
export function isDeno(): boolean {
  return typeof globalThis !== 'undefined' && 'Deno' in globalThis;
}

/**
 * Checks if code is running in Bun environment
 */
export function isBun(): boolean {
  return typeof globalThis !== 'undefined' && 'Bun' in globalThis;
}

/**
 * Checks if code is running in Cloudflare Workers environment
 */
export function isCloudflareWorkers(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    'caches' in globalThis &&
    typeof (globalThis as any).navigator !== 'undefined' &&
    (globalThis as any).navigator?.userAgent === 'Cloudflare-Workers'
  );
}

/**
 * Gets current runtime environment name
 */
export function getRuntimeName(): string {
  if (isDeno()) return 'Deno';
  if (isBun()) return 'Bun';
  if (isCloudflareWorkers()) return 'Cloudflare Workers';
  if (isNode()) return 'Node.js';
  if (isBrowser()) return 'Browser';
  return 'Unknown';
}
