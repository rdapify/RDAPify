/**
 * Optional Rust native backend adapter for @rdapify/core.
 *
 * When `@rdapify/core` is installed, the five core query methods are
 * handled by the compiled Rust binary instead of the TypeScript pipeline,
 * yielding significantly lower latency for high-throughput use cases.
 *
 * The adapter is transparent: the responses are normalised to exactly the
 * same TypeScript shapes that the default backend produces.
 *
 * Field mapping (Rust JSON → TypeScript):
 *   meta.source      → metadata.source
 *   meta.queried_at  → metadata.timestamp
 *   meta.cached      → metadata.cached
 *   (none)           → objectClass  (added by this adapter)
 */

import type {
  DomainResponse,
  IPResponse,
  ASNResponse,
  NameserverResponse,
  EntityResponse,
} from '../../shared/types';

// ── Lazy module loader ────────────────────────────────────────────────────────

/** Loose shape of @rdapify/core exports (runtime only). */
interface CoreModule {
  domain(domainName: string): Promise<unknown>;
  ip(ipAddress: string): Promise<unknown>;
  asn(asnValue: string): Promise<unknown>;
  nameserver(hostname: string): Promise<unknown>;
  entity(handle: string, serverUrl: string): Promise<unknown>;
}

let _module: CoreModule | null | undefined; // undefined = not yet attempted

function tryLoadCore(): CoreModule | null {
  if (_module !== undefined) return _module;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _module = require('@rdapify/core') as CoreModule;
  } catch {
    _module = null;
  }
  return _module;
}

/** Returns `true` if `@rdapify/core` is installed and loadable. */
export function isNativeAvailable(): boolean {
  return tryLoadCore() !== null;
}

// ── Response field adapters ───────────────────────────────────────────────────

type Metadata = { source: string; timestamp: string; cached: boolean };

function adaptMeta(raw: Record<string, unknown>): Metadata {
  const meta = (raw['meta'] ?? {}) as Record<string, unknown>;
  return {
    source: (meta['source'] as string) ?? '',
    // Rust serialises ResponseMeta without rename_all → snake_case field name
    timestamp: (meta['queried_at'] as string) ?? '',
    cached: (meta['cached'] as boolean) ?? false,
  };
}

/** Strip `meta` and `objectClass` from raw, keeping all other fields. */
function strippedFields(raw: Record<string, unknown>): Record<string, unknown> {
  const { meta: _meta, objectClass: _oc, ...rest } = raw;
  void _meta;
  void _oc;
  return rest;
}

// ── NativeBackend class ───────────────────────────────────────────────────────

/**
 * Wraps the five `@rdapify/core` functions and adapts their responses to
 * the TypeScript response interfaces.
 */
export class NativeBackend {
  private readonly core: CoreModule;

  private constructor(core: CoreModule) {
    this.core = core;
  }

  /**
   * Creates a `NativeBackend` instance if `@rdapify/core` is available.
   *
   * @param mode - `'auto'` → return null if not installed;
   *               `'native'` → throw if not installed.
   */
  static create(mode: 'auto' | 'native'): NativeBackend | null {
    const core = tryLoadCore();
    if (!core) {
      if (mode === 'native') {
        throw new Error(
          '@rdapify/core is not installed. Run: npm install @rdapify/core\n' +
            'Or use backend: "auto" to fall back to the TypeScript backend.'
        );
      }
      return null;
    }
    return new NativeBackend(core);
  }

  async domain(query: string): Promise<DomainResponse> {
    const raw = (await this.core.domain(query)) as Record<string, unknown>;
    return {
      ...strippedFields(raw),
      objectClass: 'domain',
      metadata: adaptMeta(raw),
    } as DomainResponse;
  }

  async ip(query: string): Promise<IPResponse> {
    const raw = (await this.core.ip(query)) as Record<string, unknown>;
    return {
      ...strippedFields(raw),
      objectClass: 'ip network',
      metadata: adaptMeta(raw),
    } as IPResponse;
  }

  async asn(query: string | number): Promise<ASNResponse> {
    const raw = (await this.core.asn(String(query))) as Record<string, unknown>;
    return {
      ...strippedFields(raw),
      // Rust serialises query as u32; coerce back to string for type consistency
      query: String(raw['query']),
      objectClass: 'autnum',
      metadata: adaptMeta(raw),
    } as ASNResponse;
  }

  async nameserver(query: string): Promise<NameserverResponse> {
    const raw = (await this.core.nameserver(query)) as Record<string, unknown>;
    return {
      ...strippedFields(raw),
      objectClass: 'nameserver',
      metadata: adaptMeta(raw),
    } as NameserverResponse;
  }

  async entity(handle: string, serverUrl: string): Promise<EntityResponse> {
    const raw = (await this.core.entity(handle, serverUrl)) as Record<string, unknown>;
    return {
      ...strippedFields(raw),
      objectClass: 'entity',
      metadata: adaptMeta(raw),
    } as EntityResponse;
  }
}
