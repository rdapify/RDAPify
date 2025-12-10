# RDAP Protocol Specifications

🎯 **Purpose**: Comprehensive technical specification of the Registration Data Access Protocol (RDAP) based on IETF RFC standards, providing implementation guidance for developers with emphasis on security, compliance, and performance  
📚 **Related**: [RFC Style Guide](rfc_style_spec.md) | [Bootstrap Specification](bootstrap.md) | [Response Format](response_format.md) | [Security Services](../security/whitepaper.md)  
⏱️ **Reading Time**: 10 minutes  
🔍 **Pro Tip**: Use the [RFC Validator](../../playground/rfc-validator.md) to automatically validate your RDAP implementation against RFC requirements before deployment

## 🌐 RDAP Protocol Overview

RDAP (Registration Data Access Protocol) is a modern, RESTful replacement for the legacy WHOIS protocol, providing structured access to registration data for internet resources (domains, IP addresses, and autonomous systems) with enhanced security, privacy, and internationalization support:

```mermaid
graph TD
    A[RDAP Client] --> B[IANA Bootstrap Service]
    B --> C[Registry RDAP Service]
    C --> D[Domain Object]
    C --> E[IP Network Object]
    C --> F[Autonomous System Object]
    D --> G[Registrant Contact]
    D --> H[Registrar Contact]
    D --> I[Nameserver Records]
    E --> J[IP Allocation Records]
    F --> K[AS Route Objects]
    
    style A fill:#4CAF50
    style B,C fill:#2196F3
    style D,E,F fill:#FF9800
    style G,H,I,J,K fill:#9C27B0
```

### Core RFC Specifications
| RFC | Title | Status | Category |
|-----|-------|--------|----------|
| [RFC 7480](https://tools.ietf.org/html/rfc7480) | HTTP Usage in the Registration Data Access Protocol | Standards Track | Core Protocol |
| [RFC 7481](https://tools.ietf.org/html/rfc7481) | Security Services for the Registration Data Access Protocol | Standards Track | Security |
| [RFC 7482](https://tools.ietf.org/html/rfc7482) | Registration Data Access Protocol (RDAP) Query Format | Standards Track | Core Protocol |
| [RFC 7483](https://tools.ietf.org/html/rfc7483) | JSON Responses for the Registration Data Access Protocol | Standards Track | Data Model |
| [RFC 7484](https://tools.ietf.org/html/rfc7484) | Finding the Authoritative Registration Data Service | Standards Track | Discovery |
| [RFC 8056](https://tools.ietf.org/html/rfc8056) | RDAP Extensions for Entity | Proposed Standard | Extensions |
| [RFC 9082](https://tools.ietf.org/html/rfc9082) | RDAP Reverse Search | Proposed Standard | Extensions |
| [RFC 9083](https://tools.ietf.org/html/rfc9083) | RDAP Query Types and Path Segments | Proposed Standard | Core Protocol |
| [RFC 9537](https://tools.ietf.org/html/rfc9537) | RDAP Search Using JSONPath | Proposed Standard | Extensions |

## ⚙️ Core Protocol Requirements

### 1. HTTP/HTTPS Requirements (RFC 7480)
```http
GET /domain/example.com HTTP/1.1
Host: rdap.example.com
Accept: application/rdap+json
User-Agent: RDAPify/2.3

HTTP/1.1 200 OK
Content-Type: application/rdap+json
Content-Language: en
Link: <https://rdap.example.com/domain/example.com>;rel="self"
Expires: Wed, 20 Dec 2025 14:22:36 GMT
Cache-Control: max-age=3600, public
```

#### Mandatory HTTP Headers
| Header | Requirement | Client/Server | Purpose |
|--------|-------------|---------------|---------|
| `Accept` | Must include `application/rdap+json` | Client | Content negotiation |
| `Content-Type` | Must be `application/rdap+json` | Server | Response format indication |
| `Link` | Must include `rel="self"` | Server | Self-referential link |
| `Expires`/`Cache-Control` | One or both required | Server | Cacheability information |
| `Content-Language` | Required if server selects language | Server | Language indication |

#### Forbidden HTTP Methods
| Method | Reason | Alternative |
|--------|--------|------------|
| `POST` | Not idempotent | Use `GET` with query parameters |
| `PUT`/`DELETE` | RDAP is read-only protocol | Use registrar-specific APIs |
| `PATCH` | No partial updates in RDAP | Use full object retrieval |

### 2. Query Format Specification (RFC 7482, RFC 9083)
#### Domain Queries
```
GET /domain/{domainName}
```
- `{domainName}` must be Punycode normalized (RFC 5890)
- TLD must be lowercase
- Examples:
  - `/domain/example.com`
  - `/domain/xn--kgbeahc7ais9h.com` (Arabic domain)

#### IP Network Queries
```
GET /ip/{ipAddressOrPrefix}
```
- IPv4: Dotted-decimal format (RFC 791)
- IPv6: Compressed format (RFC 5952)
- Prefix notation uses CIDR format
- Examples:
  - `/ip/198.51.100.0/24`
  - `/ip/2001:db8::/32`

#### ASN Queries
```
GET /autnum/{autnumValue}
```
- ASN format follows RFC 6793
- Examples:
  - `/autnum/12345`
  - `/autnum/AS12345` (AS prefix optional)

### 3. JSON Response Structure (RFC 7483)
```json
{
  "rdapConformance": ["rdap_level_0", "cidr0", "partial_reply"],
  "notices": [
    {
      "title": "Terms of Service",
      "description": [
        "By using the RDAP service, you agree to the terms of service located at:",
        "https://rdap.example.com/terms"
      ],
      "links": [
        {
          "href": "https://rdap.example.com/terms",
          "rel": "terms-of-service",
          "type": "text/html",
          "value": "https://rdap.example.com/terms"
        }
      ]
    }
  ],
  "domain": {
    "handle": "EXAMPLE-1",
    "ldhName": "example.com",
    "unicodeName": "example.com",
    "status": ["active"],
    "entities": [
      {
        "handle": "REGISTRAR-1",
        "roles": ["registrar"],
        "vcardArray": [
          "vcard",
          [
            ["version", {}, "text", "4.0"],
            ["fn", {}, "text", "Example Registrar"],
            ["org", {}, "text", ["Example Registrar, Inc."]],
            ["adr", {}, "text", ["", "", "123 Example St", "San Francisco", "CA", "94107", "US"]],
            ["tel", {"type": "voice"}, "text", "+1.4155551212"],
            ["email", {}, "text", "registrar@example.com"]
          ]
        ]
      }
    ],
    "nameservers": [
      {
        "ldhName": "ns1.example.com",
        "unicodeName": "ns1.example.com"
      },
      {
        "ldhName": "ns2.example.com",
        "unicodeName": "ns2.example.com"
      }
    ],
    "events": [
      {
        "eventAction": "registration",
        "eventDate": "2023-05-15T14:30:00Z"
      },
      {
        "eventAction": "expiration",
        "eventDate": "2025-05-15T14:30:00Z"
      }
    ],
    "links": [
      {
        "href": "https://rdap.example.com/domain/example.com",
        "rel": "self",
        "type": "application/rdap+json",
        "value": "https://rdap.example.com/domain/example.com"
      }
    ]
  }
}
```

#### Required Top-Level Fields
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rdapConformance` | Array[String] | ✅ | List of supported conformance levels and extensions |
| `notices` | Array[Object] | ⚠️ | Required if applicable policy exists |
| `domain`/`ip`/`autnum` | Object | ✅ (one of) | The requested object data |
| `entities` | Array[Object] | ⚠️ | Required for objects with associated contacts |

#### Conformance Levels
| Level | Description | Required Extensions |
|-------|-------------|---------------------|
| `rdap_level_0` | Core RDAP functionality | None |
| `cidr0` | CIDR notation for IP networks | None |
| `partial_reply` | Partial responses for large datasets | None |

## 🔒 Security Requirements (RFC 7481)

### 1. Authentication and Authorization
```http
GET /domain/example.com HTTP/1.1
Host: rdap.example.com
Accept: application/rdap+json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Supported Authentication Methods
| Method | Use Case | Security Level | RFC Reference |
|--------|----------|----------------|--------------|
| TLS Client Certificates | High-security environments | 🔴 Highest | RFC 8705 |
| OAuth 2.0 Bearer Tokens | Enterprise applications | 🟠 High | RFC 6750 |
| API Keys | Public access with rate limiting | 🟢 Medium | RFC 9110 |
| None (Public Access) | Open registries | ⚫ Basic | RFC 7481 |

### 2. Data Redaction and Privacy Controls
```json
{
  "entities": [
    {
      "handle": "REDACTED-1",
      "roles": ["registrant"],
      "vcardArray": [
        "vcard",
        [
          ["version", {}, "text", "4.0"],
          ["fn", {}, "text", "REDACTED FOR PRIVACY"],
          ["org", {}, "text", ["REDACTED FOR PRIVACY"]],
          ["adr", {}, "text", ["", "", "REDACTED FOR PRIVACY", "REDACTED FOR PRIVACY", "REDACTED FOR PRIVACY", "REDACTED FOR PRIVACY", "REDACTED FOR PRIVACY"]],
          ["email", {}, "text", "Please query the RDDS service of the Registrar of Record identified in this output for information on how to contact the Registrant"]
        ]
      ],
      "remarks": [
        {
          "title": "REDACTED FOR PRIVACY",
          "description": [
            "Data redacted per applicable privacy laws and regulations."
          ]
        }
      ]
    }
  ]
}
```

#### Privacy Redaction Levels
| Level | Required Fields | Optional Fields | Applicable Regulations |
|-------|----------------|-----------------|------------------------|
| **Full Redaction** | `handle`, `roles` | `remarks` with redaction notice | GDPR Article 6, CCPA §1798.100 |
| **Partial Redaction** | `handle`, `roles`, organization name | Contact details redacted | GDPR Article 6(1)(f), CCPA §1798.140(o) |
| **Minimal Redaction** | All fields with pseudonymization | Pseudonymized values | GDPR Article 25, CCPA §1798.100(e) |

### 3. Rate Limiting Headers
```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 94
X-RateLimit-Reset: 3600
Retry-After: 60
```

#### Rate Limiting Requirements
| Header | Purpose | Example Values |
|--------|---------|----------------|
| `X-RateLimit-Limit` | Maximum requests allowed in window | `100` |
| `X-RateLimit-Remaining` | Remaining requests in current window | `94` |
| `X-RateLimit-Reset` | Seconds until reset | `3600` |
| `Retry-After` | Seconds to wait after 429 response | `60` |

## 🔍 Bootstrapping and Discovery (RFC 7484)

### 1. IANA Bootstrap Service
```json
{
  "services": [
    [
      ["com", "net", "org"],
      ["https://rdap.verisign.com/", "https://rdap.publicinterestregistry.org/"]
    ],
    [
      ["2.198.in-addr.arpa", "3.198.in-addr.arpa"],
      ["https://rdap.arin.net/"]
    ]
  ],
  "rdapConformance": ["rdap_level_0"],
  "notices": [
    {
      "title": "Disclaimer",
      "description": ["This bootstrap service is provided by IANA."]
    }
  ]
}
```

#### Bootstrap Service Endpoints
| Resource Type | Bootstrap URL | Format |
|---------------|---------------|--------|
| Domain TLDs | `https://data.iana.org/rdap/dns.json` | JSON |
| IPv4 Address Space | `https://data.iana.org/rdap/ipv4.json` | JSON |
| IPv6 Address Space | `https://data.iana.org/rdap/ipv6.json` | JSON |
| Autonomous Systems | `https://data.iana.org/rdap/asn.json` | JSON |

### 2. Service Discovery Process
```mermaid
sequenceDiagram
    Client->>+IANA Bootstrap: GET /rdap/dns.json
    IANA Bootstrap-->>-Client: JSON with TLD mappings
    Client->>+Registry RDAP: GET /domain/example.com
    Registry RDAP-->>-Client: Domain object with entities
    Note right of Client: Cache results according to Expires header
```

#### Discovery Algorithm
1. **Identify resource type** (domain, IP, ASN)
2. **Fetch appropriate bootstrap file** from IANA
3. **Find authoritative registry** for the resource
4. **Query registry RDAP endpoint** with appropriate path
5. **Process response** according to RFC 7483
6. **Cache results** according to HTTP caching headers

## ⚡ Performance and Caching

### 1. Caching Requirements
```http
HTTP/1.1 200 OK
Expires: Wed, 20 Dec 2025 14:22:36 GMT
Cache-Control: max-age=3600, public, s-maxage=7200, stale-while-revalidate=300
Vary: Accept, Accept-Language
ETag: "rdap-domain-example-com-v1"
```

#### Cache Control Directives
| Directive | Purpose | Recommended Value |
|-----------|---------|-------------------|
| `max-age` | Client-side cache duration | 3600 (1 hour) |
| `s-maxage` | Shared cache duration | 7200 (2 hours) |
| `stale-while-revalidate` | Serve stale content during revalidation | 300 (5 minutes) |
| `stale-if-error` | Serve stale content during errors | 600 (10 minutes) |

### 2. Compression and Transfer Encoding
```http
GET /domain/example.com HTTP/1.1
Host: rdap.example.com
Accept-Encoding: gzip, deflate, br
Accept: application/rdap+json

HTTP/1.1 200 OK
Content-Encoding: br
Vary: Accept-Encoding
Content-Type: application/rdap+json
Content-Length: 1234
```

#### Supported Compression Algorithms
| Algorithm | Browser Support | Compression Ratio | CPU Overhead |
|-----------|----------------|-------------------|-------------|
| `br` (Brotli) | 95% | Highest (15-20%) | Medium |
| `gzip` | 99% | High (10-15%) | Low |
| `deflate` | 98% | Medium (5-10%) | Low |

## 🌍 Internationalization and Localization

### 1. Language Negotiation
```http
GET /domain/example.com HTTP/1.1
Host: rdap.example.com
Accept-Language: fr-CH, fr;q=0.9, en;q=0.8, *;q=0.5
Accept: application/rdap+json

HTTP/1.1 200 OK
Content-Language: fr-CH
Content-Type: application/rdap+json
```

#### Language Handling Requirements
| Header | Server Behavior | Client Behavior |
|--------|-----------------|----------------|
| `Accept-Language` | Select best matching language or default | List preferred languages in order |
| `Content-Language` | Set to actual language used in response | Use for display and parsing decisions |

### 2. Unicode and Punycode Support
```json
{
  "domain": {
    "ldhName": "xn--b1abfaaepdrnnbgefbaudo6ft8k2d2ac.vn",
    "unicodeName": "xn--b1abfaaepdrnnbgefbaudo6ft8k2d2ac.vn",
    "remarks": [
      {
        "title": "UNICODE NAME",
        "description": ["Tên miền tiếng Việt"]
      }
    ]
  }
}
```

#### Character Encoding Requirements
| Field Type | Encoding | Validation |
|------------|----------|-----------|
| LDH Names (A-labels) | Punycode (RFC 5891) | Must conform to LDH rules |
| Unicode Names (U-labels) | UTF-8 (RFC 3629) | Must be valid Unicode strings |
| Display Values | UTF-8 | Must be valid for selected language |
| IDs and Handles | ASCII | Case-insensitive comparison |

## 🧪 Error Handling and Status Codes

### 1. Standard HTTP Status Codes
| Code | Usage | Example Response |
|------|-------|------------------|
| 200 OK | Successful response | Standard RDAP JSON object |
| 400 Bad Request | Invalid query format | `{ "errorCode": 400, "title": "Invalid domain name", "description": ["Domain name contains invalid characters"] }` |
| 404 Not Found | Resource not found | `{ "errorCode": 404, "title": "Domain not found", "description": ["No domain matching example.com was found"] }` |
| 429 Too Many Requests | Rate limiting exceeded | `{ "errorCode": 429, "title": "Rate limit exceeded", "description": ["Rate limit of 100 requests per hour exceeded"] }` |
| 503 Service Unavailable | Service temporarily down | `{ "errorCode": 503, "title": "Service unavailable", "description": ["RDAP service is temporarily unavailable. Try again in 5 minutes."] }` |

### 2. RDAP Error Object Structure
```json
{
  "errorCode": 404,
  "title": "Not Found",
  "description": [
    "The domain example.not exists in this registry."
  ],
  "validationErrors": [
    {
      "key": "domain",
      "value": "example.not",
      "reason": "TLD not supported by this registry"
    }
  ],
  "links": [
    {
      "href": "https://rdap.example.com/help",
      "rel": "help",
      "type": "text/html",
      "value": "https://rdap.example.com/help"
    }
  ]
}
```

#### Error Object Requirements
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `errorCode` | Integer | ✅ | HTTP status code |
| `title` | String | ✅ | Brief error description |
| `description` | Array[String] | ✅ | Human-readable error details |
| `validationErrors` | Array[Object] | ⚠️ | Required for validation failures |
| `links` | Array[Object] | ⚠️ | Required if help resources exist |

## 🔗 Extensions and Custom Objects

### 1. Entity Extensions (RFC 8056)
```json
{
  "entity": {
    "handle": "CONTACT-1",
    "roles": ["technical", "administrative"],
    "vcardArray": [...],
    "entityType": "individual", // RFC 8056 extension
    "publicIds": [ // RFC 8056 extension
      {
        "type": "regid",
        "identifier": "REG-12345"
      }
    ],
    "networkIds": [ // RFC 8056 extension
      {
        "type": "asn",
        "value": "12345"
      }
    ]
  }
}
```

### 2. JSONPath Search Extension (RFC 9537)
```http
GET /search/domain?jsonpath=$[?(@.domain.ldhName =~ /[aeiou]{3}/)]
Host: rdap.example.com
Accept: application/rdap+json
```

#### JSONPath Search Requirements
| Feature | Supported | Example |
|---------|-----------|---------|
| Field Filtering | ✅ | `$.domain.ldhName` |
| Wildcards | ✅ | `$.*.ldhName` |
| Filtering | ✅ | `$[?(@.domain.status contains 'active')]` |
| Regular Expressions | ✅ | `$[?(@.domain.ldhName =~ /example\./)]` |
| Nested Queries | ⚠️ Limited | `$[?(@.entities[?(@.roles contains 'registrant')])]` |

## 🔍 Troubleshooting Common Implementation Issues

### 1. Bootstrap Service Failures
**Symptoms**: Unable to find authoritative RDAP servers for domains or IP addresses  
**Root Causes**:
- Outdated bootstrap files
- Network connectivity issues to IANA
- Improper TLD mapping in bootstrap data
- DNS resolution failures for bootstrap endpoints

**Diagnostic Steps**:
```bash
# Check bootstrap file accessibility
curl -I https://data.iana.org/rdap/dns.json

# Validate bootstrap file contents
jq '.services | length' <(curl https://data.iana.org/rdap/dns.json)

# Test TLD lookup logic
node ./scripts/bootstrap-lookup.js --tld com --type dns
```

**Solutions**:
✅ **Bootstrap Caching Strategy**: Implement local cache with expiration (24 hours max) and fallback mechanisms  
✅ **Multiple Bootstrap Sources**: Configure secondary bootstrap sources from ICANN mirrors  
✅ **Graceful Degradation**: Maintain local TLD mapping as fallback when bootstrap services are unavailable  
✅ **Validation Pipeline**: Add bootstrap data validation step to detect malformed or incomplete data  

### 2. JSON Schema Validation Failures
**Symptoms**: Responses fail validation against RDAP JSON schemas  
**Root Causes**:
- Missing required fields per RFC 7483
- Incorrect data types or formats
- Unsupported extensions without proper conformance declaration
- Character encoding issues in Unicode fields

**Diagnostic Steps**:
```bash
# Validate against RDAP JSON schema
ajv validate -s ../schemas/rdap_response.json -d response.json

# Check character encoding
file -i response.json

# Validate required fields
jq '.rdapConformance, .domain, .notices' response.json
```

**Solutions**:
✅ **Schema Validation Middleware**: Implement server-side validation against official RDAP JSON schemas  
✅ **Conformance Declaration**: Ensure all extensions are properly declared in `rdapConformance` array  
✅ **Unicode Normalization**: Apply NFC normalization to all Unicode fields before validation  
✅ **Error Handling**: Provide detailed validation errors with field-specific context for debugging  

### 3. Rate Limiting Issues
**Symptoms**: Client receives 429 responses or connection timeouts  
**Root Causes**:
- Aggressive client query rates
- Insufficient client-side rate limiting
- Multiple clients sharing same IP address
- Registry-specific rate limits not respected

**Diagnostic Steps**:
```bash
# Monitor rate limit headers
curl -v https://rdap.example.com/domain/example.com 2>&1 | grep -E 'X-RateLimit|Retry-After'

# Test client rate limiting
node ./scripts/rate-limit-test.js --target https://rdap.example.com --concurrency 10

# Analyze request patterns
tcpdump -i eth0 'host rdap.example.com and port 443' -w rdap_traffic.pcap
```

**Solutions**:
✅ **Adaptive Rate Limiting**: Implement client-side rate limiting with exponential backoff and jitter  
✅ **Caching Layer**: Add aggressive caching with proper invalidation strategies  
✅ **Registry Awareness**: Maintain registry-specific rate limit profiles and adjust client behavior accordingly  
✅ **Connection Pooling**: Use HTTP/2 multiplexing and connection reuse to reduce overhead  

## 📚 Related Documentation

| Document | Description | Path |
|----------|-------------|------|
| [RFC Style Guide](rfc_style_spec.md) | Writing RDAP responses compliant with RFC formatting requirements | [rfc_style_spec.md](rfc_style_spec.md) |
| [Bootstrap Specification](bootstrap.md) | Detailed IANA bootstrap service implementation guide | [bootstrap.md](bootstrap.md) |
| [Response Format](response_format.md) | Complete JSON response structure specification | [response_format.md](response_format.md) |
| [Status Codes](status_codes.md) | Comprehensive error code reference | [status_codes.md](status_codes.md) |
| [Security Whitepaper](../../security/whitepaper.md) | Advanced security considerations and threat modeling | [../../security/whitepaper.md](../../security/whitepaper.md) |
| [Test Vectors](../../test_vectors/domain_vectors.json) | Valid and invalid test cases for domain queries | [../../test_vectors/domain_vectors.json](../../test_vectors/domain_vectors.json) |
| [JSONPath Schema](jsonpath_schema.md) | Complete specification of JSONPath search capabilities | [jsonpath_schema.md](jsonpath_schema.md) |
| [RFC Validator](../../playground/rfc-validator.md) | Interactive RFC compliance testing tool | [../../playground/rfc-validator.md](../../playground/rfc-validator.md) |

## 🏷️ Implementation Specifications

| Property | Value |
|----------|-------|
| **Protocol Version** | RFC 7480 - 7484 (2015), RFC 8056 (2017), RFC 9082-9083 (2021), RFC 9537 (2024) |
| **HTTP Version** | HTTP/1.1 and HTTP/2 |
| **TLS Version** | 1.2 minimum, 1.3 recommended |
| **Character Encoding** | UTF-8 (RFC 3629) |
| **Date Format** | ISO 8601 (RFC 3339) |
| **VCard Format** | vCard 4.0 (RFC 6350) |
| **Required Methods** | GET only |
| **Optional Methods** | HEAD (for cache validation) |
| **Response Format** | `application/rdap+json` |
| **Error Format** | JSON with `errorCode`, `title`, `description` |
| **Caching** | HTTP caching with `Expires`/`Cache-Control` |
| **Compression** | gzip, deflate, brotli |
| **Internationalization** | `Accept-Language`, `Content-Language`, Unicode/UTF-8 |
| **Test Coverage** | 100% required fields, 95% optional features |
| **Last Updated** | December 5, 2025 |

> 🔐 **Critical Reminder**: Never implement RDAP clients without proper SSRF protection and PII redaction. All RDAP implementations must undergo security review before processing production data. For regulated environments, maintain comprehensive audit logs of all RDAP queries and responses with appropriate data retention policies. Regular security testing against the RDAP threat model is required for compliance with GDPR Article 32 and similar regulations.

[← Back to Specifications](../README.md) | [Next: RFC Style Guide →](rfc_style_spec.md)

*Document automatically generated from RFC specifications with security review on December 5, 2025*