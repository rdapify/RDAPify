# Security Documentation

This directory contains security-related documentation, threat models, and audit reports for RDAPify.

## Contents

- **whitepaper.md** - Comprehensive security whitepaper
- **threat_model.md** - Threat modeling and risk assessment
- **advisories/** - Security advisories and vulnerability disclosures
- **audit_reports/** - Third-party security audit reports

## Security Features

RDAPify implements multiple security layers:
- SSRF protection with RFC 1918 filtering
- Certificate validation for HTTPS connections
- PII redaction for privacy compliance
- Input validation and sanitization
- Rate limiting and abuse prevention

## Reporting Vulnerabilities

Please refer to [SECURITY.md](../SECURITY.md) in the root directory for our vulnerability disclosure policy.

## Security Updates

Security patches are released immediately for critical vulnerabilities. Subscribe to security advisories to stay informed.
