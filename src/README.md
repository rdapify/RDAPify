# RDAPify Source Code - Clean Architecture

This directory contains the RDAPify library source code organized using **Clean Architecture** principles.

## Directory Structure

```
src/
├── core/                      # 🎯 Core Business Logic (Framework-agnostic)
│   ├── domain/               # Domain models & business rules
│   │   ├── entities/         # Domain entities
│   │   ├── value-objects/    # Value objects
│   │   └── errors/           # Domain-specific errors
│   ├── use-cases/            # Application business logic
│   └── ports/                # Interfaces (Dependency Inversion)
│
├── infrastructure/            # 🔧 External Implementations
│   ├── cache/                # Cache implementations
│   │   ├── InMemoryCache.ts
│   │   └── CacheManager.ts
│   ├── http/                 # HTTP clients & fetchers
│   │   ├── Fetcher.ts
│   │   ├── BootstrapDiscovery.ts
│   │   └── Normalizer.ts
│   └── security/             # Security implementations
│       ├── SSRFProtection.ts
│       └── PIIRedactor.ts
│
├── application/               # 🎭 Application Layer (Orchestration)
│   ├── client/               # Main client interface
│   │   └── RDAPClient.ts
│   ├── services/             # Application services
│   │   └── QueryOrchestrator.ts
│   └── dto/                  # Data Transfer Objects
│
├── shared/                    # 🔗 Shared Utilities (Cross-cutting)
│   ├── types/                # TypeScript types & interfaces
│   ├── utils/                # Utility functions
│   │   ├── validators/       # Input validation
│   │   ├── formatters/       # Data formatting
│   │   └── helpers/          # General helpers
│   ├── constants/            # Application constants
│   └── errors/               # Base error classes
│
└── index.ts                   # Public API exports
```

## Architecture Principles

### 1. Dependency Rule
```
Shared ← Core ← Application ← Infrastructure
```

- **Core** doesn't depend on Infrastructure
- **Infrastructure** implements Core interfaces (Dependency Inversion)
- **Application** orchestrates Core use cases
- **Shared** is used by all layers

### 2. Layer Responsibilities

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

### 3. Benefits

✅ **Testability**: Easy to mock dependencies via ports
✅ **Maintainability**: Clear separation of concerns
✅ **Scalability**: Easy to add new implementations
✅ **Flexibility**: Swap implementations without changing core
✅ **Enterprise-Ready**: Follows industry best practices

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

### 1. Add a new cache implementation
1. Create interface in `core/ports/cache.port.ts`
2. Implement in `infrastructure/cache/redis.cache.ts`
3. Export from `infrastructure/cache/index.ts`

### 2. Add a new use case
1. Create in `core/use-cases/batch-query.ts`
2. Use existing ports
3. Call from Application layer

### 3. Add a new validator
1. Create in `shared/utils/validators/`
2. Export from `shared/utils/validators/index.ts`
3. Use anywhere in the codebase

## Migration from Old Structure

The old structure has been backed up to `src_backup/`. Key changes:

- `src/client/` → `src/application/client/`
- `src/cache/` → `src/infrastructure/cache/`
- `src/fetcher/` → `src/infrastructure/http/`
- `src/normalizer/` → `src/infrastructure/http/` & `infrastructure/security/`
- `src/types/` → `src/shared/types/`
- `src/utils/` → `src/shared/utils/`

All imports have been automatically updated.
