# 📜 Code of Conduct: RDAPify Community

**Effective Date:** December 5, 2025  
**Version:** 1.1  
**[Table of Contents](#table-of-contents) • [Reporting Violations](#reporting-violations) • [Contact](#contact)**

---

## 🌐 Table of Contents 

- [Our Pledge and Values](#our-pledge-and-values)
- [Behavioral Standards](#behavioral-standards)
  - [Expected Behaviors](#expected-behaviors)
  - [Unacceptable Behaviors](#unacceptable-behaviors)
  - [Technical Project Standards](#technical-project-standards)
- [Accountability and Enforcement](#accountability-and-enforcement)
  - [Leader Responsibilities](#leader-responsibilities)
  - [Reporting Process](#reporting-process)
  - [Response Framework](#response-framework)
- [Community Support](#community-support)
  - [For New Contributors](#for-new-contributors)
  - [For Enterprise Contributors](#for-enterprise-contributors)
- [Compliance and Privacy](#compliance-and-privacy)
- [Contact](#contact)

---

## 🤝 Our Pledge and Values

As members, contributors, and leaders of the **RDAPify** project, we pledge to make participation in our community a harassment-free experience for everyone, regardless of age, body size, visible or invisible disability, ethnicity, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, caste, color, religion, or sexual identity and orientation.

We are committed to creating a professional environment that embodies the core principles of internet infrastructure:

- **Openness** in knowledge sharing and collaboration
- **Resilience** in technical design and community support
- **User sovereignty** in data control and privacy protection
- **Ethical responsibility** in handling registration data

As a project that processes potentially sensitive registration data, we recognize our special responsibility to model exemplary behavior in privacy protection, security practices, and regulatory compliance.

---

## 📏 Behavioral Standards

### Expected Behaviors

- **Professional Communication**
  - Use clear, respectful language in all interactions
  - Assume good faith when interpreting others' communications
  - Provide constructive, actionable feedback focused on code and ideas, not individuals
  - Acknowledge and credit others' contributions appropriately

- **Technical Excellence**
  - Prioritize security and privacy in all technical discussions
  - Consider regulatory implications (GDPR, CCPA, etc.) when proposing changes
  - Follow established patterns in [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md)
  - Document rationale for technical decisions, especially those affecting privacy

- **Inclusive Collaboration**
  - Make space for diverse perspectives in technical discussions
  - Offer mentorship to newcomers when appropriate
  - Use gender-neutral language in documentation and code comments
  - Respect time zone differences in asynchronous communication

### Unacceptable Behaviors

- **Personal Conduct Violations**
  - Harassment, intimidation, or personal attacks
  - Unwelcome sexual attention or inappropriate imagery
  - Publishing others' private information without consent
  - Deliberate misgendering or use of rejected names

- **Technical Ethics Violations**
  - Dismissing legitimate security concerns as "overly paranoid"
  - Advocating for features that would bypass PII redaction or privacy controls
  - Introducing dependencies with known vulnerabilities without disclosure
  - Circumventing review processes for security-sensitive changes

- **Compliance Violations**
  - Pressuring contributors to compromise on GDPR/CCPA requirements
  - Dismissing regulatory concerns relevant to global deployment
  - Attempting to introduce tracking mechanisms without transparent disclosure
  - Failing to document data processing implications of technical changes

### Technical Project Standards

Given our project's focus on internet infrastructure and registration data:

- **All code contributions** must maintain the privacy-preserving defaults of the library
- **Security reviews** are mandatory for any changes affecting data handling
- **Architecture decisions** must consider implications for data minimization principles
- **Documentation changes** must accurately represent privacy and security capabilities

When reviewing code:

```markdown
✅ GOOD: "This implementation maintains PII redaction while adding the requested feature."
✅ GOOD: "I've added tests verifying that private IP ranges are properly blocked."

❌ AVOID: "Privacy concerns are slowing down development."
❌ AVOID: "We can add security later; let's get this feature out first."
```

---

## ⚖️ Accountability and Enforcement

### Leader Responsibilities

Project maintainers are responsible for:

- Clearly communicating standards and expectations
- Enforcing this Code of Conduct consistently and fairly
- Taking appropriate action when violations occur
- Providing regular transparency reports on enforcement actions (while protecting privacy)
- Maintaining up-to-date contact information for reports

### Reporting Process

If you experience or witness violations:

1. **Document the incident** (screenshots, links, context)
2. **Report through appropriate channels**:
   - Standard issues: `conduct@rdapify.com`
   - Critical security/privacy violations: `security@rdapify.com` (PGP encrypted)
   - Enterprise compliance concerns: `compliance@rdapify.com`
3. **Expect response timeline**:
   - Initial acknowledgment: Within 24 business hours
   - Preliminary assessment: Within 72 business hours
   - Full resolution plan: Within 1 week for standard issues, 48 hours for critical issues

All reports are treated as confidential, with information shared only on a need-to-know basis with the Response Team.

### Response Framework

| Severity Level | Community Impact | Response Actions |
|----------------|------------------|------------------|
| **1: Correction** | Minor inappropriate language or tone | • Private written warning<br>• Request for clarification or apology<br>• Documentation of incident |
| **2: Warning** | Pattern of minor violations or single moderate incident | • Formal written warning<br>• Required remedial actions (e.g., additional training)<br>• Temporary restriction from specific project spaces |
| **3: Temporary Ban** | Serious violations or repeated incidents | • 30-90 day exclusion from all project spaces<br>• Required meeting with Response Team before reinstatement<br>• Public apology may be required |
| **4: Permanent Ban** | Severe violations, deliberate harm, or advocacy of unethical practices | • Permanent removal from all project spaces<br>• Revocation of commit/merge privileges<br>• Public statement if necessary to protect community |

For violations involving data privacy or security:
- The Data Protection Officer (DPO) will be immediately notified
- Regulatory reporting obligations will be assessed
- Users potentially affected by data mishandling will be notified per [PRIVACY.md](PRIVACY.md)

---

## 🤲 Community Support

### For New Contributors

We actively encourage and support new community members:

- **Mentorship Program**: Every first-time contributor is paired with an experienced maintainer
- **Beginner-Friendly Labels**: Issues marked with `good first issue` or `documentation` are ideal starting points
- **Office Hours**: Weekly sessions (Thursdays 2PM UTC) dedicated to helping newcomers
- **Grace Period**: First-time formatting or procedural mistakes receive guidance rather than rejection

> "Thank you for your first contribution! We notice a few items that need adjustment before merging. We're happy to guide you through these changes - this is how we all learn."

### For Enterprise Contributors

Organizations contributing to RDAPify should:

- **Declare institutional affiliation** when contributing on behalf of an employer
- **Disclose potential conflicts of interest** related to commercial products
- **Maintain separation** between personal and corporate contributions
- **Follow additional compliance procedures** outlined in [docs/enterprise/contributing.md](docs/enterprise/contributing.md)

Enterprise contributors receive:
- Dedicated review paths for critical security patches
- Compliance review assistance for regulated environments
- Recognition in enterprise adoption materials (with permission)

---

## 🔒 Compliance and Privacy

As a project handling potentially sensitive registration data:

- **Data Protection**: Any incident involving mishandling of personal information will be escalated to our Data Protection Officer per GDPR Article 33 requirements
- **Regulatory Alignment**: Our technical decisions align with GDPR, CCPA, and international privacy frameworks
- **Transparency**: We maintain a public log of significant enforcement actions (anonymized) in [docs/governance/enforcement-log.md](docs/governance/enforcement-log.md)
- **Third-Party Dependencies**: All dependencies undergo security and license review according to [docs/security/dependencies.md](docs/security/dependencies.md)

Contributors working on privacy-sensitive features must:
- Complete the Privacy Impact Assessment template for significant changes
- Consult with the DPO for changes affecting data processing
- Document compliance considerations in relevant pull requests

---

## ✉️ Contact

For questions about this Code of Conduct:

- **General inquiries**: `conduct@rdapify.com`
- **Urgent safety concerns**: `security@rdapify.com` (with PGP encryption)
- **Enterprise compliance**: `compliance@rdapify.com`
- **Data protection matters**: `dpo@rdapify.com`

**Public Channels**:
- GitHub Discussions: [Community Forum](https://github.com/rdapify/rdapify/discussions)
- Real-time chat: [Matrix/Element Channel](https://matrix.to/#/#rdapify:matrix.org)
- Weekly Office Hours: Thursdays 2PM UTC via [Zoom link](https://rdapify.com/community/office-hours)

---

## 🙏 Attribution and License

This Code of Conduct is adapted from the [Contributor Covenant v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct.html), enhanced to reflect RDAPify's focus on internet infrastructure, privacy engineering, and regulatory compliance.

© 2025 RDAPify Community  
Licensed under the [MIT License](LICENSE)  
Last updated: December 5, 2025

*This document itself is subject to the Code of Conduct. Suggestions for improvement can be submitted as issues or pull requests with the `documentation` label.*