---
name: RDAPify Testing
description: Implements comprehensive tests using Jest and test vectors
---

# RDAPify Testing Skill

## Testing Philosophy

- Test behavior, not implementation
- Use real test vectors, not dummy data
- One assertion per test when possible
- Tests should be fast and deterministic

## Test Structure

```
tests/
├── unit/              # Isolated component tests
├── integration/       # Multi-component tests
├── security/          # Security-specific tests
└── setup.ts          # Test configuration
```

## Unit Test Pattern

```typescript
import { validateDomain } from '../src/utils/validators';
import { ValidationError } from '../src/types/errors';

describe('validateDomain', () => {
  it('should accept valid domain', () => {
    expect(validateDomain('example.com')).toBe('example.com');
  });
  
  it('should reject empty domain', () => {
    expect(() => validateDomain('')).toThrow(ValidationError);
  });
  
  it('should normalize to lowercase', () => {
    expect(validateDomain('EXAMPLE.COM')).toBe('example.com');
  });
});
```

## Integration Test Pattern

```typescript
import { createRDAPClient } from '../src';
import domainVectors from '../test_vectors/domain_vectors.json';

describe('RDAPClient Integration', () => {
  let client: RDAPClient;
  
  beforeEach(() => {
    client = createRDAPClient({ cache: false });
  });
  
  it('should query domain successfully', async () => {
    const result = await client.queryDomain('example.com');
    expect(result).toHaveProperty('handle');
    expect(result).toHaveProperty('status');
  });
});
```

## Security Test Pattern

```typescript
import { SSRFProtection } from '../src/fetcher/SSRFProtection';

describe('SSRF Protection', () => {
  const ssrf = new SSRFProtection();
  
  it('should block private IP ranges', () => {
    expect(() => ssrf.validateURL('https://192.168.1.1')).toThrow();
    expect(() => ssrf.validateURL('https://10.0.0.1')).toThrow();
  });
  
  it('should block localhost', () => {
    expect(() => ssrf.validateURL('https://localhost')).toThrow();
    expect(() => ssrf.validateURL('https://127.0.0.1')).toThrow();
  });
  
  it('should allow public IPs', () => {
    expect(() => ssrf.validateURL('https://8.8.8.8')).not.toThrow();
  });
});
```

## Using Test Vectors

```typescript
import errorVectors from '../test_vectors/error_vectors.json';

describe('Error Handling', () => {
  errorVectors.forEach(vector => {
    it(vector.description, async () => {
      if (vector.shouldThrow) {
        await expect(
          client.queryDomain(vector.input)
        ).rejects.toThrow(vector.expectedError);
      }
    });
  });
});
```

## Mock Pattern

```typescript
// Mock external dependencies only
jest.mock('../src/fetcher/Fetcher');

const mockFetcher = {
  fetch: jest.fn().mockResolvedValue({ handle: 'TEST' })
};
```

## Test Coverage Requirements

- Minimum 80% code coverage
- 100% coverage for security-critical code
- All error paths tested
- Edge cases from test vectors

## Running Tests

```bash
npm test                    # All tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:security      # Security tests only
npm run test:coverage      # With coverage report
```

## What NOT to Test

- ❌ Third-party library internals
- ❌ TypeScript type checking (use tsc)
- ❌ Obvious getters/setters
- ❌ Private methods directly

## Test Naming Convention

```typescript
// Pattern: should [expected behavior] when [condition]
it('should throw ValidationError when domain is empty', () => {
  // test
});

// NOT: "test domain validation" or "it works"
```
