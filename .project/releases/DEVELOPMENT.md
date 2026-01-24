# Development Guide

Quick reference for developers working on RDAPify.

## Prerequisites

- **Node.js**: 16.0.0 or higher
- **npm**: 7.0.0 or higher
- **Git**: 2.0.0 or higher

## Quick Start

```bash
# Clone repository
git clone https://github.com/rdapify/rdapify.git
cd rdapify

# Install dependencies
npm install

# Run tests
npm test

# Start development mode
npm run dev

# Build production
npm run build
```

## Development Commands

### Building
```bash
npm run build         # Build production version
npm run clean         # Clean dist folder
npm run dev           # Watch mode for development
```

### Testing
```bash
npm test              # Run all tests
npm run test:unit     # Run unit tests only
npm run test:integration  # Run integration tests only
npm run test:watch    # Watch mode
npm run test:coverage # Generate coverage report
```

### Code Quality
```bash
npm run lint          # Check code style
npm run lint:fix      # Fix code style issues
npm run typecheck     # TypeScript type checking
npm run format        # Format code with Prettier
npm run format:check  # Check formatting
```

### Verification
```bash
npm run verify        # Run all checks (lint + typecheck + test + build)
npm run verify:api    # Verify public API hasn't changed
```

## Project Structure

```
src/
├── core/             # Business logic (framework-agnostic)
├── infrastructure/   # External implementations
├── application/      # Orchestration layer
└── shared/           # Cross-cutting concerns

tests/
├── unit/             # Unit tests (mirror src structure)
├── integration/      # Integration tests
└── fixtures/         # Test data
```

See `ARCHITECTURE.md` for detailed architecture overview.

## Coding Standards

### TypeScript
- **Strict mode** enabled
- **Explicit types** for all public APIs
- **No `any`** types (use `unknown` if needed)
- **JSDoc comments** for public APIs

### Naming Conventions
```typescript
// Files: kebab-case
my-component.ts
user-service.ts

// Classes: PascalCase
class RDAPClient {}
class CacheManager {}

// Functions/Variables: camelCase
function queryDomain() {}
const userName = 'john';

// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 5000;

// Interfaces: PascalCase with 'I' prefix (for ports only)
interface ICachePort {}
interface IFetcherPort {}

// Types: PascalCase
type ResponseType = {};
type QueryOptions = {};
```

### Import Order
```typescript
// 1. External dependencies
import { readFile } from 'fs/promises';
import ipaddr from 'ipaddr.js';

// 2. Internal absolute imports
import type { RDAPResponse } from '@/shared/types';
import { ValidationError } from '@/shared/errors';

// 3. Relative imports
import { Fetcher } from './Fetcher';
import type { FetchOptions } from './types';
```

### Error Handling
```typescript
// ✅ GOOD - Proper error handling
try {
  const result = await fetch(url);
  if (!result.ok) {
    throw new NetworkError(`HTTP ${result.status}`, { url });
  }
  return await result.json();
} catch (error) {
  throw new RDAPError('Failed to fetch', { cause: error });
}

// ❌ BAD - Silent failures
try {
  return await fetch(url).then(r => r.json());
} catch (e) {
  console.log('error');
}
```

## Testing Guidelines

### Unit Tests
- Test one thing at a time
- Use descriptive test names
- Mock external dependencies
- Aim for >90% coverage

```typescript
describe('CacheManager', () => {
  it('should return cached value when key exists', () => {
    const cache = new CacheManager();
    cache.set('key', 'value');
    expect(cache.get('key')).toBe('value');
  });

  it('should return undefined when key does not exist', () => {
    const cache = new CacheManager();
    expect(cache.get('nonexistent')).toBeUndefined();
  });
});
```

### Integration Tests
- Test real interactions
- Use test fixtures
- Clean up after tests

```typescript
describe('RDAPClient Integration', () => {
  let client: RDAPClient;

  beforeEach(() => {
    client = new RDAPClient();
  });

  it('should query domain successfully', async () => {
    const result = await client.queryDomain('example.com');
    expect(result.handle).toBe('example.com');
  });
});
```

## Git Workflow

### Branch Naming
```bash
feature/add-redis-cache
fix/memory-leak-in-cache
docs/update-api-reference
refactor/simplify-normalizer
test/add-integration-tests
```

### Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
feat: add Redis cache adapter
fix: resolve memory leak in CacheManager
docs: update API reference for v0.2.0
refactor: simplify Normalizer implementation
test: add integration tests for RDAPClient
chore: update dependencies
```

### Pull Request Process
1. Create feature branch from `main`
2. Make changes with clear commits
3. Run `npm run verify` (must pass)
4. Update documentation if needed
5. Update CHANGELOG.md
6. Create PR with description
7. Wait for review and CI checks
8. Merge after approval

## Pre-commit Hooks

Husky runs these checks before each commit:
- Lint staged files
- Type check
- Run affected tests

To bypass (not recommended):
```bash
git commit --no-verify
```

## Debugging

### VS Code Launch Configuration
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal"
}
```

### Enable Verbose Logging
```typescript
const client = new RDAPClient({
  verbose: true
});
```

### Debug Specific Test
```bash
npm test -- --testNamePattern="should cache responses"
```

## Common Tasks

### Add New Feature
1. Create interface in `src/core/ports/` (if needed)
2. Implement in `src/infrastructure/`
3. Add tests in `tests/unit/`
4. Update documentation
5. Add example in `examples/`

### Add New Validator
1. Create in `src/shared/utils/validators/`
2. Export from `src/shared/utils/validators/index.ts`
3. Add tests
4. Use in validation layer

### Add New Error Type
1. Create in `src/shared/errors/`
2. Extend `BaseError`
3. Export from `src/shared/errors/index.ts`
4. Document in `docs/api-reference/types/errors.md`

## Performance Profiling

### Memory Usage
```bash
node --inspect-brk node_modules/.bin/jest
# Open chrome://inspect in Chrome
```

### CPU Profiling
```bash
node --prof your-script.js
node --prof-process isolate-*.log > profile.txt
```

## Troubleshooting

### Build Fails
```bash
npm run clean
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Tests Fail
```bash
npm run test:unit -- --verbose
npm run test:integration -- --verbose
```

### Type Errors
```bash
npm run typecheck
# Fix errors in reported files
```

## Resources

- **Architecture**: See `ARCHITECTURE.md`
- **Contributing**: See `CONTRIBUTING.md`
- **API Reference**: See `docs/api-reference/`
- **Examples**: See `examples/`

## Getting Help

- **Issues**: https://github.com/rdapify/rdapify/issues
- **Discussions**: https://github.com/rdapify/rdapify/discussions
- **Discord**: (coming soon)

---

**Last Updated**: January 24, 2026  
**Version**: 0.1.0-alpha.4
