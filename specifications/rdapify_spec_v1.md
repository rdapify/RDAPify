# RDAPify Technical Specification v1.0

**Version**: 1.0  
**Status**: Alpha  
**Date**: January 24, 2026

## 1. Overview

### 1.1 Purpose

This document defines the technical specification for RDAPify, a unified RDAP client library for enterprise applications.

### 1.2 Scope

This specification covers:
- API design and interfaces
- Data models and types
- Protocol compliance
- Security requirements
- Performance characteristics

### 1.3 Conformance

Implementations MUST comply with:
- RFC 7480: RDAP HTTP Usage
- RFC 7481: RDAP Security Services
- RFC 7482: RDAP Query Format
- RFC 7483: RDAP JSON Responses
- RFC 7484: RDAP Object Tagging

## 2. Architecture

### 2.1 Layered Design

```
┌─────────────────────────────────────┐
│   Application Layer                 │
│   - RDAPClient                      │
│   - QueryOrchestrator               │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│   Core Layer                        │
│   - Use Cases                       │
│   - Domain Entities                 │
│   - Ports (Interfaces)              │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│   Infrastructure Layer              │
│   - Fetcher                         │
│   - Bootstrap Discovery             │
│   - Cache Manager                   │
│   - Normalizer                      │
│   - SSRF Protection                 │
│   - PII Redactor                    │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│   Shared Layer                      │
│   - Types & Interfaces              │
│   - Validators                      │
│   - Utilities                       │
│   - Constants                       │
└─────────────────────────────────────┘
```

### 2.2 Design Principles

1. **Separation of Concerns**: Clear layer boundaries
2. **Dependency Inversion**: Core defines interfaces
3. **Single Responsibility**: Each module has one purpose
4. **Open/Closed**: Open for extension, closed for modification
5. **Interface Segregation**: Focused, minimal interfaces

## 3. API Specification

### 3.1 Client Interface

```typescript
interface RDAPClient {
  domain(domain: string, options?: QueryOptions): Promise<DomainResponse>;
  ip(ip: string, options?: QueryOptions): Promise<IPResponse>;
  asn(asn: number | string, options?: QueryOptions): Promise<ASNResponse>;
}
```

### 3.2 Configuration

```typescript
interface RDAPClientOptions {
  cache?: boolean | ICachePort;
  privacy?: PrivacyOptions;
  retry?: RetryOptions;
  timeout?: number;
  validateCertificates?: boolean;
}

interface PrivacyOptions {
  redactPII?: boolean;
  redactEmails?: boolean;
  redactPhones?: boolean;
  redactAddresses?: boolean;
}

interface RetryOptions {
  maxAttempts?: number;
  backoff?: 'linear' | 'exponential';
  initialDelay?: number;
}
```

### 3.3 Response Types

```typescript
interface BaseResponse {
  handle?: string;
  status?: string[];
  events?: Event[];
  entities?: Entity[];
  links?: Link[];
  remarks?: Remark[];
  metadata: ResponseMetadata;
}

interface DomainResponse extends BaseResponse {
  ldhName: string;
  unicodeName?: string;
  nameservers?: string[];
  secureDNS?: SecureDNS;
  registrar?: Entity;
}

interface IPResponse extends BaseResponse {
  startAddress: string;
  endAddress: string;
  ipVersion: 'v4' | 'v6';
  name?: string;
  type?: string;
  country?: string;
}

interface ASNResponse extends BaseResponse {
  startAutnum: number;
  endAutnum?: number;
  name?: string;
  type?: string;
  country?: string;
}
```

## 4. Protocol Compliance

### 4.1 RDAP Query Format (RFC 7482)

**Domain Queries**:
```
GET /domain/{domain-name}
```

**IP Queries**:
```
GET /ip/{ip-address}
```

**ASN Queries**:
```
GET /autnum/{asn}
```

### 4.2 Bootstrap Discovery (RFC 7484)

**Bootstrap Sources**:
- DNS: `https://data.iana.org/rdap/dns.json`
- IPv4: `https://data.iana.org/rdap/ipv4.json`
- IPv6: `https://data.iana.org/rdap/ipv6.json`
- ASN: `https://data.iana.org/rdap/asn.json`

**Discovery Algorithm**:
1. Parse input (domain/IP/ASN)
2. Determine registry type
3. Fetch bootstrap data
4. Match input to registry
5. Construct RDAP URL
6. Execute query

### 4.3 Response Validation

**Required Fields**:
- `objectClassName`: MUST be present
- `handle` or `ldhName`: At least one MUST be present

**Optional Fields**:
- `status`: Array of status values
- `events`: Array of event objects
- `entities`: Array of entity objects

## 5. Data Normalization

### 5.1 Normalization Pipeline

```
Raw RDAP Response
    ↓
Schema Validation
    ↓
Field Extraction
    ↓
Type Conversion
    ↓
Data Enrichment
    ↓
Metadata Addition
    ↓
Normalized Response
```

### 5.2 Normalization Rules

1. **Status Codes**: Normalize to lowercase
2. **Dates**: Convert to ISO 8601 format
3. **Entities**: Extract roles and contacts
4. **Links**: Normalize relation types
5. **Nameservers**: Extract LDH names

### 5.3 JSONPath Mappings

See `jsonpath_definitions.json` for complete mappings.

## 6. Security Requirements

### 6.1 SSRF Protection

**MUST Block**:
- Private IP ranges (RFC 1918)
- Localhost (127.0.0.0/8, ::1)
- Link-local addresses (169.254.0.0/16)
- Multicast addresses

**MUST Validate**:
- Protocol (HTTPS only)
- Hostname format
- DNS resolution

### 6.2 Certificate Validation

**MUST Enforce**:
- Valid certificate chain
- Certificate not expired
- Hostname matches certificate
- TLS 1.2 or higher

**MAY Support**:
- Certificate pinning
- Custom CA certificates

### 6.3 PII Redaction

**MUST Redact** (when enabled):
- Email addresses
- Phone numbers
- Physical addresses

**Pattern Matching**:
- Email: `/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/`
- Phone: `/\+?[\d\s\-\(\)]{10,}/`

## 7. Performance Requirements

### 7.1 Response Times

| Operation | Target | Maximum |
|-----------|--------|---------|
| Cache Hit | <10ms | 50ms |
| Cache Miss | <2s | 5s |
| Bootstrap | <1s | 3s |

### 7.2 Caching

**Default Configuration**:
- TTL: 3600 seconds (1 hour)
- Max Size: 1000 entries
- Strategy: LRU (Least Recently Used)

**Cache Keys**:
```
domain:{normalized-domain}
ip:{normalized-ip}
asn:{asn-number}
bootstrap:{type}
```

### 7.3 Resource Limits

- Max Response Size: 10 MB
- Max Concurrent Requests: 100
- Request Timeout: 5 seconds (default)

## 8. Error Handling

### 8.1 Error Types

```typescript
class RDAPError extends Error {
  code: string;
  statusCode?: number;
  cause?: Error;
}

// Error Codes
- VALIDATION_ERROR
- NETWORK_ERROR
- TIMEOUT_ERROR
- BOOTSTRAP_ERROR
- SSRF_PROTECTION_ERROR
- NORMALIZATION_ERROR
```

### 8.2 Retry Logic

**Retry Conditions**:
- Network errors (5xx status codes)
- Timeout errors
- Connection refused

**No Retry**:
- Validation errors (4xx status codes)
- SSRF protection errors
- Authentication errors

**Backoff Strategy**:
```
Attempt 1: 0ms delay
Attempt 2: 1000ms delay
Attempt 3: 2000ms delay (exponential)
```

## 9. Testing Requirements

### 9.1 Unit Tests

**Coverage Target**: >90%

**Required Tests**:
- Input validation
- SSRF protection
- PII redaction
- Cache operations
- Error handling

### 9.2 Integration Tests

**Required Scenarios**:
- End-to-end domain query
- Bootstrap discovery
- Cache hit/miss
- Error recovery

### 9.3 Test Vectors

See `test_vectors.json` for standardized test cases.

## 10. Compatibility

### 10.1 Runtime Support

| Runtime | Version | Status |
|---------|---------|--------|
| Node.js | 16+ | ✅ Supported |
| Bun | 1.0+ | ⏳ Planned |
| Deno | 1.30+ | ⏳ Planned |
| Cloudflare Workers | Latest | ⏳ Planned |

### 10.2 TypeScript

- Minimum Version: 5.0
- Strict Mode: Required
- ES Module: Supported
- CommonJS: Supported

## 11. Versioning

### 11.1 Semantic Versioning

Format: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking API changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### 11.2 API Stability

- **Alpha** (0.x.x): API may change
- **Beta** (1.0.0-beta.x): API mostly stable
- **Stable** (1.0.0+): API stable, breaking changes in major versions

## 12. Compliance Matrix

| Standard | Compliance | Notes |
|----------|-----------|-------|
| RFC 7480 | ✅ Full | HTTP Usage |
| RFC 7481 | ✅ Full | Security Services |
| RFC 7482 | ✅ Full | Query Format |
| RFC 7483 | ✅ Full | JSON Responses |
| RFC 7484 | ✅ Full | Object Tagging |
| GDPR | ✅ Full | PII Redaction |
| CCPA | ✅ Full | Privacy Controls |

## 13. Future Enhancements

### 13.1 Planned Features

- [ ] Redis cache adapter
- [ ] CLI tool
- [ ] Multi-runtime support
- [ ] Advanced analytics
- [ ] GraphQL API

### 13.2 Research Areas

- Query result aggregation
- Blockchain verification
- AI-powered anomaly detection

## 14. References

- [RFC 7480](https://tools.ietf.org/html/rfc7480) - RDAP HTTP Usage
- [RFC 7481](https://tools.ietf.org/html/rfc7481) - RDAP Security
- [RFC 7482](https://tools.ietf.org/html/rfc7482) - RDAP Query Format
- [RFC 7483](https://tools.ietf.org/html/rfc7483) - RDAP JSON Responses
- [RFC 7484](https://tools.ietf.org/html/rfc7484) - RDAP Object Tagging

---

**Document Status**: Living Document  
**Last Updated**: January 24, 2026  
**Version**: 1.0
