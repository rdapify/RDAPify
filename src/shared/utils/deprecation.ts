/**
 * Deprecation utilities for RDAPify.
 *
 * Uses `process.emitWarning` (Node.js) with `DeprecationWarning` type in
 * Node.js environments, and falls back to `console.warn` in other runtimes
 * (Deno, Bun, Cloudflare Workers, browser).
 *
 * @module shared/utils/deprecation
 */

/** Set of already-emitted deprecation codes (prevents duplicate warnings). */
const emitted = new Set<string>();

/**
 * Emits a deprecation warning at most once per process / runtime lifetime.
 *
 * @param name        Name of the deprecated symbol (e.g. `'client.getBatchProcessor'`)
 * @param alternative Human-readable replacement suggestion.
 * @param code        Stable deprecation code (e.g. `'DEP0001'`). Used to de-duplicate warnings.
 *
 * @example
 * ```typescript
 * function myOldMethod() {
 *   deprecated('myOldMethod', 'Use myNewMethod() instead', 'DEP_RDAPIFY_0001');
 *   return myNewMethod();
 * }
 * ```
 */
export function deprecated(name: string, alternative?: string, code?: string): void {
  const depCode = code ?? `DEP_RDAPIFY_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;

  // Emit at most once per code
  if (emitted.has(depCode)) return;
  emitted.add(depCode);

  const msg = alternative
    ? `${name} is deprecated and will be removed in a future major release. Use ${alternative} instead.`
    : `${name} is deprecated and will be removed in a future major release.`;

  if (
    typeof process !== 'undefined' &&
    typeof (process as unknown as Record<string, unknown>)['emitWarning'] === 'function'
  ) {
    process.emitWarning(msg, { type: 'DeprecationWarning', code: depCode });
  } else {
    // Fallback for Deno / Bun / CF Workers / browser
    // eslint-disable-next-line no-console
    console.warn(`[rdapify DeprecationWarning] ${depCode}: ${msg}`);
  }
}

/**
 * Resets the deprecation warning tracker.
 * Only useful in tests — **do not call in production code**.
 *
 * @internal
 */
export function _resetDeprecationState(): void {
  emitted.clear();
}
