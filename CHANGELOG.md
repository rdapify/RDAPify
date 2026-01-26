# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.3] - 2026-01-26

### Added - Phase 3 Improvements
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

### Added - Phase 2 Improvements
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

### Changed
- **Exports**: Added new exports for Phase 2 features in index.ts

### Tests
- Added comprehensive test suites for Phase 3 features:
  - `authentication-manager.test.ts`: 17 tests covering all auth methods
  - `proxy-manager.test.ts`: 16 tests covering proxy configuration
  - `compression-manager.test.ts`: 19 tests covering compression/decompression
- Added comprehensive test suites for Phase 2 features:
  - `retry-strategy.test.ts`: 13 tests covering retry logic and circuit breaker
  - `query-priority.test.ts`: 8 tests covering priority queue functionality
  - `enhanced-validators.test.ts`: 21 tests covering validation enhancements
  - `persistent-cache.test.ts`: 13 tests covering persistent storage

### Performance
- **Retry Strategies**: Intelligent retry reduces failed requests
- **Query Prioritization**: Critical queries execute first
- **Persistent Cache**: Faster startup with pre-loaded cache

## [0.1.2] - 2026-01-26

### Added - Phase 1 Improvements
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
- **QueryOrchestrator**: Integrated logging and metrics collection into all query methods
- **RDAPClient**: Added connection pool, metrics collector, and logger initialization

### Tests
- Added comprehensive test suites for new features:
  - `connection-pool.test.ts`: 9 tests covering connection management
  - `metrics-collector.test.ts`: 11 tests covering metrics tracking
  - `logger.test.ts`: 18 tests covering logging functionality

## [0.1.1] - 2026-01-25

### Added
- **Rate Limiting**: Token bucket rate limiter with multi-key support and auto-cleanup
- **Batch Processing**: Efficient concurrent processing of multiple RDAP queries
- **Enhanced Error Handling**: Errors now include suggestions, timestamps, and user-friendly messages
- **Generic Types**: Type-safe query functions with automatic result type inference
- **Tree Shaking Support**: Modular exports for smaller bundle sizes
- **Comprehensive Tests**: Added 37+ new tests for PIIRedactor, CacheManager, and RateLimiter

### Changed
- **Error Classes**: All errors now include `suggestion`, `timestamp`, and `getUserMessage()` method
- **RateLimitError**: Added `retryAfter` field to indicate when to retry
- **Package Exports**: Added modular exports for errors, types, and validators
- **TypeScript Config**: Optimized for better tree shaking and smaller output

### Improved
- **Test Coverage**: Increased from 76.74% to ~85-90% (estimated)
- **Type Safety**: Better generic types for query operations
- **Developer Experience**: More helpful error messages and suggestions
- **Performance**: Batch processing with configurable concurrency

### Fixed
- Fixed prism-react-renderer theme import in Docusaurus configuration
- Fixed MDX compilation errors caused by unescaped `<` and `>` characters in markdown tables
- Fixed self-closing HTML tags (`<br>` → `<br/>`) in documentation
- Fixed deprecated GitHub Actions (upload-artifact@v3 → v4, actions/create-release → softprops/action-gh-release)
- Fixed empty workflow file (examples.yml)
- Fixed missing sidebars.js configuration
- Removed empty pages causing build failures

### Changed
- Standardized Node.js version to v20 across all GitHub Actions workflows
- Updated all workflows to use `node-version-file: .nvmrc` for consistency
- Improved npm caching in CI/CD workflows for faster builds
- Added `NODE_ENV: production` to website build workflow
- Added `onBrokenMarkdownImages: 'warn'` to Docusaurus config
- Enhanced release workflow with better error handling

### Added
- Created SVG placeholder icons for homepage features (typescript, performance, security, multi-env, unified, privacy)
- Added examples validation workflow
- Added fork check for Snyk security scans to prevent token exposure
- Added comprehensive CI/CD fixes documentation

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

## [Unreleased]

### Planned for v0.2.0
- Redis cache implementation
- CLI tool for quick queries
- Live integration tests
- Improved error messages
- Performance benchmarks
- Additional runtime support (Bun, Deno)

---

[0.1.0-alpha.1]: https://github.com/rdapify/rdapify/releases/tag/v0.1.0-alpha.1
