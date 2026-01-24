# Project Structure - Clean Architecture

## Repository Organization

This is a TypeScript library with comprehensive documentation following **Clean Architecture** principles. The project is in alpha release (v0.1.0-alpha.4) with core functionality implemented and tested.

## Current Implementation Status

**Architecture:** Clean Architecture (Hexagonal/Ports & Adapters)
**Code Structure:** Modular, layered, well-tested TypeScript
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

### Restructure Documentation
- `RESTRUCTURE_PLAN.md` - Enterprise restructure plan
- `RESTRUCTURE_COMPLETE.md` - Restructure completion summary

## Source Code Structure - Clean Architecture

### `/src` - Source Code (Clean Architecture)

```
src/
├── core/                      # 🎯 Core Business Logic (Framework-agnostic)
│   ├── domain/               # Domain models & business rules
│   │   ├── entities/         # Domain entities (Domain, IP, ASN)
│   │   ├── value-objects/    # Value objects (Status, Event, Entity)
│   │   └── errors/           # Domain-specific errors
│   ├── use-cases/            # Application business logic
│   │   ├── query-domain.ts
│   │   ├── query-ip.ts
│   │   ├── query-asn.ts
│   │   └── batch-query.ts
│   └── ports/                # Interfaces (Dependency Inversion)
│       ├── cache.port.ts
│       ├── fetcher.port.ts
│       ├── normalizer.port.ts
│       ├── bootstrap.port.ts
│       └── pii-redactor.port.ts
│
├── infrastructure/            # 🔧 External Implementations
│   ├── cache/                # Cache implementations
│   │   ├── in-memory.cache.ts
│   │   ├── cache.manager.ts
│   │   └── redis.cache.ts (future)
│   ├── http/                 # HTTP clients & fetchers
│   │   ├── fetcher.ts
│   │   ├── bootstrap-discovery.ts
│   │   ├── normalizer.ts
│   │   └── retry-handler.ts
│   └── security/             # Security implementations
│       ├── ssrf-protection.ts
│       └── pii-redactor.ts
│
├── application/               # 🎭 Application Layer (Orchestration)
│   ├── client/               # Main client interface
│   │   └── rdap-client.ts
│   ├── services/             # Application services
│   │   └── query-orchestrator.ts
│   └── dto/                  # Data Transfer Objects
│
├── shared/                    # 🔗 Shared Utilities (Cross-cutting)
│   ├── types/                # TypeScript types & interfaces
│   │   ├── options.types.ts
│   │   ├── response.types.ts
│   │   ├── enums.ts
│   │   └── index.ts
│   ├── utils/                # Utility functions
│   │   ├── validators/       # Input validation
│   │   ├── formatters/       # Data formatting
│   │   └── helpers/          # General helpers
│   ├── constants/            # Application constants
│   │   ├── rdap.constants.ts
│   │   └── http.constants.ts
│   └── errors/               # Base error classes
│       └── base.error.ts
│
└── index.ts                   # Public API exports
```

## Architecture Principles

### Dependency Rule
```
Shared ← Core ← Application ← Infrastructure
```

- **Core** doesn't depend on Infrastructure
- **Infrastructure** implements Core interfaces (Dependency Inversion)
- **Application** orchestrates Core use cases
- **Shared** is used by all layers

### Layer Responsibilities

#### Core Layer
- Pure business logic
- No external dependencies
- Framework-agnostic
- Defines interfaces (ports)

#### Infrastructure Layer
- External service implementations
- HTTP clients, caches, security
- Implements Core ports
- Can depend on external libraries

#### Application Layer
- Orchestrates use cases
- Coordinates between layers
- Main entry point (RDAPClient)
- Handles application flow

#### Shared Layer
- Cross-cutting concerns
- Types, utilities, constants
- Used by all other layers
- No business logic

## Other Directories

### `/tests` - Test Suite
```
tests/
├── unit/                     # Unit tests (mirror src structure)
│   ├── core/
│   ├── infrastructure/
│   ├── application/
│   └── shared/
├── integration/              # Integration tests
│   └── rdap-client.test.ts
├── fixtures/                 # Test data
│   ├── bootstrap/
│   └── rdap-responses/
└── helpers/                  # Test utilities
```

### `/docs` - Main Documentation
- `getting-started/` - Installation, quick start, tutorials
- `core-concepts/` - RDAP fundamentals, architecture, normalization
- `api-reference/` - Complete API documentation with TypeScript types
- `guides/` - How-to guides for common tasks
- `integrations/` - Cloud platforms, frameworks, databases
- `advanced/` - Plugin system, custom implementations
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
- `code-generation-rules.md` - Code generation quality rules

## Key Principles

1. **Clean Architecture**: Separation of concerns with clear dependencies
2. **Dependency Inversion**: Core defines interfaces, Infrastructure implements
3. **Single Responsibility**: Each layer has one clear purpose
4. **Testability**: Easy to mock dependencies via ports
5. **Scalability**: Easy to add new implementations
6. **Enterprise-Grade**: Professional standards and patterns

## Import Guidelines

### From Core
```typescript
// ✅ GOOD - Core imports from Shared only
import type { RDAPResponse } from '../../shared/types';
import { ValidationError } from '../../shared/errors';

// ❌ BAD - Core should NOT import from Infrastructure
import { Fetcher } from '../../infrastructure/http';
```

### From Infrastructure
```typescript
// ✅ GOOD - Infrastructure implements Core ports
import type { IFetcherPort } from '../../core/ports';
import { NetworkError } from '../../shared/errors';
```

### From Application
```typescript
// ✅ GOOD - Application uses all layers
import { RDAPClient } from './client';
import type { ICachePort } from '../../core/ports';
import { CacheManager } from '../../infrastructure/cache';
```

## Adding New Features

### Add a new cache implementation
1. Create interface in `core/ports/cache.port.ts` (if not exists)
2. Implement in `infrastructure/cache/redis.cache.ts`
3. Export from `infrastructure/cache/index.ts`

### Add a new use case
1. Create in `core/use-cases/batch-query.ts`
2. Use existing ports
3. Call from Application layer

### Add a new validator
1. Create in `shared/utils/validators/`
2. Export from `shared/utils/validators/index.ts`
3. Use anywhere in the codebase
