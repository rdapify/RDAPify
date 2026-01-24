# Product Overview

## What is RDAPify?

RDAPify is a unified, secure, high-performance RDAP (Registration Data Access Protocol) client library for enterprise applications. It replaces traditional WHOIS protocol with a modern, standardized approach to querying domain registration data.

## Core Value Proposition

- **Unified Interface**: Single API for querying all global registries (Verisign, ARIN, RIPE, APNIC, LACNIC)
- **Security-First**: Built-in SSRF protection, certificate validation, and secure data handling
- **Privacy by Default**: Automatic PII redaction for GDPR/CCPA compliance
- **Enterprise Performance**: Smart caching, parallel processing, and memory optimization
- **Multi-Environment**: Works on Node.js, Bun, Deno, and Cloudflare Workers

## Key Features

1. **Data Normalization**: Consistent response format regardless of source registry
2. **SSRF Protection**: Prevents attacks on internal infrastructure
3. **Exceptional Performance**: Smart caching with 1-hour TTL, parallel processing
4. **Broad Compatibility**: Cross-platform and cross-runtime support
5. **GDPR-Ready**: Built-in tools for automatically redacting personal data

## Target Users

- Enterprise developers building domain monitoring systems
- Security teams tracking domain registrations
- Compliance teams needing GDPR/CCPA-compliant data access
- Infrastructure teams replacing legacy WHOIS implementations

## Project Status

**Current Release:** v0.1.0-alpha.4 (Alpha)

Core functionality is implemented and tested with 146 passing tests. The library is functional for production use with Node.js, though some advanced features are still in development.

**What's Working:**
- ✅ RDAP Client (domain, IP, ASN queries)
- ✅ IANA Bootstrap discovery
- ✅ Data normalization
- ✅ PII redaction
- ✅ In-memory caching (LRU with TTL)
- ✅ SSRF protection
- ✅ TypeScript support
- ✅ Error handling with retry logic
- ✅ 146 tests passing (>90% coverage)

**In Development:**
- ⏳ Redis cache adapter
- ⏳ CLI tool
- ⏳ Multi-runtime support (Bun, Deno, Cloudflare Workers)
- ⏳ Advanced analytics and dashboards

The project follows RFC 7480 series standards and maintains strict protocol compliance.
