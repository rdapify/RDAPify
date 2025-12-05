# Technical Stack

## Language & Runtime

- **Primary Language**: TypeScript (strict mode enabled)
- **Target Runtimes**: Node.js 16+, Bun, Deno, Cloudflare Workers
- **Package Manager**: npm (primary), also supports yarn, pnpm, bun

## Core Technologies

- **Protocol**: RDAP (RFC 7480 series) - Registration Data Access Protocol
- **Standards Compliance**: IETF RFC 7480-7484, IANA Bootstrap
- **Data Format**: JSON with JSONPath-based normalization
- **Caching**: In-memory, Redis, geo-distributed caching support
- **Security**: SSRF protection, certificate validation, PII redaction

## Development Tools

### Testing
```bash
npm test                  # Run all tests
npm run test:unit         # Unit tests (Jest)
npm run test:integration  # Integration tests
npm run test:security     # Security-specific tests
npm run test:fuzzing      # Fuzz testing
npm run test:e2e          # End-to-end tests
```

### Code Quality
```bash
npm run lint              # Code style checking
npm run typecheck         # TypeScript type validation
npm run audit             # Dependency vulnerability check
```

### Development
```bash
npm install               # Install dependencies
npm run dev               # Development mode with watch
npm run build             # Build production version
npm run prepare           # Set up pre-commit hooks
```

### Performance
```bash
npm run benchmark         # Run performance benchmarks
```

## Architecture Patterns

- **Defense-in-Depth**: Multiple layers of security validation
- **Privacy by Design**: PII redaction enabled by default
- **Plugin Architecture**: Extensible through custom adapters and middleware
- **Error State Machine**: Structured error handling with retry logic
- **Normalization Pipeline**: JSONPath-based data transformation

## Key Dependencies

- IANA Bootstrap for registry discovery
- RFC 1918 IP filtering for SSRF protection
- Semantic Versioning 2.0.0 for releases

## Documentation System

- **Framework**: Docusaurus (website)
- **Diagrams**: Mermaid format for all visualizations
- **API Docs**: TypeScript JSDoc with embedded examples
- **Test Vectors**: JSON-based standardized test cases

## Release Process

- **Versioning**: Semantic Versioning (semver)
- **Release Cycle**: Monthly standard releases
- **LTS Releases**: Every 6 months (January, July)
- **Security Patches**: Immediate for critical vulnerabilities
