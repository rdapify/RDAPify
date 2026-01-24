# Security Documentation

Comprehensive security documentation for RDAPify.

## Documents

### [SECURITY.md](SECURITY.md)
Security policy and vulnerability reporting guidelines.

**Contents**:
- Supported versions
- Vulnerability reporting process
- Response timeline
- Security features overview
- Best practices
- Compliance information

**Audience**: All users, security researchers

### [threat_model.md](threat_model.md)
Detailed threat analysis and mitigation strategies.

**Contents**:
- Threat categories
- Attack vectors
- Mitigation strategies
- Risk assessment
- Security controls
- Threat scenarios

**Audience**: Security teams, architects

### [whitepaper.md](whitepaper.md)
Comprehensive security architecture whitepaper.

**Contents**:
- Security architecture
- Defense-in-depth strategy
- Privacy controls
- Compliance (GDPR, CCPA)
- Secure development practices
- Deployment security

**Audience**: CISOs, compliance officers, enterprise architects

## Quick Reference

### Reporting Security Issues

**DO NOT** open public issues for security vulnerabilities.

**Report via**:
- GitHub Security Advisory (preferred)
- Email: security@rdapify.org
- Private disclosure to maintainers

### Security Features

| Feature | Status | Description |
|---------|--------|-------------|
| SSRF Protection | ✅ Active | Blocks private IPs, localhost |
| Certificate Validation | ✅ Active | Strict TLS/SSL verification |
| PII Redaction | ✅ Active | Automatic privacy protection |
| Input Validation | ✅ Active | Sanitizes all user inputs |
| HTTPS Enforcement | ✅ Active | TLS 1.2+ only |

### Security Checklist

For users deploying RDAPify:

- [ ] Enable PII redaction
- [ ] Validate certificates
- [ ] Implement rate limiting
- [ ] Monitor for anomalies
- [ ] Keep dependencies updated
- [ ] Use HTTPS-only environments
- [ ] Review security logs
- [ ] Test security controls

## Directories

### advisories/
Security advisories and vulnerability disclosures.

**Contents**:
- CVE reports
- Security patches
- Disclosure timeline
- Hall of Fame

### audit_reports/
Security audit and penetration test reports.

**Contents**:
- Third-party audits
- Penetration test results
- Compliance assessments
- Remediation status

## Security Resources

### Internal
- [Security Policy](SECURITY.md)
- [Threat Model](threat_model.md)
- [Security Whitepaper](whitepaper.md)

### External
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

### Standards
- [RFC 7480](https://tools.ietf.org/html/rfc7480) - RDAP HTTP Usage
- [RFC 7481](https://tools.ietf.org/html/rfc7481) - RDAP Security Services
- [RFC 1918](https://tools.ietf.org/html/rfc1918) - Private IP Addresses

## Compliance

RDAPify supports compliance with:

- **GDPR** (General Data Protection Regulation)
- **CCPA** (California Consumer Privacy Act)
- **SOC 2** (Service Organization Control)
- **ISO 27001** (Information Security Management)

See [whitepaper.md](whitepaper.md) for detailed compliance information.

## Security Updates

### Subscribing to Updates

1. **GitHub**: Watch repository for security advisories
2. **npm**: Enable security notifications
3. **Email**: Subscribe to security mailing list

### Update Policy

| Severity | Response Time | Release Type |
|----------|--------------|--------------|
| Critical | 1-7 days | Patch release |
| High | 7-14 days | Patch release |
| Medium | 14-30 days | Minor release |
| Low | 30-90 days | Major release |

## Testing Security

### Running Security Tests

```bash
# Run all tests including security
npm test

# Run security-specific tests
npm test -- --testPathPattern=security

# Check dependencies for vulnerabilities
npm audit

# Run custom security checks
node scripts/check-dependencies.js
```

### Manual Security Testing

```bash
# Test SSRF protection
node -e "
const { RDAPClient } = require('./dist');
const client = new RDAPClient();
client.domain('localhost').catch(e => console.log('✅ SSRF blocked:', e.message));
"

# Test PII redaction
node -e "
const { RDAPClient } = require('./dist');
const client = new RDAPClient({ privacy: { redactPII: true } });
client.domain('example.com').then(r => console.log('✅ PII redacted:', !r.entities[0]?.email));
"
```

## Contributing to Security

### Reporting Vulnerabilities

See [SECURITY.md](SECURITY.md) for reporting guidelines.

### Security Improvements

1. Review [threat_model.md](threat_model.md)
2. Identify gaps or improvements
3. Submit pull request with security tests
4. Document changes in security docs

### Security Code Review

All security-related changes require:
- Security team review
- Comprehensive tests
- Documentation updates
- Changelog entry

## Contact

**Security Team**: security@rdapify.org  
**Maintainers**: See [MAINTAINERS.md](../MAINTAINERS.md)  
**GitHub Security**: Use Security Advisory feature

---

**Last Updated**: January 24, 2026  
**Version**: 0.1.0-alpha.4
