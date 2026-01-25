# RDAPify - Unified, Secure, High-Performance RDAP Client for Enterprise Applications

> **🎉 STABLE RELEASE**: This is v0.1.0 — the first stable public release with production-ready core functionality. See [What's Ready](#-whats-ready-in-v010) below.

[![npm version](https://img.shields.io/npm/v/rdapify?style=flat-square)](https://www.npmjs.com/package/rdapify)
[![License](https://img.shields.io/npm/l/rdapify?style=flat-square)](LICENSE)
[![Security](https://img.shields.io/badge/security-SSRF%20Protected-brightgreen?style=flat-square)](SECURITY.md)
[![Website](https://img.shields.io/badge/website-rdapify.com-blue?style=flat-square)](https://rdapify.com)
[![GitHub](https://img.shields.io/github/stars/rdapify/RDAPify?style=flat-square)](https://github.com/rdapify/RDAPify)

**RDAPify** unifies RDAP queries across all global registries (Verisign, ARIN, RIPE, APNIC, LACNIC) with robust security protection, exceptional performance, and an integrated developer experience. This isn't just another RDAP client — it's a complete platform for processing registration data securely.

> **Note:** This project eliminates the need for traditional WHOIS protocol, while maintaining backward compatibility when needed.

## 🚀 Why RDAPify?

Direct RDAP queries are complex — each registry uses different formats, rate limits, and security procedures. Instead of reinventing the wheel for every project:

```diff
- Maintaining multiple WHOIS/RDAP implementations
- Manually handling registry differences
- Constant worry about SSRF vulnerabilities
- Unpredictable performance without caching
+ One unified solution, rigorously tested, production-ready
```

RDAPify intelligently addresses these challenges:

- ✅ **Data Normalization**: Consistent response regardless of source registry
- ✅ **SSRF Protection**: Prevent attacks on internal infrastructure
- ✅ **Exceptional Performance**: Smart caching, parallel processing, memory optimization
- ✅ **Node.js Compatibility**: Verified working on Node.js (target: 16+; Bun, Deno, Cloudflare Workers: untested)
- ✅ **GDPR-ready**: Built-in tools for automatically redacting personal data

## 📦 Quick Installation

```bash
# Using npm
npm install rdapify

# Using yarn
yarn add rdapify

# Using pnpm
pnpm add rdapify
```

**Experimental (untested):**
```bash
# Using Bun (untested)
bun add rdapify
```

## ⚡ Get Started in 30 Seconds

### Basic Usage

```typescript
import { RDAPClient } from 'rdapify';

// Create a client with default settings
const client = new RDAPClient();

// Query a domain
const result = await client.domain('example.com');

console.log({
  domain: result.query,
  registrar: result.registrar?.name,
  status: result.status,
  nameservers: result.nameservers,
  created: result.events.find((e) => e.type === 'created')?.date,
  expires: result.events.find((e) => e.type === 'expiration')?.date,
});
```

### With Security & Performance Options

```typescript
import { RDAPClient } from 'rdapify';

// Create a secure client with optimized defaults
const client = new RDAPClient({
  cache: true, // Automatic caching (1 hour TTL)
  redactPII: true, // Automatically redact personal information
  retry: {
    // Smart retries for transient failures
    maxAttempts: 3,
    backoff: 'exponential',
  },
});

// Query domain, IP, or ASN
const domain = await client.domain('example.com');
const ip = await client.ip('8.8.8.8');
const asn = await client.asn('AS15169');
```

**Example Output:**

```json
{
  "domain": "example.com",
  "registrar": "Internet Assigned Numbers Authority",
  "status": ["clientDeleteProhibited", "clientTransferProhibited", "clientUpdateProhibited"],
  "nameservers": ["a.iana-servers.net", "b.iana-servers.net"],
  "created": "1995-08-14T04:00:00Z",
  "expires": "2026-08-13T04:00:00Z"
}
```

## 🌟 Core Features

### 🔒 Enterprise Security

- **Built-in SSRF Protection**: Prevent queries to internal IP addresses or dangerous domains
- **Certificate Validation**: Reject insecure connections to RDAP servers
- **Rate Limiting**: Prevent service blocking due to excessive requests
- **Secure Data Handling**: PII redaction according to GDPR/CCPA requirements
- **Full Audit Trail**: Track all critical operations for compliance purposes

### ⚡ Exceptional Performance

- **Smart Caching**: In-memory LRU cache with configurable TTL (Redis support planned)
- **Batch Processing**: Process multiple queries efficiently
- **Registry Discovery**: Automatic IANA Bootstrap for finding the correct registry
- **Offline Mode**: Work with cached data during network outages (planned)
- **Optimized Parsing**: Fast JSONPath-based normalization

### 🧩 Seamless Integration

- **Full TypeScript Support**: Strongly typed with embedded documentation
- **Node.js Support**: Verified working (target: Node.js 16+; other runtimes untested)
- **Interactive CLI**: For quick queries and testing (planned)
- **Web Playground**: Try the library directly in your browser (planned)
- **Pre-built Templates**: For AWS Lambda, Azure Functions, Kubernetes, and more (planned)

### 📊 Advanced Analytics (Planned)

Future releases will include:

- **Customizable Dashboards**: Track critical domains and assets
- **Automated Reports**: Schedule expiration alerts and important changes
- **Pattern Detection**: Identify suspicious registration behaviors or potential attacks
- **Relationship Visualization**: Understand complex ownership and registration networks

## 🏗️ Core Architecture

```mermaid
graph LR
A[Application] --> B(RDAP Client)
B --> C{Registry Discovery}
C -->|IANA Bootstrap| D[(Cache Layer)]
B --> E[Normalization]
E -->|JSONPath| F[Raw Responses]
F --> G[Unified Format]
G --> H[PII Redaction]
H --> I[Final Response]
D -->|Prefetching| C
style B fill:#4CAF50,stroke:#388E3C
style D fill:#FF9800,stroke:#F57C00
style G fill:#2196F3,stroke:#0D47A1
```

## 🛡️ Security as a Core Principle

We don't treat security as an add-on feature — it's fundamental to our design. RDAPify protects your applications from:

| Threat         | Protection Mechanism                     | Criticality  |
| -------------- | ---------------------------------------- | ------------ |
| SSRF           | Domain validation, blocking internal IPs | 🔴 Critical  |
| DoS            | Rate limiting, timeouts                  | 🟠 Important |
| Data Leaks     | PII redaction, no raw response storage   | 🔴 Critical  |
| MitM           | Mandatory HTTPS, certificate validation  | 🟠 Important |
| Data Injection | Schema validation, strict parsing        | 🟠 Important |

Read our [Security Whitepaper](security/whitepaper.md) for deeper technical details and advanced scenarios.

## 📚 Documentation

RDAPify provides comprehensive documentation in the repository:

- **[Getting Started](docs/getting_started/)** - Installation, quick start, and first query
- **[API Reference](docs/api_reference/)** - Complete TypeScript API documentation
- **[Core Concepts](docs/core_concepts/)** - RDAP fundamentals, architecture, and normalization
- **[Security Guide](docs/security/)** - SSRF protection, PII redaction, and best practices
- **[Guides](docs/guides/)** - Error handling, caching strategies, and performance optimization
- **[Examples](examples/)** - Real-world code examples and use cases

> **Note**: Full documentation site is planned for future release. For now, browse the [docs/](docs/) directory in the repository.

## 🌐 Interactive Playground

> **Coming Soon**: Interactive playground is planned for a future release. For now, install the package and try the examples in the [docs/](docs/) directory.

## 📊 Performance Benchmarks

> **Coming Soon**: Comprehensive benchmarks with real-world data will be published in future releases. Current alpha focuses on correctness and security over performance optimization.

## 👥 Community & Support

RDAPify is an open source project. Get help or contribute:

### 🐛 Bug Reports & Feature Requests
- **[GitHub Issues](https://github.com/rdapify/RDAPify/issues)** - Report bugs or request features

### 💬 Questions & Discussions
- **[GitHub Discussions](https://github.com/rdapify/RDAPify/discussions)** - Ask questions, share ideas, and show what you've built

### 📧 Direct Contact
- **General inquiries**: contact@rdapify.com
- **Security issues**: security@rdapify.com (see [SECURITY.md](SECURITY.md))
- **Support**: support@rdapify.com

### 🤝 Contributing
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contribution guidelines
- **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** - Community standards

> **Enterprise Support**: For SLA-backed support, consulting, or custom features, contact enterprise@rdapify.com

## 🤝 Contributing

We welcome contributions! Whether you're a:

- Developer wanting to fix bugs or add features
- Writer improving documentation
- Tester reporting issues
- Security engineer reviewing code

Start by reading our [Contribution Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

## 🚧 Project Status

**Current Release**: v0.1.0 (Stable)

### ✅ What's Ready in v0.1.0

Core functionality is production-ready and fully tested:

- ✅ **RDAP Client**: Domain, IP, and ASN queries with automatic bootstrap discovery
- ✅ **SSRF Protection**: Blocks private IPs, localhost, link-local, with proper CIDR matching (IPv4/IPv6)
- ✅ **Data Normalization**: Consistent response format across all registries
- ✅ **PII Redaction**: Automatic redaction of emails, phones, addresses
- ✅ **In-Memory Caching**: LRU cache with TTL support
- ✅ **Error Handling**: Structured errors with retry logic (exponential backoff)
- ✅ **TypeScript Support**: Full type definitions and strict mode
- ✅ **Test Coverage**: 146 tests passing (unit + integration with mocked fixtures)
- ✅ **Node.js Support**: Verified working (CommonJS + ESM imports functional)

### 🔄 Planned Features

These features are planned for future releases:

- ⏳ **Redis/External Cache**: External cache adapters coming in v0.2.0
- ⏳ **CLI Tool**: Command-line interface planned
- ⏳ **Interactive Playground**: Web-based testing environment
- ⏳ **Bun/Deno/Cloudflare Workers**: Additional runtime support
- ⏳ **Advanced Analytics**: Dashboard and reporting features
- ⏳ **Geo-distributed Caching**: Multi-region cache support

### 📋 Roadmap to v0.2.0

- Redis cache adapter
- CLI tool
- Rate limiting improvements
- Batch processing optimization

See [ROADMAP.md](ROADMAP.md) for the complete roadmap.

## 🏗️ Code Architecture

RDAPify follows a clean, modular architecture with clear separation of concerns:

### Source Structure (`/src`)

```
src/
├── client/           # Client orchestration layer
│   ├── RDAPClient.ts          # Main client (242 LOC)
│   └── QueryOrchestrator.ts   # Query pattern extraction (169 LOC)
│
├── fetcher/          # HTTP and registry discovery
│   ├── Fetcher.ts             # HTTP client (196 LOC)
│   ├── BootstrapDiscovery.ts  # IANA bootstrap (224 LOC)
│   └── SSRFProtection.ts      # Security validation (219 LOC)
│
├── normalizer/       # Data transformation
│   ├── Normalizer.ts          # Response normalization (239 LOC)
│   └── PIIRedactor.ts         # Privacy protection (140 LOC)
│
├── cache/            # Caching layer
│   ├── CacheManager.ts        # Cache orchestration (188 LOC)
│   └── InMemoryCache.ts       # LRU implementation (185 LOC)
│
├── types/            # TypeScript definitions
│   ├── enums.ts               # Type aliases (87 LOC)
│   ├── entities.ts            # Entity interfaces (74 LOC)
│   ├── responses.ts           # Response types (100 LOC)
│   ├── errors.ts              # Error classes (154 LOC)
│   ├── options.ts             # Configuration types (201 LOC)
│   └── index.ts               # Barrel export (36 LOC)
│
└── utils/            # Utilities
    ├── validators/            # Input validation
    │   ├── domain.ts          # Domain validation (55 LOC)
    │   ├── ip.ts              # IP validation (86 LOC)
    │   ├── asn.ts             # ASN validation (42 LOC)
    │   └── network.ts         # Network utilities (76 LOC)
    │
    └── helpers/               # Helper functions
        ├── async.ts           # Async utilities (77 LOC)
        ├── string.ts          # String manipulation (38 LOC)
        ├── object.ts          # Object utilities (33 LOC)
        ├── cache.ts           # Cache helpers (11 LOC)
        ├── http.ts            # HTTP utilities (25 LOC)
        ├── format.ts          # Formatting (27 LOC)
        └── runtime.ts         # Runtime detection (47 LOC)
```

### Key Design Principles

1. **Modular Architecture**: Each file has a single, clear responsibility
2. **Small Files**: All files <250 LOC for easy maintenance
3. **Type Safety**: Strict TypeScript with explicit types throughout
4. **Testability**: 146 tests with >90% coverage
5. **Security First**: SSRF protection and PII redaction built-in
6. **Performance**: Smart caching and optimized parsing

### Recent Improvements (Phase 2 Refactoring)

- ✅ Extracted QueryOrchestrator from RDAPClient (-29% LOC)
- ✅ Split validators into focused modules (-87% in main file)
- ✅ Split helpers into focused modules (-80% in main file)
- ✅ Split types into enums, entities, responses (-87% in main file)
- ✅ 712 lines of duplication eliminated
- ✅ 100% backward compatible (re-export shims)

See [REFACTOR_STATUS.md](REFACTOR_STATUS.md) for detailed refactoring progress.

### 📋 Roadmap to v0.2.0 (Continued)
- CLI tool with interactive mode
- Bun/Deno runtime compatibility testing
- Live integration tests (optional via LIVE_TESTS=1)
- Performance benchmarks with real data
- Rate limiting implementation

**Want to contribute?** Check out our [CONTRIBUTING.md](CONTRIBUTING.md) and [ROADMAP.md](ROADMAP.md)!

## 🔍 Version Verification

RDAPify intentionally does **not** export `./package.json` in the package exports for security and API surface minimization. Attempting to import it will throw an expected error:

```javascript
// ❌ This will throw ERR_PACKAGE_PATH_NOT_EXPORTED (expected behavior)
const pkg = require('rdapify/package.json');
// Error: Package subpath './package.json' is not defined by "exports"
```

### Safe Version Verification Methods

**Method 1: Using npm (recommended)**
```bash
npm ls rdapify
# Output: rdapify@0.1.0
```

**Method 2: Programmatic check via require.resolve**
```javascript
const fs = require('fs');
const path = require('path');

const entry = require.resolve('rdapify');
const pkgPath = path.join(path.dirname(entry), '..', 'package.json');
const version = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;

console.log('rdapify version:', version);
// Output: 0.1.0
```

**Method 3: Check installed version in package.json**
```bash
cat node_modules/rdapify/package.json | grep version
```

This design decision prevents accidental exposure of internal package metadata and maintains a minimal public API surface.

## 🏢 Early Adopters & Feedback

We're looking for early adopters and beta testers! If you're interested in:

- Testing the library in your environment
- Providing feedback on the API design
- Contributing to the codebase
- Reporting bugs or suggesting features

**Get involved**: 
- 🌐 Visit our website: [rdapify.com](https://rdapify.com)
- 🐛 Open a [GitHub Issue](https://github.com/rdapify/RDAPify/issues) for bugs or feature requests
- 💬 Start a [GitHub Discussion](https://github.com/rdapify/RDAPify/discussions) for questions or ideas
- 📖 Read the [Documentation](https://rdapify.com/docs)
- 🤝 Check out [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines

### Known Issues & Limitations

- Only in-memory caching available (Redis adapter planned for v0.2.0)
- No CLI tool yet (programmatic API only)
- Bun/Deno/Cloudflare Workers compatibility not yet tested
- Live RDAP server tests disabled by default (use `LIVE_TESTS=1` to enable)

## 📜 License

RDAPify is licensed under the [MIT License](LICENSE) — free for personal and commercial use with minimal restrictions.

## 🙏 Acknowledgements

We thank the global RDAP community, IANA teams, and Regional Internet Registry (RIR) developers for their dedicated work making the internet more transparent and secure.

---

> **Note:** RDAPify is an independent project not affiliated with any domain registry or official internet authority. All trademarks and products mentioned are property of their respective owners.
>
> © 2025 RDAPify Contributors — Built for enterprises that don't compromise on quality and security.  
> [Security Policy](SECURITY.md) • [Privacy Policy](PRIVACY.md) • [License](LICENSE)
