# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

**DO NOT** open a public GitHub issue for security vulnerabilities.

Instead, please report security issues via:

- **Email**: security@rdapify.org (if available)
- **GitHub Security Advisory**: Use the "Security" tab in the repository
- **Private Disclosure**: Contact maintainers directly

### What to Include

Please provide:

1. **Description**: Clear description of the vulnerability
2. **Impact**: Potential impact and severity assessment
3. **Reproduction**: Step-by-step instructions to reproduce
4. **Environment**: Affected versions and configurations
5. **Proof of Concept**: Code or screenshots (if applicable)
6. **Suggested Fix**: Proposed solution (optional)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: 1-7 days
  - High: 7-14 days
  - Medium: 14-30 days
  - Low: 30-90 days

### Disclosure Policy

- We follow **coordinated disclosure**
- Security advisories published after fix is released
- Credit given to reporters (unless anonymity requested)
- CVE assigned for significant vulnerabilities

## Security Features

### Built-in Protections

1. **SSRF Protection**
   - Blocks private IP ranges (RFC 1918)
   - Validates all external URLs
   - Prevents localhost access
   - Enforces HTTPS-only connections

2. **Input Validation**
   - Domain name validation
   - IP address validation (IPv4/IPv6)
   - ASN validation
   - Sanitizes all user inputs

3. **PII Redaction**
   - Automatic personal data removal
   - GDPR/CCPA compliance
   - Configurable redaction rules
   - Privacy-by-default design

4. **Certificate Validation**
   - Strict TLS/SSL verification
   - Certificate pinning support
   - Rejects self-signed certificates
   - Enforces modern TLS versions

### Security Best Practices

#### For Users

```javascript
// ✅ GOOD - Enable all security features
const client = new RDAPClient({
  privacy: { redactPII: true },
  validateCertificates: true,
  timeout: 5000,
});

// ❌ BAD - Disabling security features
const client = new RDAPClient({
  privacy: { redactPII: false },
  validateCertificates: false,
});
```

#### Input Validation

```javascript
// ✅ GOOD - Validate before querying
function isValidDomain(domain) {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i.test(domain);
}

if (isValidDomain(userInput)) {
  const result = await client.domain(userInput);
}

// ❌ BAD - Direct user input
const result = await client.domain(req.query.domain);
```

#### Rate Limiting

```javascript
// ✅ GOOD - Implement rate limiting
const limiter = new RateLimiter({ tokensPerSecond: 5 });
await limiter.acquire();
const result = await client.domain(domain);
```

## Known Security Considerations

### Network Security

- **DNS Rebinding**: SSRF protection mitigates this
- **Man-in-the-Middle**: TLS validation prevents this
- **Cache Poisoning**: Cache keys are cryptographically hashed

### Data Privacy

- **PII Exposure**: Automatic redaction enabled by default
- **Data Retention**: Cache TTL limits data storage
- **Logging**: No sensitive data logged

### Dependency Security

- Regular dependency audits via `npm audit`
- Automated security updates via Dependabot
- Minimal dependency footprint

## Security Audits

Security audits are conducted:
- Before major releases
- After significant security updates
- Annually for LTS versions

Audit reports available in `security/audit_reports/`

## Security Updates

Subscribe to security updates:
- GitHub Security Advisories
- Release notes (CHANGELOG.md)
- npm security advisories

## Compliance

RDAPify is designed to support:
- **GDPR**: Privacy-by-default, PII redaction
- **CCPA**: Data minimization, user privacy
- **SOC 2**: Security controls, audit logging
- **ISO 27001**: Information security standards

## Contact

For security concerns:
- Security Team: security@rdapify.org
- Maintainers: See MAINTAINERS.md
- GitHub: Use Security Advisory feature

## Acknowledgments

We thank security researchers who responsibly disclose vulnerabilities.

Hall of Fame: `security/advisories/HALL_OF_FAME.md`
