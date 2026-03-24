# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.2] - 2026-03-24

### Fixed
- `TelemetryExporter`: `RDAPIFY_VERSION` now dynamically read from `package.json`
  instead of hardcoded `'0.2.3'` — OTLP spans now report the correct library version
- `src/index.ts`: JSDoc `@version` corrected to `0.3.2` (was `0.3.0`)
- `VERSION` export updated to `'0.3.2'`
- Cloud templates (`aws_lambda`, `azure_functions`, `google_cloud_run`) and
  `express_app` example updated from `^0.1.0-alpha.4` to `^0.3.1`
- `SECURITY.md`: Supported versions updated — 0.2.x and 0.3.x now listed as active

### Internal
- `prepublishOnly` hook restored — all npm publishes now run `verify`
  (lint + typecheck + test + build + API snapshot check)
- `docs.yml`: removed `|| true` fallbacks that silently hid link-check and
  markdownlint failures

## [1.0.0] - planned February 2027

### Summary
API freeze release. `RDAPClient` interface is stable and guaranteed not to
have breaking changes in subsequent 1.x releases. All 83 public exports are
classified in `API_STABILITY_ANALYSIS.md`.

### Highlights
- **Branch coverage**: ≥ 90% (1066 tests).
- **API freeze**: 83 exports locked; all deprecated APIs removed.
- **Runtime support**: Node.js (confirmed), Bun/Deno/Cloudflare Workers (verified externally).
- **Security Audit**: all critical/high findings resolved (requires external audit completion).
- **Documentation**: complete Arabic and English docs at rdapify.com.

### Breaking Changes (from 0.3.1)
All APIs marked `@deprecated` in v0.3.1 are removed in v1.0.0.
See `MIGRATION_1_0.md` (to be published with release).

## [0.3.1] - unreleased

### Deprecated

The following APIs are deprecated as of v0.3.1 and will be removed or changed in v1.0.0.
Migration paths are listed. Warnings are emitted via `process.emitWarning` (Node.js)
or `console.warn` (other runtimes) at most once per process lifetime.

| API | Deprecation Code | Migration |
|-----|-----------------|-----------|
| `client.getBatchProcessor()` | `DEP_RDAPIFY_0001` | Use `client.streamBatch()` for streaming results, or call `processBatch()` via the batch processor. In v1.0.0, `processBatch()` will be a direct method on `RDAPClient`. |

### Added

- **API Stability Analysis** — `API_STABILITY_ANALYSIS.md` in the internal planning directory classifies all 83 public exports as Stable / Evolving / Deprecated for the v1.0.0 API freeze; details migration paths for each deprecated API
- **`BrowserFetcher`** — browser-compatible RDAP fetcher that routes requests through a developer-supplied CORS-enabled reverse proxy; uses only Web-standard APIs (`fetch`, `AbortSignal`, `URLSearchParams`); enables rdapify in React, Vue, Angular, and vanilla browser environments
- **`BrowserFetcherOptions`** type — `{ proxyUrl: string; timeout?: number; headers?: Record<string, string> }`

### Changed

- `BatchProcessor` class JSDoc updated to reflect its evolving status; direct class imports should prefer `client.streamBatch()` or the convenience methods added in v1.0.0
- Fixed unhandled promise rejection in `BatchProcessor.processBatch()` when `continueOnError: false` — `.finally()` on the inner promise was creating a dangling rejected promise; replaced with `.then(cleanup, cleanup)` to safely remove completed items from the in-progress list

### Coverage

- Branch coverage increased to **80.25%** (above the 80% jest threshold) by adding targeted tests for previously uncovered branches across `Logger`, `MetricsCollector`, `nestjs.ts`, `nameserver.ts`, `express.ts`, `BatchProcessor`, and `QueryPriority` modules

## [0.3.0] - unreleased

### Added

- **Streaming batch API** — `client.streamBatch(requests, options?)` is an async generator that yields `BatchQueryResult` items as each query completes; processes queries in concurrency-bounded chunks so at most `concurrency` (default 5) requests are ever in-flight simultaneously; suitable for 1000+ query sets with no memory overflow; `continueOnError: true` by default isolates per-query failures; exports new `StreamBatchOptions` type
- **Prometheus exporter** — `PrometheusExporter` converts internal `MetricsCollector` data to the [Prometheus text-based exposition format v0.0.4](https://prometheus.io/docs/instrumenting/exposition_formats/); supports custom metric prefix, constant labels, and `createHttpHandler()` which returns a request handler compatible with Node.js, Express, and Fastify; `PrometheusExporter.CONTENT_TYPE` constant provides the correct `Content-Type` header value
- **Grafana dashboard template** — `RDAPIFY_GRAFANA_DASHBOARD` is a ready-to-import Grafana dashboard JSON with panels for total queries, success rate, cache hit rate, average response time, P50/P90/P99 latency percentiles, queries by type, and error breakdown by error type
- **OpenTelemetry OTLP trace exporter** — `TelemetryExporter` ships RDAP query spans to any OTLP/HTTP JSON endpoint (Jaeger, Grafana Tempo, Honeycomb, etc.); zero `@opentelemetry/sdk-node` dependency — uses Web-standard `fetch`; `client.startSpan()` / `client.endSpan()` API; enabled via `ClientConfig.telemetry.endpoint`; errors silently swallowed to avoid disrupting query path
- **Multi-region bootstrap** — `BootstrapOptions.regions?: Array<'us' | 'eu' | 'ap'>` configures preferred regional IANA bootstrap mirror order; `BootstrapDiscovery` tries each regional URL in order and falls back to the primary IANA endpoint on network failure; duplicate URLs (same region mapping) are de-duplicated automatically
- **Deprecation warning utility** — `deprecated(name, alternative?, code?)` emits a Node.js `DeprecationWarning` via `process.emitWarning` (or `console.warn` in Deno/Bun/CF Workers); each unique `code` is emitted at most once per process lifetime; `_resetDeprecationState()` available for tests
- **`TelemetryOptions` type exported** — new configuration interface in `RDAPClientOptions.telemetry`
- **42 new unit tests**: streaming batch (10), Prometheus exporter (10), TelemetryExporter (9), deprecation (7), multi-region bootstrap (5)
- **API snapshot updated** — 82 exported symbols

## [0.2.3] - unreleased

### Added

- **GraphQL integration** — `createRdapifySchema(client)` returns a `{ typeDefs, resolvers }` object compatible with graphql-yoga, Apollo Server, and any standards-compliant GraphQL runtime; no `graphql` peer dependency required at import time; exports `RDAPIFY_TYPE_DEFS` (SDL string) and `RdapifyResolvers` type
  - `Query.domain(name: String!)` — resolves `ldhName`, `registrar` (flattened to name string), `status`, `expiresAt`, `createdAt`, `updatedAt` (dates extracted from `events[]`)
  - `Query.ip(address: String!)` — resolves `country`, `name`, `startAddress`, `endAddress`, `status`
  - `Query.asn(number: String!)` — resolves `name`, `status`, `startAutnum`, `endAutnum`
- **Express.js integration** — `rdapifyExpress(client, router?)` registers `GET /domain/:name`, `GET /ip/:address`, `GET /asn/:number` routes on any Express-compatible router; when no router is provided, creates a `MinimalRouter` (duck-typed; no `express` peer dependency required); errors are returned as `{ error: string }` with status 500
- **NestJS integration** — `RdapifyModule.forRoot(options?)` returns a NestJS-compatible `DynamicModule` that provides `RDAPClient` via the `RDAPIFY_CLIENT_TOKEN` symbol; `@InjectRdapClient()` is a `ParameterDecorator` factory that marks constructor parameters for injection; zero `@nestjs/common` dependency
- **24 new unit tests**: GraphQL schema (9), Express routes (8), NestJS module + decorator (7)
- **7 new public exports**: `createRdapifySchema`, `RDAPIFY_TYPE_DEFS`, `RdapifyResolvers` (type), `rdapifyExpress`, `MinimalRouter`, `RouterLike` (type), `RequestLike` (type), `ResponseLike` (type), `RdapifyModule`, `InjectRdapClient`, `RDAPIFY_CLIENT_TOKEN`, `RdapifyModuleOptions` (type), `RdapifyDynamicModule` (type)
- **API snapshot updated** — 78 exported symbols

## [0.2.2] - unreleased

### Added

- **Deno Support** — `DenoFetcher` implements `IFetcherPort` using the Web-standard `fetch` built into Deno; `RDAPClient` auto-selects `DenoFetcher` when `isDeno()` is true; uses no Node.js-specific APIs
- **Cloudflare Workers Support** — `CloudflareWorkersFetcher` implements `IFetcherPort` for the Edge runtime; zero Node.js-specific code (`require`, `process`, `Buffer`, `fs` are absent from the implementation); `RDAPClient` auto-selects it when `isCloudflareWorkers()` is true
- **Subpath exports** — `package.json` now exports `./node`, `./deno`, and `./worker` subpath conditions; all currently point to the main bundle (auto-detection handles runtime selection internally)
- **Priority order** — fetcher auto-selection order: Cloudflare Workers → Deno → Bun → Node.js (standard `Fetcher`)
- **22 new unit tests**: DenoFetcher (9 tests), CloudflareWorkersFetcher (13 tests)

## [0.2.1] - unreleased

### Added

- **Bun Runtime Support** — `BunFetcher` implements `IFetcherPort` using `Bun.fetch` when running under the Bun runtime; `RDAPClient` auto-detects Bun via `isBun()` and selects `BunFetcher` automatically — no configuration needed
- **`BunFetcher` exported** — available for direct instantiation when custom Bun-specific setups are required; accepts `timeout`, `userAgent`, `headers`, and `ssrfProtection` options
- **CI Bun job** — `.github/workflows/ci.yml` now includes a `test-bun` job that installs dependencies with `bun install` and runs the unit test suite under Bun
- **14 unit tests** for `BunFetcher`: `resolveFetch()` detection (Bun present / absent / non-function), successful fetch, header forwarding, custom headers, 4xx/5xx → `RDAPServerError`, timeout → `TimeoutError`, generic error → `NetworkError`, SSRF protection integration, Bun.fetch preference over global fetch

## [0.2.0] - unreleased

### Added

- **Circuit Breaker** — `CircuitBreaker` class with full state machine: `closed → open → half-open → closed/open`; configurable `failureThreshold`, `successThreshold`, `halfOpenTimeout`, `window`; exported as `CircuitBreaker`, `CircuitOpenError`, `CircuitState`, `CircuitBreakerOptions`
- **Middleware abort** — `ctx.abort()` in any `beforeQuery` hook now stops the query pipeline; `MiddlewareManager.runBeforeQuery()` returns `Promise<boolean>` (true = aborted); aborted queries throw `QueryAbortedError`
- **Middleware priority ordering** — `manager.use(hooks, priority)` registers hooks at a specific priority level (lower number = runs first); multiple hooks for the same lifecycle event run in priority order; hooks registered without a priority use the existing merge/override behaviour
- **Redis key compression** — `RedisCacheOptions.keyMaxLength` (default 200); keys longer than the threshold are hashed to a SHA-256 hex digest before being stored in Redis; prevents oversized key errors
- **Redis pipeline** — `RedisCache.getMany(keys)` batch-retrieves multiple responses using `mget` when available, falling back to individual `get` calls; `RedisCache.setMany(entries)` batch-stores multiple responses
- **HTTP/2 opt-in** — `RDAPClientOptions.http2: boolean` (default `false`); when `true`, the fetcher sets `Upgrade: h2c` and `HTTP2-Settings` headers to signal HTTP/2 preference to supporting registries
- **`QueryAbortedError`** exported from public API
- **63 new unit tests**: circuit breaker state transitions (14), middleware abort + priority (14), Redis key compression + pipeline (17), HTTP/2 (5), middleware hooks compatibility fix (2)

## [0.1.9] - unreleased

### Added

- **Domain Availability Check** — `client.checkAvailability(domain): Promise<AvailabilityResult>` parses the RDAP response to determine if a domain is registered; returns `available: true` when the registry responds with HTTP 404, and extracts `expiresAt` from the RDAP expiration event when available
- **Batch Availability Check** — `client.checkAvailabilityBatch(domains[]): Promise<Map<string, AvailabilityResult>>` checks multiple domains in parallel and returns a Map keyed by domain name
- **`AvailabilityResult` type** exported from the public API: `{ domain: string; available: boolean; expiresAt?: Date }`
- **Live Integration Tests** — `npm run test:live` (requires `LIVE_TESTS=1`); tests Verisign (.com/.net), ARIN (IPv4), RIPE (European IPv4), and ASN 15169; excluded from regular `npm test`; `.github/workflows/live-tests.yml` runs weekly on Sunday
- **Advanced Bootstrap Configuration** — new `bootstrap` option on `RDAPClientOptions`:
  - `bootstrap.customServers: { tld: string; url: string }[]` — custom RDAP endpoints per TLD; take priority over IANA, no network call needed
  - `bootstrap.ttl: number` — override the default 24-hour bootstrap cache TTL (in seconds)
  - `bootstrap.fallback: boolean` — set to `false` to disable IANA lookup entirely (useful for private registries); default `true`
- **`BootstrapOptions` type** exported from the public API
- 17 unit tests for the new features (8 availability + 9 bootstrap advanced)

## [0.1.8] - 2026-03-21

### Added

- **Rust native backend** — when `rdapify-nd` (optional peer dependency) is installed, the five core query methods (`domain`, `ip`, `asn`, `nameserver`, `entity`) are dispatched to a compiled Rust binary, reducing per-call overhead for high-throughput scenarios
- **`backend` option** on `RDAPClientOptions`: `'auto'` (default — uses native if available, falls back to TypeScript silently), `'native'` (requires `rdapify-nd`, throws at construction if absent), `'typescript'` (always uses the TypeScript pipeline regardless of what is installed)
- **`isNativeAvailable()`** utility — runtime detection of whether `rdapify-nd` is installed and loadable
- **`NativeBackend`** class exported for advanced use cases (direct access to the adapter)
- **28 unit tests** added for the NativeBackend adapter: field mapping (`meta`→`metadata`, `queried_at`→`timestamp`), `objectClass` injection, numeric ASN coercion, and module-absent fallback

### Notes

- The native backend bypasses the TypeScript pipeline (middleware hooks, rate limiting, audit logging, deduplication); best suited for latency-sensitive, high-throughput scenarios where those features are not required
- Response shapes are fully compatible: the adapter normalises Rust snake_case fields to match TypeScript interfaces exactly

## [0.1.7] - 2026-03-19

### Fixed

- **Playground deployment**: `website/static/playground-app/app.js` was out of sync with `playground/public/app.js`; domains returning HTTP 404 now correctly show "Domain Available" instead of an error
- **Jest forceExit**: Added `forceExit: true` to `jest.config.js` to prevent CI hangs caused by open Redis async handles
- **redis-cache tests**: Updated tests to match `scanAll()`/`keys()` implementation instead of the removed `dbSize()`/`flushDb()` approach

### Added

- **Nameserver queries**: New `client.nameserver(hostname)` method for querying nameserver RDAP data
  - Automatic server discovery via IANA DNS TLD bootstrap
  - Returns `NameserverResponse` with `ldhName`, `ipAddresses`, `status`, `entities`, `events`
  - Full support for caching, middleware hooks, metrics, deduplication, and PII redaction
- **Entity queries**: New `client.entity(handle, serverUrl)` method for querying RDAP entity data
  - Returns `EntityResponse` with `handle`, `vcardArray`, `roles`, `status`, `entities`, `events`
  - Requires explicit `serverUrl` (no global IANA bootstrap exists for entities)
  - Full support for caching, middleware hooks, metrics, and deduplication
- **CLI commands extended**:
  - `rdapify nameserver <hostname>` — query nameserver RDAP data
  - `rdapify entity <handle> --server <url>` — query entity RDAP data
  - New `--server <url>` flag for specifying RDAP server URL
- **New response types**: `NameserverResponse` and `EntityResponse` exported from main entry point
- **New validators exported**: `validateNameserver`, `normalizeNameserver`, `validateEntityHandle`, `normalizeEntityHandle`
- **Normalizer extended**: Handles `nameserver` and `entity` objectClassName values from raw RDAP responses
- **BootstrapDiscovery extended**: New `discoverNameserver()` method using DNS TLD bootstrap

## [0.1.6] - 2026-03-17

### Added

- **isCloudflareWorkers()**: New runtime detection function for Cloudflare Workers environment
- **CLI Tool**: New `rdapify` CLI command with zero external dependencies
  - `rdapify domain <name>` — query domain RDAP data
  - `rdapify ip <addr>` — query IP RDAP data
  - `rdapify asn <num>` — query ASN RDAP data
  - Flags: `--json`, `--no-cache`, `--timeout`

### Fixed

- **RedisCache.clear() (Critical)**: Previously called `flushDb()` which wiped the entire Redis database; now only deletes keys matching the configured prefix using SCAN
- **RedisCache.size() (Critical)**: Previously used `dbSize()` returning total DB size; now counts only prefixed keys accurately
- **RedisCache SCAN (Performance)**: Replaced blocking `KEYS` command with non-blocking `SCAN` iteration; added `scanAll()` private helper; added optional `scan?()` to `RedisClientLike` interface; removed unused `flushDb?()` and `dbSize?()` from interface
- **runtime.ts (Compatibility)**: `isNode()` wrapped with `typeof process !== 'undefined'` guard to prevent `ReferenceError` in Cloudflare Workers

## [0.1.5] - 2026-03-14

### Added

- **RedisCache**: Redis adapter with peer-dependency pattern, compatible with ioredis and node-redis v4+
- **AuthenticationManager**: Support for Bearer tokens, API keys, Basic auth, and OAuth2
- **ProxyManager**: HTTP/HTTPS/SOCKS proxy support for RDAP requests
- **CompressionManager**: gzip/deflate/brotli compression for requests/responses
- **PersistentCache**: File-system backed cache that survives process restarts
- **MiddlewareManager**: Full lifecycle hooks — `beforeQuery`, `afterQuery`, `onError`, `onCacheHit`
- **QueryDeduplicator**: Collapses in-flight duplicate queries into a single upstream request
- **AuditLogger**: GDPR/SOC2-compliant audit trail with `InMemoryAuditAdapter` and `FileAuditAdapter`
- **ResponseValidator**: RFC 7483 response validation with strict and lenient modes
- All new classes exported from main entry point

## [0.1.4] - 2026-03-13

### Added

- **MiddlewareHooks**: Middleware hooks system (`src/application/hooks/MiddlewareHooks.ts`)
- **QueryDeduplicator**: Initial implementation (`src/application/deduplication/QueryDeduplicator.ts`)
- **AuditLogger**: Initial implementation (`src/infrastructure/logging/AuditLogger.ts`)
- **ResponseValidator**: RFC 7483 compliance validation (`src/infrastructure/validation/ResponseValidator.ts`)

### Changed

- **TypeScript strict mode**: Enabled and enforced strict mode improvements across the codebase
- **Generic types**: Enhanced type safety in `src/shared/types/generics.ts`
- **QueryPriority**: Improved type safety in `src/application/services/QueryPriority.ts`
- **BatchProcessor**: Improved type safety in `src/application/services/BatchProcessor.ts`

### Testing

- Additional test coverage for edge cases across existing and new modules

## [0.1.3] - 2026-03-12

### Fixed

- **Normalizer.ts**: Added defensive null checks for nameserver extraction
  - Handle null/undefined nameservers array entries
  - Filter out empty string nameserver names
  - Prevent crashes on malformed nameserver data

- **Normalizer.ts**: Added defensive null checks for registrar extraction
  - Validate vcardArray length before accessing elements
  - Validate fnField array length before accessing index 3
  - Handle missing registrar name gracefully

- **BootstrapDiscovery.ts**: Added NaN validation for ASN range parsing
  - Skip malformed ASN range patterns that parse to NaN
  - Prevent silent failures in ASN discovery

- **Fetcher.ts**: Added URL validation for redirects
  - Catch and report invalid redirect URLs
  - Prevent SSRF bypass through malformed redirect URLs

- **ConnectionPool.ts**: Added timeout for connection acquisition
  - Prevent infinite wait when all connections are in use
  - Add configurable timeout parameter to acquire()
  - Default timeout of 5 seconds

- **PIIRedactor.ts**: Improved deep copy with structuredClone
  - Use structuredClone for proper deep copying
  - Handle Date, Map, Set, and circular references
  - Fallback to JSON.parse for non-serializable values

- **SSRFProtection.ts**: Added IPv6 bracket handling
  - Strip brackets from IPv6 addresses before validation
  - Support both bracketed and non-bracketed IPv6 formats

- **MetricsCollector.ts**: Added division by zero protection
  - Guard against division by zero in avgResponseTime calculation
  - Return 0 for empty metrics instead of Infinity

### Security

- **SSRFProtection.ts**: Improved IPv6 zone ID handling
  - Extract zone ID before IP validation
  - Validate IP without zone ID for SSRF checks

### Performance

- **ConnectionPool.ts**: Added timeout parameter to acquire()
  - Prevent deadlocks in high-concurrency scenarios
  - Allow configurable timeout per request

### Testing

- Added 15+ new test cases for edge cases
- Added tests for Normalizer defensive checks
- Added tests for ConnectionPool timeout handling
- Added tests for MetricsCollector edge cases
- Added tests for SSRFProtection IPv6 handling

## [0.1.2] - 2026-01-27

### Added
- **Interactive Playground**: Try-before-install experience for rdapify.com
  - Client ID management with localStorage persistence
  - Real-time quota tracking (remainingToday, resetAt)
  - 429 rate limit handling with retry hints
  - Multiple package manager support (npm, yarn, pnpm)
  - Integrated into website navigation
  - Production-ready documentation and testing guides
- **Connection Pooling**: HTTP connection reuse for 30-40% performance improvement
  - Configurable max connections per host
  - Automatic idle connection cleanup
  - Keep-alive support for persistent connections
- **Metrics & Monitoring**: Comprehensive query metrics tracking
  - Success/failure rates and response times
  - Cache hit/miss statistics
  - Query type distribution (domain/IP/ASN)
  - Error type tracking
  - Time-based filtering and analysis
- **Request/Response Logging**: Detailed logging system with multiple levels
  - Configurable log levels (debug, info, warn, error)
  - Request/response logging with timing
  - Cache operation logging
  - Performance metrics logging
  - JSON and text output formats
  - Log filtering and export capabilities
- **Client API Extensions**: New methods for monitoring and debugging
  - `getMetrics()`: Get query metrics summary
  - `getConnectionPoolStats()`: Get connection pool statistics
  - `getLogger()`: Access logger instance
  - `getLogs()`: Retrieve recent logs
  - `clearAll()`: Clear all caches, metrics, and logs
  - `destroy()`: Clean up resources

### Changed
- Updated website navigation to include Playground link
- Enhanced documentation for production deployment
- **QueryOrchestrator**: Integrated logging and metrics collection into all query methods
- **RDAPClient**: Added connection pool, metrics collector, and logger initialization

### Fixed
- ESLint errors in Logger.ts and enhanced-validators.ts (6 issues resolved)

### Tests
- Added comprehensive test suites for new features:
  - `connection-pool.test.ts`: 9 tests covering connection management
  - `metrics-collector.test.ts`: 11 tests covering metrics tracking
  - `logger.test.ts`: 18 tests covering logging functionality

## [0.1.1] - 2026-01-25

### Added
- **Authentication Support**: Multiple authentication methods for RDAP servers
  - Basic Authentication (username/password)
  - Bearer Token authentication
  - API Key authentication (custom header support)
  - OAuth2 authentication with token expiration checking
  - Secure header generation without exposing credentials
- **Proxy Support**: HTTP/HTTPS/SOCKS proxy configuration
  - Support for HTTP, HTTPS, SOCKS4, and SOCKS5 protocols
  - Proxy authentication (username/password)
  - Bypass list with wildcard pattern matching
  - Proxy URL generation with credential encoding
- **Response Compression**: Automatic compression/decompression
  - Support for gzip, brotli, and deflate compression
  - Automatic Accept-Encoding header generation
  - Automatic response decompression
  - Compression statistics and ratio calculation
  - Configurable compression threshold
- **Retry Strategies**: Advanced retry logic with circuit breaker pattern
  - Exponential, linear, and fixed backoff strategies
  - Exponential backoff with jitter to prevent thundering herd
  - Circuit breaker pattern for failing services
  - Configurable retry based on error type and status code
  - Half-open state for gradual recovery
- **Query Prioritization**: Priority queue system for managing query execution
  - High, normal, and low priority levels
  - Configurable concurrency control
  - Automatic queue processing
  - Queue statistics and monitoring
- **Enhanced Validation**: Improved input validation with international support
  - IDN (Internationalized Domain Names) support with punycode conversion
  - IPv6 with zone ID support (e.g., fe80::1%eth0)
  - ASN range validation (e.g., AS15169-AS15200)
  - Email and phone number validation
  - URL validation
- **Persistent Cache**: Cache that survives application restarts
  - File-based and memory-based storage
  - Automatic save intervals
  - TTL and max size enforcement
  - LRU eviction policy
  - Cache statistics and cleanup
- **Rate Limiting**: Token bucket rate limiter with multi-key support and auto-cleanup
- **Batch Processing**: Efficient concurrent processing of multiple RDAP queries
- **Enhanced Error Handling**: Errors now include suggestions, timestamps, and user-friendly messages
- **Generic Types**: Type-safe query functions with automatic result type inference
- **Tree Shaking Support**: Modular exports for smaller bundle sizes

### Changed
- **Exports**: Added new exports for all Phase 1–3 features in index.ts
- **Error Classes**: All errors now include `suggestion`, `timestamp`, and `getUserMessage()` method
- **RateLimitError**: Added `retryAfter` field to indicate when to retry
- **Package Exports**: Added modular exports for errors, types, and validators
- **TypeScript Config**: Optimized for better tree shaking and smaller output
- Standardized Node.js version to v20 across all GitHub Actions workflows
- Updated all workflows to use `node-version-file: .nvmrc` for consistency
- Improved npm caching in CI/CD workflows for faster builds
- Added `NODE_ENV: production` to website build workflow

### Fixed
- Fixed prism-react-renderer theme import in Docusaurus configuration
- Fixed MDX compilation errors caused by unescaped `<` and `>` characters in markdown tables
- Fixed self-closing HTML tags (`<br>` → `<br/>`) in documentation
- Fixed deprecated GitHub Actions (upload-artifact@v3 → v4, actions/create-release → softprops/action-gh-release)
- Fixed empty workflow file (examples.yml)
- Fixed missing sidebars.js configuration
- Removed empty pages causing build failures

### Tests
- Added comprehensive test suites:
  - `authentication-manager.test.ts`: 17 tests covering all auth methods
  - `proxy-manager.test.ts`: 16 tests covering proxy configuration
  - `compression-manager.test.ts`: 19 tests covering compression/decompression
  - `retry-strategy.test.ts`: 13 tests covering retry logic and circuit breaker
  - `query-priority.test.ts`: 8 tests covering priority queue functionality
  - `enhanced-validators.test.ts`: 21 tests covering validation enhancements
  - `persistent-cache.test.ts`: 13 tests covering persistent storage
  - PIIRedactor, CacheManager, and RateLimiter: 37+ new tests

### Performance
- **Retry Strategies**: Intelligent retry reduces failed requests
- **Query Prioritization**: Critical queries execute first
- **Persistent Cache**: Faster startup with pre-loaded cache

## [0.1.0] - 2025-01-25

### Added
- Initial public release of RDAPify
- Core RDAP client with domain, IP, and ASN query support
- Automatic RDAP server discovery via IANA Bootstrap
- SSRF protection with proper CIDR matching for IPv4 and IPv6
- PII redaction for GDPR/CCPA compliance
- In-memory caching with configurable TTL
- Data normalization for consistent response format
- Comprehensive TypeScript types and interfaces
- Input validation for domains, IPs, and ASNs
- Retry logic with configurable backoff strategies
- Interactive playground for testing RDAP queries
- Playground API proxy server with Express
- Comprehensive community health files (SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SUPPORT.md)
- Issue templates (bug report, feature request, question)
- Pull request template with comprehensive checklist
- Funding configuration for GitHub Sponsors and Open Collective
- Organization profile with professional presentation

### Infrastructure
- CI/CD workflows for Node.js 16, 18, and 20
- CodeQL security analysis (weekly scans)
- Dependabot for automated dependency updates
- Dependency review for pull requests
- Automated testing and linting
- GitHub Actions for release automation

### Security
- SSRF protection blocks private IPs, localhost, and internal domains
- Certificate validation enforced (HTTPS only)
- Proper CIDR matching using ipaddr.js library
- Input validation prevents injection attacks
- Automated security scanning with CodeQL
- Secret scanning configuration
- Dependabot security updates

### Documentation
- Comprehensive README with examples
- API documentation
- Security policy
- Contributing guidelines
- Code of conduct
- Support resources

### Testing
- 146+ unit and integration tests
- Mocked fixtures for reliable testing
- Coverage reporting

## [0.1.0-alpha.4] - 2025-01-25

### Added
- Dependabot configuration for automated dependency updates
- Enhanced CI/CD workflows with multi-version Node.js testing (Node.js 16, 18, 20)
- CodeQL security analysis workflow (weekly scans)
- Dependency review workflow for pull requests
- Interactive playground for testing RDAP queries
- Playground API proxy server with Express
- Comprehensive community health files (SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SUPPORT.md)
- Issue templates (bug report, feature request, question)
- Pull request template with comprehensive checklist
- Funding configuration for GitHub Sponsors and Open Collective
- Organization profile with professional presentation

### Changed
- Improved CI workflow to test on multiple Node.js versions
- Simplified CodeQL configuration
- Updated organization profile with professional presentation
- Enhanced documentation structure
- Improved .gitignore to exclude .kiro directory

### Security
- Added automated security scanning with CodeQL
- Enabled dependency review for pull requests
- Configured Dependabot for security updates
- Set up weekly security scans

### Infrastructure
- Added CI/CD workflows for automated testing
- Configured Dependabot for dependency management
- Set up CodeQL for security analysis

## [0.1.0-alpha.2] - 2026-01-22

### Fixed
- Cancel timeout timer in `withTimeout()` to prevent Jest exit warning
- Improve integration test fetch mock cleanup with proper `beforeEach`/`afterEach`

## [0.1.0-alpha.1] - 2026-01-22

### Added
- Initial alpha release of RDAPify
- Core RDAP client with domain, IP, and ASN query support
- Automatic RDAP server discovery via IANA Bootstrap
- SSRF protection with proper CIDR matching for IPv4 and IPv6
- PII redaction for GDPR/CCPA compliance
- In-memory caching with configurable TTL
- Data normalization for consistent response format
- Comprehensive TypeScript types and interfaces
- Input validation for domains, IPs, and ASNs
- Retry logic with configurable backoff strategies
- 146 unit and integration tests with mocked fixtures

### Security
- SSRF protection blocks private IPs, localhost, and internal domains
- Certificate validation enforced (HTTPS only)
- Proper CIDR matching using ipaddr.js library
- Input validation prevents injection attacks

### Known Limitations
- Redis cache not yet implemented (in-memory only)
- No CLI tool in this release
- Bun/Deno/Cloudflare Workers support untested
- Live integration tests not included in CI
- Documentation references features not yet available

### Dependencies
- ipaddr.js: ^2.2.0 (for CIDR matching)
- tslib: ^2.8.1 (TypeScript runtime)

### Development
- TypeScript 5.3.3 with strict mode
- Jest for testing
- ESLint for code quality
- Prettier for code formatting

---

[0.1.0-alpha.1]: https://github.com/rdapify/rdapify/releases/tag/v0.1.0-alpha.1
