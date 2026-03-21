# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- **Domain Availability**: `client.checkAvailability(domain)` — check if a domain is available via RDAP (404 = available, active = registered)
- **Bulk Availability**: `client.checkAvailabilityBatch(domains[])` — check multiple domains in parallel
- **Live Integration Tests**: opt-in via `LIVE_TESTS=1` environment variable
- **Advanced Bootstrap Config**: custom bootstrap servers, TTL overrides, redundancy/fallback support

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
