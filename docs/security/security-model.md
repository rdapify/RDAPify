# Security Model

RDAPify is built with security as a core principle. This document outlines our security architecture, threat model, and protection mechanisms.

---

## Overview

RDAPify handles sensitive network operations and registration data. Our security model addresses:

1. **SSRF (Server-Side Request Forgery) Protection**
2. **PII (Personally Identifiable Information) Redaction**
3. **Data Validation & Sanitization**
4. **Secure Defaults**
5. **Audit & Compliance**

---

## Threat Model

### Threats We Protect Against

#### 1. Server-Side Request Forgery (SSRF)

**Risk**: Malicious actors could trick the application into making requests to internal networks or unauthorized endpoints.

**Protection**:
- ✅ HTTPS-only by default
- ✅ Blocklist for private IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- ✅ Blocklist for localhost (127.0.0.0/8, ::1)
- ✅ Blocklist for link-local addresses (169.254.0.0/16, fe80::/10)
- ✅ Blocklist for internal TLDs (.internal, .corp, .local)
- ✅ Configurable allowlist/blocklist
- ✅ DNS resolution validation

**Example**:
```typescript
const client = new RDAPClient({
  ssrfProtection: {
    enabled: true,
    blockPrivateIPs: true,
    blockLocalhost: true,
    allowedDomains: ['rdap.verisign.com', 'rdap.arin.net']
  }
});
```

#### 2. Privacy Violations (PII Exposure)

**Risk**: RDAP responses may contain personal information that should be redacted based on privacy regulations (GDPR, CCPA).

**Protection**:
- ✅ Automatic PII detection and redaction
- ✅ Configurable redaction rules
- ✅ Email address masking
- ✅ Phone number masking
- ✅ Physical address redaction
- ✅ Compliance with GDPR/CCPA

**Example**:
```typescript
const client = new RDAPClient({
  privacy: {
    redactEmails: true,
    redactPhones: true,
    redactAddresses: true,
    customRedactionRules: [
      { pattern: /SSN:\s*\d{3}-\d{2}-\d{4}/, replacement: 'SSN: [REDACTED]' }
    ]
  }
});
```

#### 3. Data Injection Attacks

**Risk**: Malicious input could lead to injection attacks or unexpected behavior.

**Protection**:
- ✅ Strict input validation for domains, IPs, and ASNs
- ✅ Type-safe TypeScript implementation
- ✅ Sanitization of all user inputs
- ✅ No eval() or dynamic code execution
- ✅ Safe JSON parsing with error handling

#### 4. Denial of Service (DoS)

**Risk**: Excessive requests could overwhelm RDAP servers or the application.

**Protection**:
- ✅ Built-in rate limiting
- ✅ Configurable request timeouts
- ✅ Exponential backoff for retries
- ✅ Circuit breaker pattern
- ✅ Request queue management

**Example**:
```typescript
const client = new RDAPClient({
  rateLimit: {
    maxRequests: 10,
    perMilliseconds: 1000
  },
  timeout: 5000,
  retry: {
    maxAttempts: 3,
    backoff: 'exponential'
  }
});
```

#### 5. Man-in-the-Middle (MITM) Attacks

**Risk**: Network traffic could be intercepted or modified.

**Protection**:
- ✅ HTTPS-only connections (enforced)
- ✅ TLS certificate validation
- ✅ No HTTP fallback
- ✅ Secure defaults

---

## Security Features

### 1. SSRF Protection Layer

**Architecture**:
```
User Input → Validation → SSRF Check → DNS Resolution → Request
                ↓            ↓              ↓
              Reject      Reject         Reject
```

**Implementation**:
- Pre-request validation of all URLs
- IP address classification (public/private/localhost/link-local)
- Domain name validation against internal TLDs
- Configurable allowlist/blocklist
- Fail-closed by default (reject on error)

**Test Coverage**: 20 unit tests covering all edge cases

### 2. PII Redaction Layer

**Architecture**:
```
RDAP Response → Parse → Detect PII → Redact → Return to User
```

**Redaction Rules**:
- Email: `user@example.com` → `[EMAIL REDACTED]`
- Phone: `+1-555-1234` → `[PHONE REDACTED]`
- Address: Full address → `[ADDRESS REDACTED]`
- Custom patterns via regex

**Compliance**:
- GDPR Article 17 (Right to erasure)
- CCPA Section 1798.105 (Right to deletion)
- Configurable per-jurisdiction

### 3. Input Validation

**Domain Validation**:
- RFC 1035 compliance
- Length limits (253 characters)
- Character restrictions
- No consecutive dots
- No leading/trailing dots or hyphens

**IP Validation**:
- IPv4: Strict octet validation (0-255)
- IPv6: Full format support
- No leading zeros (security best practice)
- CIDR notation support

**ASN Validation**:
- Range: 0 to 4,294,967,295 (32-bit)
- Format: Number or "AS" prefix
- Type safety

### 4. Secure Defaults

All security features are **enabled by default**:

```typescript
// Default configuration
{
  ssrfProtection: {
    enabled: true,
    blockPrivateIPs: true,
    blockLocalhost: true,
    blockLinkLocal: true
  },
  privacy: {
    redactEmails: true,
    redactPhones: true,
    redactAddresses: true
  },
  https: {
    enforced: true,
    rejectUnauthorized: true
  }
}
```

Users must **explicitly opt-out** to disable protections.

---

## Audit & Compliance

### Logging

RDAPify provides optional audit logging:

```typescript
const client = new RDAPClient({
  audit: {
    enabled: true,
    logLevel: 'info',
    logRedactions: true,
    logBlockedRequests: true
  }
});
```

**Logged Events**:
- SSRF blocks (with reason)
- PII redactions (count, not content)
- Failed validations
- Rate limit hits
- Timeout events

### Compliance Features

**GDPR**:
- ✅ Right to erasure (PII redaction)
- ✅ Data minimization (configurable)
- ✅ Purpose limitation (audit logs)
- ✅ Transparency (clear documentation)

**CCPA**:
- ✅ Right to deletion (PII redaction)
- ✅ Right to know (audit logs)
- ✅ Opt-out mechanisms (configuration)

**SOC 2**:
- ✅ Access controls (SSRF protection)
- ✅ Data protection (encryption in transit)
- ✅ Monitoring (audit logs)
- ✅ Incident response (error handling)

---

## Security Testing

### Test Coverage

- **Unit Tests**: 146 tests (100% of security features)
- **Integration Tests**: Real RDAP endpoint testing
- **Security Tests**: Dedicated SSRF and PII test suites

### Continuous Security

- **Dependabot**: Automated dependency updates
- **npm audit**: Run on every PR and release
- **CodeQL**: Static analysis on every commit
- **Snyk**: Vulnerability scanning (optional)

### Penetration Testing

We welcome security researchers to test RDAPify:
- **Scope**: SSRF, injection, DoS, privacy violations
- **Disclosure**: security@rdapify.com
- **Response**: 90-day disclosure timeline

---

## Best Practices for Users

### 1. Use Allowlists in Production

```typescript
const client = new RDAPClient({
  ssrfProtection: {
    allowedDomains: [
      'rdap.verisign.com',
      'rdap.arin.net',
      'rdap.ripe.net',
      'rdap.apnic.net',
      'rdap.lacnic.net'
    ]
  }
});
```

### 2. Enable Audit Logging

```typescript
const client = new RDAPClient({
  audit: {
    enabled: true,
    logLevel: 'warn',
    logBlockedRequests: true
  }
});
```

### 3. Set Appropriate Timeouts

```typescript
const client = new RDAPClient({
  timeout: 5000,  // 5 seconds
  retry: {
    maxAttempts: 2,
    backoff: 'exponential'
  }
});
```

### 4. Validate User Input

```typescript
import { validateDomain, validateIP, validateASN } from 'rdapify';

// Always validate before querying
try {
  validateDomain(userInput);
  const result = await client.queryDomain(userInput);
} catch (error) {
  // Handle validation error
}
```

### 5. Handle Errors Gracefully

```typescript
try {
  const result = await client.queryDomain('example.com');
} catch (error) {
  if (error instanceof SSRFProtectionError) {
    // SSRF attempt blocked
  } else if (error instanceof ValidationError) {
    // Invalid input
  } else if (error instanceof NetworkError) {
    // Network issue
  }
}
```

---

## Reporting Security Issues

We take security seriously. If you discover a vulnerability:

1. **DO NOT** open a public issue
2. Email: security@rdapify.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

**Response Timeline**:
- Acknowledgment: Within 48 hours
- Initial assessment: Within 7 days
- Fix timeline: Based on severity
- Public disclosure: After fix + 90 days

**Recognition**:
- Security researchers will be credited (with permission)
- Hall of Fame on our website
- Swag for significant findings

---

## Security Roadmap

### Planned Features

- [ ] Certificate pinning for known RDAP servers
- [ ] Request signing for authenticated queries
- [ ] Enhanced rate limiting with token bucket
- [ ] Anomaly detection for unusual patterns
- [ ] Integration with security information systems (SIEM)
- [ ] Compliance reporting dashboard

### Under Consideration

- [ ] End-to-end encryption for cached data
- [ ] Hardware security module (HSM) support
- [ ] Multi-factor authentication for admin operations
- [ ] Blockchain-based audit trail

---

## References

### Standards & RFCs

- [RFC 7480](https://tools.ietf.org/html/rfc7480) - HTTP Usage in RDAP
- [RFC 7481](https://tools.ietf.org/html/rfc7481) - Security Services for RDAP
- [RFC 7482](https://tools.ietf.org/html/rfc7482) - RDAP Query Format
- [RFC 7483](https://tools.ietf.org/html/rfc7483) - RDAP Response Format
- [RFC 7484](https://tools.ietf.org/html/rfc7484) - RDAP Bootstrap

### Security Resources

- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [GDPR Official Text](https://gdpr-info.eu/)
- [CCPA Official Text](https://oag.ca.gov/privacy/ccpa)
- [CWE-918: SSRF](https://cwe.mitre.org/data/definitions/918.html)

---

## License

This security model is part of RDAPify and is licensed under the MIT License.

**Last Updated**: January 25, 2026  
**Version**: 1.0  
**Maintained By**: RDAPify Security Team
