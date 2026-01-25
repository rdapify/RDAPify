# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Fixed prism-react-renderer theme import in Docusaurus configuration
- Fixed MDX compilation errors caused by unescaped `<` and `>` characters in markdown tables
- Fixed self-closing HTML tags (`<br>` → `<br/>`) in documentation
- Fixed deprecated GitHub Actions (upload-artifact@v3 → v4, actions/create-release → softprops/action-gh-release)
- Fixed empty workflow file (examples.yml)
- Fixed missing sidebars.js configuration
- Removed empty pages causing build failures

### Changed
- Standardized Node.js version to v20 across all GitHub Actions workflows
- Updated all workflows to use `node-version-file: .nvmrc` for consistency
- Improved npm caching in CI/CD workflows for faster builds
- Added `NODE_ENV: production` to website build workflow
- Added `onBrokenMarkdownImages: 'warn'` to Docusaurus config
- Enhanced release workflow with better error handling

### Added
- Created SVG placeholder icons for homepage features (typescript, performance, security, multi-env, unified, privacy)
- Added examples validation workflow
- Added fork check for Snyk security scans to prevent token exposure
- Added comprehensive CI/CD fixes documentation

## [0.1.0] - 2025-01-25

### Added
- Initial public release of RDAPify
- Core RDAP client with domain, IP, and ASN query support
- Automatic RDAP server discovery via IANA Bootstrap
- SSRF protection with proper CIDR matching for IPv4 and IPv6
- PII redaction for GDPR/CCPA compliance
- In-memory caching with configurable TTL
- Data normalization for consistent response format
- Comprehensive TypeScript types and interfaces
- Input validation for domains, IPs, and ASNs
- Retry logic with configurable backoff strategies
- Interactive playground for testing RDAP queries
- Playground API proxy server with Express
- Comprehensive community health files (SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SUPPORT.md)
- Issue templates (bug report, feature request, question)
- Pull request template with comprehensive checklist
- Funding configuration for GitHub Sponsors and Open Collective
- Organization profile with professional presentation

### Infrastructure
- CI/CD workflows for Node.js 16, 18, and 20
- CodeQL security analysis (weekly scans)
- Dependabot for automated dependency updates
- Dependency review for pull requests
- Automated testing and linting
- GitHub Actions for release automation

### Security
- SSRF protection blocks private IPs, localhost, and internal domains
- Certificate validation enforced (HTTPS only)
- Proper CIDR matching using ipaddr.js library
- Input validation prevents injection attacks
- Automated security scanning with CodeQL
- Secret scanning configuration
- Dependabot security updates

### Documentation
- Comprehensive README with examples
- API documentation
- Security policy
- Contributing guidelines
- Code of conduct
- Support resources

### Testing
- 146+ unit and integration tests
- Mocked fixtures for reliable testing
- Coverage reporting

## [0.1.0-alpha.4] - 2025-01-25

### Added
- Dependabot configuration for automated dependency updates
- Enhanced CI/CD workflows with multi-version Node.js testing (Node.js 16, 18, 20)
- CodeQL security analysis workflow (weekly scans)
- Dependency review workflow for pull requests
- Interactive playground for testing RDAP queries
- Playground API proxy server with Express
- Comprehensive community health files (SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SUPPORT.md)
- Issue templates (bug report, feature request, question)
- Pull request template with comprehensive checklist
- Funding configuration for GitHub Sponsors and Open Collective
- Organization profile with professional presentation

### Changed
- Improved CI workflow to test on multiple Node.js versions
- Simplified CodeQL configuration
- Updated organization profile with professional presentation
- Enhanced documentation structure
- Improved .gitignore to exclude .kiro directory

### Security
- Added automated security scanning with CodeQL
- Enabled dependency review for pull requests
- Configured Dependabot for security updates
- Set up weekly security scans

### Infrastructure
- Added CI/CD workflows for automated testing
- Configured Dependabot for dependency management
- Set up CodeQL for security analysis

## [0.1.0-alpha.2] - 2026-01-22

### Fixed
- Cancel timeout timer in `withTimeout()` to prevent Jest exit warning
- Improve integration test fetch mock cleanup with proper `beforeEach`/`afterEach`

## [0.1.0-alpha.1] - 2026-01-22

### Added
- Initial alpha release of RDAPify
- Core RDAP client with domain, IP, and ASN query support
- Automatic RDAP server discovery via IANA Bootstrap
- SSRF protection with proper CIDR matching for IPv4 and IPv6
- PII redaction for GDPR/CCPA compliance
- In-memory caching with configurable TTL
- Data normalization for consistent response format
- Comprehensive TypeScript types and interfaces
- Input validation for domains, IPs, and ASNs
- Retry logic with configurable backoff strategies
- 146 unit and integration tests with mocked fixtures

### Security
- SSRF protection blocks private IPs, localhost, and internal domains
- Certificate validation enforced (HTTPS only)
- Proper CIDR matching using ipaddr.js library
- Input validation prevents injection attacks

### Known Limitations
- Redis cache not yet implemented (in-memory only)
- No CLI tool in this release
- Bun/Deno/Cloudflare Workers support untested
- Live integration tests not included in CI
- Documentation references features not yet available

### Dependencies
- ipaddr.js: ^2.2.0 (for CIDR matching)
- tslib: ^2.8.1 (TypeScript runtime)

### Development
- TypeScript 5.3.3 with strict mode
- Jest for testing
- ESLint for code quality
- Prettier for code formatting

## [Unreleased]

### Planned for v0.2.0
- Redis cache implementation
- CLI tool for quick queries
- Live integration tests
- Improved error messages
- Performance benchmarks
- Additional runtime support (Bun, Deno)

---

[0.1.0-alpha.1]: https://github.com/rdapify/rdapify/releases/tag/v0.1.0-alpha.1
