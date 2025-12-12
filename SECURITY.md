# Security Policy

## Overview

Security is foundational to RDAPify's design. As a library that interacts with internet registry data and makes network requests on behalf of applications, we take a defense-in-depth approach to security with particular emphasis on **SSRF protection**, input validation, and secure data handling.

This document outlines our security policies and procedures. For comprehensive technical details, see our [Security Whitepaper](security/whitepaper.md).

## Supported Versions 

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | ✅ Full support    |
| 0.9.x   | ⚠️ Security fixes only |
| < 0.9.x | ❌ Not supported   |

## Reporting a Vulnerability

### Preferred Method
Email security reports to: **security@rdapify.com**  
PGP Key: [Download PGP Key](https://rdapify.com/security/pgp-key.asc)  
Fingerprint: `A1B2 C3D4 E5F6 7890 1234 5678 9ABC DEF0 1234 5678`

### Alternative Methods
- GitHub Security Advisory (private)
- HackerOne (coming Q1 2026)

### Information to Include
For a faster response, please include:
- Clear description of the vulnerability
- Steps to reproduce (POC if possible)
- Potential impact and attack scenarios
- Suggested fix (optional but helpful)

### Response Timeline
- **Initial response**: Within 48 hours
- **Triage and validation**: 3-5 business days
- **Fix development**: Depends on severity
- **Coordinated disclosure**: 90 days after initial report

## Security Vulnerability Classification

### Critical 🛑
- SSRF vulnerabilities allowing internal network access
- Remote code execution
- Authentication bypass in enterprise features
- **Response**: Patch within 7 days, immediate notification to enterprise customers

### High ⚠️
- Denial of Service vectors
- Data injection leading to application compromise
- Sensitive data exposure (PII, credentials)
- **Response**: Patch within 14 days

### Medium 🔶
- Cache poisoning vulnerabilities
- Information disclosure in error messages
- Weak cryptographic implementations
- **Response**: Patch within 30 days

### Low 🔷
- Documentation errors with security implications
- Minor permission issues
- Non-exploitable race conditions
- **Response**: Patch in next regular release

## Core Security Protections

### SSRF Prevention
RDAPify implements multiple layers of protection against Server-Side Request Forgery:

1. **Domain Validation**: Only allows queries to IANA-approved RDAP servers
2. **IP Filtering**: Blocks requests to private IP ranges (RFC 1918):
   - 10.0.0.0/8
   - 172.16.0.0/12
   - 192.168.0.0/16
   - 169.254.0.0/16 (link-local)
   - 127.0.0.0/8 (loopback)
3. **Protocol Restrictions**: Only allows `http:` and `https:` protocols
4. **Certificate Validation**: Mandatory HTTPS with certificate pinning options
5. **Request Isolation**: Network requests are isolated from application logic

### Data Security
- **PII Redaction**: Automatic redaction of personal data per GDPR requirements
- **Data Minimization**: No persistent storage of query results unless explicitly configured
- **Memory Safety**: Secure handling of sensitive data to prevent memory disclosure
- **No Telemetry by Default**: All analytics and telemetry are opt-in only

### Operational Security
- **Rate Limiting**: Protection against abuse and enumeration attacks
- **Timeout Enforcement**: Hard limits on request duration to prevent resource exhaustion
- **Memory Constraints**: Bounded cache sizes to prevent out-of-memory attacks
- **Input Validation**: Strict schema validation for all inputs and responses

## Secure Deployment Guidelines

### Production Configuration Recommendations
```typescript
const client = new RDAPClient({
  // Network Security
  timeout: 5000,               // 5 second max timeout
  httpsOnly: true,             // Reject HTTP connections
  validateCertificates: true, // Enforce certificate validation
  
  // SSRF Protection
  allowPrivateIPs: false,       // Block private IP ranges
  whitelistRDAPServers: true,   // Use only IANA bootstrap servers
  
  // Privacy Compliance
  redactPII: true,              // GDPR-compliant data handling
  includeRaw: false,            // Don't store raw responses
  
  // Resource Protection
  rateLimit: { max: 100, window: 60000 }, // 100 requests/minute
  maxConcurrent: 10,            // Limit parallel requests
  cacheTTL: 3600                // 1 hour max cache time
});
```

### Environment Hardening
- **Network Segmentation**: Deploy RDAPify in isolated network zones with egress filtering
- **Least Privilege**: Run with minimal OS permissions (non-root containers)
- **Dependency Management**: Use dependency scanning tools (Snyk, Dependabot)
- **Regular Updates**: Subscribe to security advisories for timely patching

## Security Testing

### Automated Security Tests
All commits undergo:
- Static Application Security Testing (SAST)
- Dependency vulnerability scanning
- Fuzz testing for input handling
- Memory safety analysis

Run security tests locally:
```bash
npm run test:security    # SSRF and injection tests
npm run test:fuzzing     # Input fuzzing
npm run audit            # Dependency vulnerability check
```

### Third-Party Audits
- Annual penetration testing by certified security firms
- Quarterly dependency audits
- Bug bounty program (launching Q1 2026)

## Compliance Standards

RDAPify is designed to help you meet compliance requirements:

| Standard | Coverage | Documentation |
|----------|----------|---------------|
| **GDPR** | ✅ Full | [Privacy Policy](PRIVACY.md) |
| **CCPA** | ✅ Full | [Privacy Policy](PRIVACY.md) |
| **SOC 2** | ⚠️ In progress | Available to enterprise customers |
| **OWASP ASVS** | ✅ Level 1-2 | [Security Whitepaper](security/whitepaper.md) |
| **NIST 800-53** | ⚠️ Partial | Available to enterprise customers |

## Security Advisories

Published security advisories are available at:
- [GitHub Security Advisories](https://github.com/rdapify/rdapify/security/advisories)
- [npm Security Advisories](https://www.npmjs.com/advisories?search=rdapify)
- [RDAPify Security Page](https://rdapify.com/security/advisories)

Subscribe to security notifications:
- GitHub Watch "Security only" notifications
- RSS feed: https://rdapify.com/security/feed.xml
- Email list: security-announce+subscribe@rdapify.com

## Acknowledgements

We thank the following security researchers for their responsible disclosure and contributions to RDAPify's security:

- [Researcher Name] - [Vulnerability Type] - [Date]
- [Researcher Name] - [Vulnerability Type] - [Date]

[Learn about our bug bounty program](https://rdapify.com/security/bug-bounty) (coming Q1 2026).

## Contact

For security-related questions or concerns:
- **Security Team**: security@rdapify.com (PGP encrypted preferred)
- **Enterprise Security**: enterprise-security@rdapify.com
- **Urgent Issues**: +1-555-SEC-RDAP (for enterprise customers with SLA)

---

> **Note**: This document is regularly updated. Last reviewed: December 5, 2025  
> Full technical details available in the [Security Whitepaper](security/whitepaper.md).  
> RDAPify is provided "as is" without warranty. See [LICENSE](LICENSE) for full terms.