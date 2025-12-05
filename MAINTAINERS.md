# MAINTAINERS

**Effective Date:** December 5, 2025  
**Version:** 1.0  
**Last Updated:** December 5, 2025

---

## 🌐 Governance Philosophy

RDAPify operates under a **meritocratic stewardship model** where technical excellence, consistent contributions, and adherence to our core values determine maintainer responsibilities. We balance open collaboration with enterprise-grade reliability requirements, ensuring decisions prioritize:

- **Security-first architecture**
- **Privacy by default**
- **Protocol compliance** (RFC 7480 series)
- **Sustainable operational excellence**

This document defines roles, responsibilities, and processes for project maintainers. All maintainers must comply with our [Code of Conduct](CODE_OF_CONDUCT.md), [Security Policy](SECURITY.md), and [Privacy Policy](PRIVACY.md).

> **📢 Pre-Launch Notice**: The maintainer roles listed below represent the governance structure that will be in place upon General Availability (GA). Specific individuals will be announced at the official project launch. All functional contact addresses are active and monitored.

---

## 👥 Current Maintainers

### Technical Steering Committee (TSC)

| Role | GitHub | Areas of Responsibility | Contact |
|------|--------|--------------------------|---------|
| TSC Chair (To Be Announced) | N/A | Protocol Compliance, Security Architecture | `tsc-chair@rdapify.dev` (PGP) |
| Core Lead (To Be Announced) | N/A | Core Library, Performance Optimization | `core-lead@rdapify.dev` (PGP) |
| Privacy Lead (To Be Announced) | N/A | Privacy Engineering, GDPR/CCPA Compliance | `privacy-lead@rdapify.dev` (PGP) |

*The TSC has final decision authority on architectural changes and security incidents. Rotates chair quarterly.*

### Module Maintainers

| Role | GitHub | Modules | Contact |
|------|--------|---------|---------|
| Caching Lead (TBA) | N/A | Caching Layer, Redis Integration | `module-caching@rdapify.dev` |
| CLI Lead (TBA) | N/A | CLI Tools, Developer Experience | `module-cli@rdapify.dev` |
| Cloud Lead (TBA) | N/A | Cloud Deployments (AWS/Azure/GCP) | `module-cloud@rdapify.dev` |
| Analytics Lead (TBA) | N/A | Monitoring & Analytics Integration | `module-analytics@rdapify.dev` |
| i18n Lead (TBA) | N/A | Internationalization, Localization | `module-i18n@rdapify.dev` |

### Security Response Team (SRT)

| Role | GitHub | Contact (PGP Encrypted) |
|------|--------|-------------------------|
| Security Lead (TBA) | N/A | `security-lead@rdapify.dev` |
| Security Deputy (TBA) | N/A | `security-deputy@rdapify.dev` |
| DPO Liaison (TBA) | N/A | `dpo-liaison@rdapify.dev` |

*SRT operates under [SECURITY.md incident response protocol](SECURITY.md#11-data-breach-protocol)*

---

## 🛡️ Role Definitions & Responsibilities

### Technical Steering Committee (TSC)
- **Architectural Governance**: Final approval on RFCs and major design changes
- **Release Authority**: Sign-off on major/minor releases
- **Maintainer Oversight**: Onboarding/offboarding maintainers
- **Budget Allocation**: Infrastructure and security audit resources
- **Compliance Verification**: Ensuring adherence to regulatory requirements

### Module Maintainers
- **Code Quality**: Enforcing standards in assigned modules
- **Issue Triage**: Prioritizing bugs and feature requests
- **PR Reviews**: Minimum 24-hour response time for critical PRs
- **Documentation**: Maintaining module-specific documentation
- **On-Call Rotation**: Handling production incidents in their domain

### Security Response Team (SRT)
- **24/7 Coverage**: Rotating on-call schedule for security incidents
- **Vulnerability Assessment**: CVSS scoring and impact analysis
- **Patch Development**: Creating and validating security fixes
- **Coordinated Disclosure**: Managing CVE assignments and vendor notifications
- **Compliance Reporting**: GDPR Article 33 breach notifications within 72 hours

---

## ⚙️ Decision Making Framework

### Routine Decisions (Module Maintainers)
- Bug fixes, documentation improvements, minor features
- Requires: 1 maintainer approval + passing CI

### Significant Changes (Requires TSC Approval)
- API surface modifications
- New external dependencies
- Security model changes
- Protocol compliance deviations
- **Process**: RFC submission → 72h community feedback → TSC vote (simple majority)

### Critical Security Decisions (SRT Authority)
- Immediate patch releases for CVSS ≥ 7.0 vulnerabilities
- Temporary feature disablement during incidents
- **Process**: SRT consensus → immediate implementation → post-incident review

### Breaking Changes Protocol
1. RFC submission with migration path
2. 14-day community feedback period
3. Unanimous TSC approval
4. Versioned deprecation notices (minimum 2 minor versions)
5. Enterprise customer notification 30 days before release

---

## 🔐 Security & Compliance Responsibilities

### Security Boundaries
- **No single maintainer** can bypass security checks in CI pipeline
- **Production releases** require signatures from 2 TSC members
- **Cryptographic keys** stored in FIPS 140-2 compliant HSMs with 3-person control
- **Audit logs** of all sensitive operations retained for 365 days

### Compliance Requirements
- Quarterly privacy impact assessments (PIAs) for new features
- Annual third-party security audits (SOC 2 Type II)
- Maintainers complete GDPR/CCPA training annually
- All code changes affecting PII handling require DPO review

### Incident Response Authority
| Severity | Decision Authority | Communication Protocol |
|----------|-------------------|------------------------|
| Critical (CVSS 9-10) | SRT Lead + 1 TSC member | Immediate notification to all maintainers; enterprise customers within 1 hour |
| High (CVSS 7-8.9) | SRT consensus | Notification within 4 hours; patch within 48 hours |
| Medium (CVSS 4-6.9) | Module maintainer + SRT | Patch in next scheduled release |
| Low (CVSS 0-3.9) | Module maintainer | Documented fix in normal release cycle |

---

## 🔄 Maintainer Lifecycle Management

### Onboarding Process
1. **Nomination**: By existing maintainer or self-nomination
2. **Probation** (90 days):
   - Mentorship by senior maintainer
   - Limited commit access to non-critical modules
   - Required completion of security/compliance training
3. **Evaluation Criteria**:
   - ≥ 30 high-quality PRs merged
   - Demonstrated understanding of security principles
   - Consistent constructive engagement in community
4. **TSC Vote**: Unanimous approval required
5. **Access Granting**: Phased privilege escalation over 14 days

### Offboarding Protocol
- **Voluntary departure**: 30-day transition period, access revocation checklist
- **Inactivity**: Commit rights suspended after 180 days of no contributions
- **Code of Conduct violations**: Immediate suspension pending TSC review
- **Security breach**: Immediate revocation of all credentials and access

### Access Management Matrix
| Access Level | GitHub Permissions | Production Systems | Security Keys | Approval Required |
|--------------|-------------------|-------------------|--------------|------------------|
| Contributor | Read + fork | None | None | None |
| Module Maintainer | Write to module | Staging environments | None | TSC majority |
| TSC Member | Admin (protected branches) | Production deployment | Signing keys | Unanimous TSC |
| SRT Member | Security branch access only | Incident response systems | Emergency keys | SRT Lead + DPO |

---

## 🤝 Conflict Resolution

### Technical Disagreements
1. **Module-level**: Module maintainer has final authority within domain
2. **Cross-module**: TSC technical vote (simple majority)
3. **Architecture**: RFC process with external domain expert consultation

### Behavioral Issues
1. **Private mediation** by uninvolved TSC member
2. **Formal warning** with documented expectations
3. **Temporary suspension** pending conduct review
4. **Removal** after unanimous TSC vote for repeated violations

*All conduct reviews follow procedures in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md#-التعامل-مع-الانتهاكات)*

---

## 📬 Communication Protocols

### Routine Channels
- **GitHub Issues/PRs**: All technical discussions
- **Matrix/Element**: Real-time coordination (`#rdapify-maintainers:matrix.org`)
- **Bi-weekly Sync**: Video call for roadmap alignment (recorded, transcribed)

### Critical Communications
- **Security Incidents**: PGP-encrypted email + Signal group
- **Compliance Events**: Encrypted email to `dpo@rdapify.dev` with subject "COMPLIANCE"
- **Enterprise Customer Issues**: Dedicated Slack channel with 4-hour SLA

### Availability Expectations
- **Critical Security Issues**: 2-hour response time (24/7 rotation)
- **High-Priority Bugs**: 24-hour response time
- **PR Reviews**: 48-hour maximum for code changes
- **Planned Outages**: 72-hour advance notice to enterprise customers

---

## 🗓️ Document Maintenance

This document is reviewed quarterly by the TSC and updated as needed. All changes require:
1. PR submission to `main` branch
2. Unanimous TSC approval
3. 72-hour community feedback window
4. Version increment following semver principles

---

## 🌍 Regional Compliance Officers

| Region | Officer | Responsibilities | Contact |
|--------|---------|------------------|---------|
| EMEA | Compliance Officer (EMEA) | GDPR compliance, EU data transfers | `emea-compliance@rdapify.dev` |
| Americas | Compliance Officer (Americas) | CCPA/CPRA, SOC 2 compliance | `americas-compliance@rdapify.dev` |
| APAC | Compliance Officer (APAC) | PDPA alignment, regional legal requirements | `apac-compliance@rdapify.dev` |

---

> ℹ️ **Transparency Note**: This governance structure intentionally balances open collaboration with enterprise requirements. While maintainers have special privileges, all significant decisions are made transparently through our [RFC process](docs/governance/rfc-process.md). We welcome community feedback on this document via PR submissions.

---

**PGP Key Information**  
All maintainer email addresses have associated PGP keys available at:  
https://rdapify.dev/security/maintainer-keys.asc

**Emergency Contact**  
For critical security incidents requiring immediate attention:  
`emergency@rdapify.dev` (PGP encrypted) with subject line "CRITICAL: [Brief Description]"

---

© 2025 RDAPify Governance Committee  
Licensed under the [MIT License](LICENSE)  
[Last Updated: December 5, 2025](https://github.com/rdapify/rdapify/commits/main/MAINTAINERS.md)