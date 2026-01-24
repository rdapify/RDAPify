# Project Structure

## Repository Organization

This is a TypeScript library with comprehensive documentation. The project is in alpha release (v0.1.0-alpha.4) with core functionality implemented and tested.

## Current Implementation Status

**Code Structure:** Modular, well-tested TypeScript implementation
**Documentation:** Comprehensive docs with examples
**Tests:** 146 tests passing (>90% coverage)
**Build:** TypeScript compilation to CommonJS + ESM

## Root Level Files

### Core Documentation
- `README.md` - Main project overview and quick start
- `CONTRIBUTING.md` - Contribution guidelines and standards
- `SECURITY.md` - Security policy and vulnerability reporting
- `PRIVACY.md` - Privacy policy and GDPR compliance
- `CODE_OF_CONDUCT.md` - Community behavior guidelines
- `GOVERNANCE.md` - Project governance and decision-making
- `MAINTAINERS.md` - Maintainer roles and responsibilities
- `CHANGELOG.md` - Version history and changes
- `LICENSE` - MIT License

### Planning Documents
- `RDApify_Document_Structure.md` - Comprehensive documentation structure plan (in Arabic)

## Actual Directory Structure

### `/src` - Source Code (TypeScript)
- `client/` - RDAPClient and QueryOrchestrator
- `fetcher/` - HTTP fetching, Bootstrap discovery, SSRF protection
- `normalizer/` - Data normalization and PII redaction
- `cache/` - CacheManager and InMemoryCache
- `types/` - TypeScript type definitions (split into enums, entities, responses)
- `utils/` - Validators and helpers (modular structure)
  - `validators/` - domain, ip, asn, network validators
  - `helpers/` - async, string, object, cache, http, format, runtime utilities

### `/tests` - Test Suite
- `unit/` - Unit tests for individual modules
- `integration/` - Integration tests with mocked RDAP responses
- `fixtures/` - Test data (bootstrap and RDAP response fixtures)

### `/docs` - Main Documentation
- `getting-started/` - Installation, quick start, tutorials
- `core-concepts/` - RDAP fundamentals, architecture, normalization
- `api-reference/` - Complete API documentation with TypeScript types
- `guides/` - How-to guides for common tasks
- `integrations/` - Cloud platforms, frameworks, databases
- `playground/` - Interactive testing environment
- `cli/` - Command-line interface documentation
- `advanced/` - Plugin system, custom implementations
- `recipes/` - Real-world use case examples
- `analytics/` - Dashboard and reporting features
- `enterprise/` - Enterprise adoption and SLA support
- `security/` - Security whitepaper and threat models
- `troubleshooting/` - Common issues and debugging

### `/examples` - Code Examples
- `basic/` - Simple domain/IP/ASN lookups
- `typescript/` - TypeScript-specific examples
- `frameworks/` - Express, Next.js, NestJS integrations
- `advanced/` - Custom cache, rate limiting, batch processing
- `real-world/` - Complete application examples

### `/specifications` - Technical Specs
- RFC compliance documentation
- JSONPath definitions
- Test vectors
- Normalization rules

### `/benchmarks` - Performance Testing
- Benchmark scripts and results
- Performance comparison data

### `/security` - Security Documentation
- Security whitepaper
- Threat models
- Audit reports

### `/templates` - Deployment Templates
- Cloud platform templates (AWS, Azure, GCP)
- Kubernetes configurations
- Monitoring dashboards

### `/diagrams` - Visual Documentation
- Mermaid diagram sources
- Architecture overviews
- Data flow diagrams

## Governance Structure

### `.kiro/steering/` - AI Assistant Steering Rules
- `product.md` - Product overview and value proposition
- `tech.md` - Technical stack and build commands
- `structure.md` - This file - project organization

## Key Principles

1. **Documentation-First**: Comprehensive docs before implementation
2. **Security-Focused**: Security considerations in all documentation
3. **Compliance-Ready**: GDPR/CCPA guidance throughout
4. **Multi-Language**: Support for localization and translations
5. **Enterprise-Grade**: Professional documentation standards
