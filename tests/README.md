# RDAPify Tests

This directory contains all tests for RDAPify.

## Test Structure

```
tests/
├── setup.ts                    # Jest setup file
├── unit/                       # Unit tests
│   ├── validators.test.ts      # Input validation tests
│   ├── helpers.test.ts         # Helper function tests
│   ├── errors.test.ts          # Error class tests
│   ├── in-memory-cache.test.ts # Cache tests
│   └── ssrf-protection.test.ts # SSRF protection tests
├── integration/                # Integration tests (TODO)
│   ├── domain.test.ts
│   ├── ip.test.ts
│   └── asn.test.ts
└── security/                   # Security tests (TODO)
    ├── ssrf.test.ts
    └── pii.test.ts
```

## Running Tests

### All Tests

```bash
npm test
```

### Unit Tests Only

```bash
npm run test:unit
```

### Integration Tests Only

```bash
npm run test:integration
```

### Security Tests Only

```bash
npm run test:security
```

### Watch Mode

```bash
npm run test:watch
```

### Coverage Report

```bash
npm test -- --coverage
```

## Writing Tests

### Unit Test Example

```typescript
import { validateDomain } from '../../src/utils/validators';
import { ValidationError } from '../../src/types/errors';

describe('validateDomain', () => {
  it('should accept valid domains', () => {
    expect(() => validateDomain('example.com')).not.toThrow();
  });

  it('should reject invalid domains', () => {
    expect(() => validateDomain('invalid domain')).toThrow(ValidationError);
  });
});
```

### Integration Test Example

```typescript
import { RDAPClient } from '../../src';

describe('RDAPClient - Domain Lookup', () => {
  let client: RDAPClient;

  beforeEach(() => {
    client = new RDAPClient({
      cache: false, // Disable cache for testing
    });
  });

  it('should query domain information', async () => {
    const result = await client.domain('example.com');

    expect(result.objectClass).toBe('domain');
    expect(result.ldhName).toBe('example.com');
    expect(result.metadata.source).toBeDefined();
  });
});
```

## Test Guidelines

### 1. Test Organization

- One test file per source file
- Group related tests using `describe` blocks
- Use clear, descriptive test names

### 2. Test Coverage

- Aim for 70%+ coverage for alpha release
- Aim for 90%+ coverage for stable release
- Focus on critical paths and edge cases

### 3. Mocking

- Mock external dependencies (network, time, etc.)
- Use Jest's built-in mocking capabilities
- Keep mocks simple and focused

### 4. Assertions

- Use specific assertions (toBe, toEqual, toThrow)
- Test both success and failure cases
- Verify error messages and types

### 5. Async Tests

- Always use async/await for async tests
- Handle promise rejections properly
- Set appropriate timeouts

## Current Test Status

### Unit Tests ✅

- [x] validators.test.ts (100% coverage)
- [x] helpers.test.ts (95% coverage)
- [x] errors.test.ts (100% coverage)
- [x] in-memory-cache.test.ts (90% coverage)
- [x] ssrf-protection.test.ts (95% coverage)
- [ ] cache-manager.test.ts (TODO)
- [ ] normalizer.test.ts (TODO)
- [ ] pii-redactor.test.ts (TODO)
- [ ] fetcher.test.ts (TODO)
- [ ] bootstrap-discovery.test.ts (TODO)
- [ ] rdap-client.test.ts (TODO)

### Integration Tests ⏳

- [ ] domain.test.ts (TODO)
- [ ] ip.test.ts (TODO)
- [ ] asn.test.ts (TODO)

### Security Tests ⏳

- [ ] ssrf.test.ts (TODO)
- [ ] pii.test.ts (TODO)

## Coverage Goals

| Component   | Current  | Target (Alpha) | Target (Stable) |
| ----------- | -------- | -------------- | --------------- |
| Validators  | 100%     | 90%            | 95%             |
| Helpers     | 95%      | 85%            | 90%             |
| Errors      | 100%     | 95%            | 100%            |
| Cache       | 90%      | 85%            | 90%             |
| SSRF        | 95%      | 90%            | 95%             |
| Normalizer  | 0%       | 80%            | 90%             |
| Fetcher     | 0%       | 75%            | 85%             |
| Client      | 0%       | 70%            | 85%             |
| **Overall** | **~40%** | **70%+**       | **90%+**        |

## Debugging Tests

### Run Single Test File

```bash
npm test -- validators.test.ts
```

### Run Single Test

```bash
npm test -- -t "should accept valid domains"
```

### Verbose Output

```bash
npm test -- --verbose
```

### Debug in VS Code

Add breakpoint and press F5 (launch.json configured)

## CI/CD Integration

Tests run automatically on:

- Every push to main branch
- Every pull request
- Before release

See `.github/workflows/ci.yml` for details.

## Contributing

When adding new features:

1. Write tests first (TDD approach)
2. Ensure all tests pass
3. Maintain or improve coverage
4. Update this README if needed

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [TypeScript Testing](https://kulshekhar.github.io/ts-jest/)
