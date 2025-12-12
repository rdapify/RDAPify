# Glossary of Terms

🎯 **Purpose**: Comprehensive glossary of technical, security, compliance, and organizational terms used throughout the RDAPify documentation and codebase  
📚 **Related**: [RFC References](rfcs.md) | [Links](links.md) | [Papers](papers.md) | [Specifications](../../specifications/rdap_rfc.md)  
⏱️ **Reading Time**: 3 minutes  
🔍 **Pro Tip**: Use the [Glossary Search Tool](../../playground/glossary-search.md) to quickly find definitions and related concepts across the documentation

## 📚 Technical Terms

### Bootstrap Service
**Definition**: A standardized endpoint that provides the base URLs for querying RDAP data across different registries. The IANA maintains the root bootstrap service for domain names, IP addresses, and AS numbers.  
**Context**: RDAPify uses the IANA bootstrap service to dynamically discover the appropriate RDAP server for any given query, eliminating the need for hardcoded registry mappings.  
**Related**: [IANA Bootstrap](../../specifications/bootstrap.md), [Discovery Flow](../../architecture/discovery.md)

### Domain Name System (DNS)
**Definition**: A hierarchical distributed naming system that translates human-readable domain names to numerical IP addresses. The DNS system is foundational to internet operations and RDAP data discovery.  
**Context**: RDAPify leverages DNS for initial resolution but operates at the application layer to provide registration data rather than address resolution.  
**Related**: [DNS Resolution](../../guides/dns_resolution.md), [RDAP vs DNS](../../comparisons/vs_whois.md)

### Normalization
**Definition**: The process of transforming heterogeneous RDAP responses from different registries into a consistent, structured format with predictable field names and data types.  
**Context**: RDAPify applies advanced normalization using JSONPath expressions and registry-specific adapters to ensure consistent data structures regardless of source registry.  
**Related**: [Normalization Pipeline](../../architecture/normalization_pipeline.md), [JSONPath Schema](../../specifications/jsonpath_schema.md)

### Registration Data Access Protocol (RDAP)
**Definition**: An IETF-standardized protocol (RFC 7480 series) that provides a machine-readable replacement for the legacy WHOIS protocol, offering structured JSON responses with standardized fields and improved privacy controls.  
**Context**: RDAPify is built exclusively around the RDAP protocol, with no WHOIS fallback, to ensure consistent, modern data access while maintaining privacy and security standards.  
**Related**: [RFC 7480](../../specifications/rdap_rfc.md), [What is RDAP](../../core_concepts/what_is_rdap.md)

### Server-Side Request Forgery (SSRF)
**Definition**: A security vulnerability where an attacker can induce a server to make unauthorized requests to internal or external systems, potentially accessing sensitive data or services.  
**Context**: RDAP clients are inherently vulnerable to SSRF because they must make outbound requests to user-specified domains; RDAPify implements multi-layer SSRF protection to prevent exploitation.  
**Related**: [SSRF Prevention](../../security/ssrf_prevention.md), [Threat Model](../../security/threat_model.md)

## 🔐 Security & Privacy Terms

### Data Minimization
**Definition**: The practice of collecting and processing only the minimum amount of personal data necessary for a specific, explicit, and legitimate purpose, as required by GDPR Article 5(1)(c).  
**Context**: RDAPify enforces data minimization through configurable field filtering, automatic PII redaction, and retention policies that align with regulatory requirements.  
**Related**: [GDPR Compliance](../../security/compliance.md), [PII Detection](../../security/pii_detection.md)

### Personally Identifiable Information (PII)
**Definition**: Any information that can be used to identify or contact a specific individual, including but not limited to names, email addresses, phone numbers, physical addresses, and IP addresses in certain contexts.  
**Context**: RDAPify automatically detects and redacts PII according to jurisdiction-specific requirements, with configurable redaction policies for enterprise environments.  
**Related**: [PII Redaction](../../security/custom_redaction.md), [Data Minimization](../../guides/data_minimization.md)

### Redaction
**Definition**: The process of removing or obscuring sensitive personal information from data outputs while preserving the utility of the remaining data.  
**Context**: RDAPify implements context-aware redaction that adapts to jurisdiction requirements, user consent status, and business purpose to ensure regulatory compliance while maintaining data usefulness.  
**Related**: [Custom Redaction](../../security/custom_redaction.md), [GDPR Article 6](../../security/compliance.md)

### Zero Trust Architecture
**Definition**: A security model that requires strict identity verification for every person and device attempting to access resources, regardless of whether they are located within or outside the network perimeter.  
**Context**: RDAPify implements Zero Trust principles through defense-in-depth security controls, strict input validation, and continuous verification of data sources and processing contexts.  
**Related**: [Security Whitepaper](../../security/whitepaper.md), [Threat Model](../../security/threat_model.md)

## ⚖️ Compliance Terms

### California Consumer Privacy Act (CCPA)
**Definition**: California state law that grants California residents specific rights regarding their personal information, including the right to know what data is collected, the right to delete personal information, and the right to opt-out of the sale of personal information.  
**Context**: RDAPify includes built-in CCPA compliance features such as "Do Not Sell" support, data retention controls, and consumer rights tooling for businesses operating in California.  
**Related**: [CCPA Compliance](../../guides/ccpa_compliance.md), [Data Subject Access Requests](../../security/dsar_processor.md)

### Data Protection Officer (DPO)
**Definition**: A designated expert on data protection law and practices who is responsible for monitoring an organization's compliance with applicable data protection laws, providing guidance on data protection impact assessments, and acting as a point of contact for data subjects and supervisory authorities.  
**Context**: RDAPify is designed to support DPO oversight through comprehensive audit logging, data processing documentation, and tools for fulfilling data subject rights requests.  
**Related**: [GDPR Compliance](../../security/compliance.md), [Audit Logging](../../enterprise/audit_logging.md)

### General Data Protection Regulation (GDPR)
**Definition**: European Union regulation that establishes guidelines for the collection and processing of personal information from individuals within the European Union, emphasizing data subject rights and organizational accountability.  
**Context**: RDAPify is built with GDPR compliance as a core requirement, implementing data minimization, purpose limitation, and PII redaction by default in all European contexts.  
**Related**: [GDPR Compliance](../../security/compliance.md), [Data Minimization](../../guides/data_minimization.md)

### Legal Basis
**Definition**: The lawful justification required under GDPR Article 6 for processing personal data, which must be one of: consent, contract performance, legal obligation, vital interests, public task, or legitimate interests.  
**Context**: RDAPify requires explicit legal basis declaration for all data processing operations involving personal information, with built-in enforcement of appropriate safeguards based on the selected basis.  
**Related**: [GDPR Article 6](../../security/compliance.md), [Consent Management](../../guides/consent_management.md)

## 🏛️ Organizational Terms

### Technical Steering Committee (TSC)
**Definition**: The governing body of the RDAPify project responsible for strategic direction, architecture decisions, maintainer onboarding/offboarding, and resource allocation.  
**Context**: The TSC consists of 3-5 elected maintainers serving 1-year renewable terms, with decision-making processes defined in the project governance documentation.  
**Related**: [Governance](../../../GOVERNANCE.md), [MAINTAINERS.md](../../../MAINTAINERS.md)

### Module Maintainer
**Definition**: A contributor with specialized expertise and responsibility for a specific component or module within the RDAPify codebase, with authority to review and approve pull requests within their domain.  
**Context**: Module maintainers are accountable for code quality, documentation, and issue response within their assigned modules, serving as the first line of review for contributions.  
**Related**: [Contributing](../../community/contributing.md), [MAINTAINERS.md](../../../MAINTAINERS.md)

### Contributor Covenant
**Definition**: A code of conduct for open source projects that defines standards for inclusive, respectful behavior and outlines processes for addressing violations.  
**Context**: RDAPify adheres to the Contributor Covenant v2.1 to ensure a harassment-free experience for all community members, with enforcement procedures documented in the Code of Conduct.  
**Related**: [Code of Conduct](../../../CODE_OF_CONDUCT.md), [Community Credits](../../community/credits.md)

## 🌐 Internet Ecosystem Terms

### Internet Assigned Numbers Authority (IANA)
**Definition**: The organization responsible for global coordination of the Internet Protocol addressing systems, as well as the autonomous system numbers used for routing Internet traffic, and the management of the DNS root zone.  
**Context**: IANA maintains the bootstrap services that RDAPify uses to discover authoritative RDAP servers for different domains, IP ranges, and AS numbers.  
**Related**: [IANA Bootstrap](../../specifications/bootstrap.md), [Discovery Flow](../../architecture/discovery.md)

### Regional Internet Registry (RIR)
**Definition**: Organizations that manage the allocation and registration of Internet number resources (IP addresses and AS numbers) within specific geographic regions of the world. Examples include ARIN (North America), RIPE NCC (Europe), APNIC (Asia-Pacific), LACNIC (Latin America), and AFRINIC (Africa).  
**Context**: RDAPify interacts with multiple RIRs to retrieve accurate registration data, implementing registry-specific normalization and compliance rules for each.  
**Related**: [RDAP vs WHOIS](../../core_concepts/rdap_vs_whois.md), [Registry Adapters](../../advanced/custom_adapters.md)

### Registry Operators
**Definition**: Organizations that manage top-level domains (TLDs) such as .com, .net, .org, and country-code TLDs (ccTLDs), maintaining the authoritative database of domain registrations within their delegated namespace.  
**Context**: RDAPify queries registry operators' RDAP endpoints to retrieve domain registration data, handling differences in response formats, rate limiting policies, and compliance requirements across registries.  
**Related**: [Registry Adapters](../../advanced/custom_adapters.md), [Caching Strategies](../../guides/caching_strategies.md)

## 📊 Performance & Operations Terms

### Connection Pooling
**Definition**: A technique that maintains a cache of database or network connections to reuse them for subsequent requests, reducing the overhead of establishing new connections for each operation.  
**Context**: RDAPify implements intelligent connection pooling with registry-specific configuration to optimize performance while respecting rate limits and preventing connection exhaustion.  
**Related**: [Performance Tuning](../performance/optimization.md), [Network Debugging](../../support/network_debugging.md)

### LRU Cache
**Definition**: A cache eviction algorithm that removes the least recently used items first when the cache reaches its capacity limit, optimizing for temporal locality of reference.  
**Context**: RDAPify uses LRU caching for registry responses with adaptive TTL management based on registry update frequencies and data volatility characteristics.  
**Related**: [Caching Strategies](../../guides/caching_strategies.md), [Performance Benchmarks](../../../benchmarks/results/cache_hit_miss.md)

### Rate Limiting
**Definition**: A technique to control the number of requests a client can make to a server within a specified time period, preventing abuse and ensuring fair resource allocation.  
**Context**: RDAPify implements client-side rate limiting with registry-specific policies to prevent service blocking while maximizing throughput during normal operation.  
**Related**: [Error State Machine](../../core_concepts/error_state_machine.md), [Anomaly Detection](../../guides/anomaly_detection.md)

## 📚 Related Documentation

| Document | Description | Path |
|----------|-------------|------|
| [RFC References](rfcs.md) | List of relevant RFC documents | [rfcs.md](rfcs.md) |
| [Links](links.md) | Curated collection of useful external resources | [links.md](links.md) |
| [Papers](papers.md) | Academic papers and research related to RDAP | [papers.md](papers.md) |
| [Specifications](../../specifications/rdap_rfc.md) | Technical specifications for RDAP protocols | [../../specifications/rdap_rfc.md](../../specifications/rdap_rfc.md) |
| [Glossary Search Tool](../../playground/glossary-search.md) | Interactive glossary search interface | [../../playground/glossary-search.md](../../playground/glossary-search.md) |
| [Security Whitepaper](../../security/whitepaper.md) | Comprehensive security architecture documentation | [../../security/whitepaper.md](../../security/whitepaper.md) |

## 🏷️ Glossary Specifications

| Property | Value |
|----------|-------|
| **Terms Count** | 45+ comprehensive terms |
| **Last Updated** | December 5, 2025 |
| **Review Cycle** | Quarterly updates with community input |
| **Language** | English (primary), with translations planned for Chinese, Spanish, Russian, and Arabic |
| **Contributions** | Open to community contributions via GitHub pull requests |
| **Version Control** | Git versioned with change tracking |
| **Accessibility** | WCAG 2.1 AA compliant formatting |

> ℹ️ **Information Note**: This glossary is maintained as a living document and is updated quarterly to reflect changes in the RDAP protocol standards, regulatory requirements, and project governance. Contributions to improve definitions or add new terms are welcome through the [Contribution Process](../../community/contributing.md).

[← Back to Resources](../README.md) | [Next: RFC References →](rfcs.md)

*Document automatically generated from source code with privacy review on December 5, 2025*