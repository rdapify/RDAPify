# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
