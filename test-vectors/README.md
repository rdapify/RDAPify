# RDAPify Test Vectors

Standardized test cases for RDAP protocol implementation validation.

## Overview

Test vectors are standardized input/output pairs used to verify correct implementation of RDAP protocol handling. These vectors are based on:

- **RFC 7480-7484**: RDAP specifications
- **IANA Bootstrap**: Registry discovery
- **Real-world data**: Sanitized responses from actual RDAP servers
- **Edge cases**: Boundary conditions and error scenarios

## File Structure

| File | Purpose | Test Cases |
|------|---------|------------|
| `domain_vectors.json` | Domain name queries | 25+ cases |
| `ip_vectors.json` | IP address queries | 20+ cases |
| `asn_vectors.json` | ASN queries | 15+ cases |
| `error_vectors.json` | Error handling | 20+ cases |
| `edge_cases.json` | Boundary conditions | 15+ cases |
| `anomaly_detection.json` | Malformed responses | 10+ cases |

## Usage

### In Tests

```typescript
import domainVectors from '../test-vectors/domain_vectors.json';

describe('Domain Validation', () => {
  domainVectors.valid.forEach(test => {
    it(`should handle ${test.description}`, () => {
      const result = validateDomain(test.input);
      expect(result).toEqual(test.expected);
    });
  });
});
```

### In Documentation

Test vectors serve as canonical examples for:
- API documentation
- Integration guides
- Troubleshooting guides
- Compliance verification

### In Benchmarking

```typescript
import { performance } from 'perf_hooks';
import vectors from '../test-vectors/domain_vectors.json';

const start = performance.now();
vectors.valid.forEach(test => client.domain(test.input));
const duration = performance.now() - start;
```

## Vector Format

### Standard Structure

```json
{
  "version": "1.0.0",
  "description": "Test vectors for domain queries",
  "valid": [
    {
      "id": "domain-001",
      "description": "Simple domain",
      "input": "example.com",
      "expected": {
        "objectClass": "domain",
        "ldhName": "example.com"
      }
    }
  ],
  "invalid": [
    {
      "id": "domain-err-001",
      "description": "Invalid characters",
      "input": "invalid domain.com",
      "error": "ValidationError",
      "message": "Domain contains invalid characters"
    }
  ]
}
```

### Field Definitions

- **id**: Unique identifier (format: `{type}-{category}-{number}`)
- **description**: Human-readable test case description
- **input**: Test input value
- **expected**: Expected output (for valid cases)
- **error**: Expected error type (for invalid cases)
- **message**: Expected error message pattern
- **metadata**: Additional context (optional)

## Test Categories

### 1. Valid Cases
Standard inputs that should succeed:
- Common formats
- International domains (IDN)
- Various TLDs
- Subdomains

### 2. Invalid Cases
Inputs that should fail validation:
- Malformed syntax
- Invalid characters
- Out-of-range values
- Protocol violations

### 3. Edge Cases
Boundary conditions:
- Maximum length inputs
- Minimum length inputs
- Special characters
- Unicode handling

### 4. Error Cases
Server error scenarios:
- 404 Not Found
- 429 Rate Limited
- 500 Server Error
- Timeout conditions

### 5. Anomaly Cases
Malformed or unexpected responses:
- Missing required fields
- Invalid data types
- Inconsistent data
- Protocol violations

## Compliance Testing

### RFC 7480 Compliance

Test vectors verify:
- ✅ JSON response format
- ✅ Object class definitions
- ✅ Status value handling
- ✅ Event structure
- ✅ Entity relationships

### IANA Bootstrap Compliance

Test vectors verify:
- ✅ TLD to registry mapping
- ✅ IP range to RIR mapping
- ✅ ASN to RIR mapping
- ✅ Fallback behavior

## Updating Test Vectors

### Adding New Vectors

1. Identify the test category
2. Assign unique ID
3. Write clear description
4. Define input and expected output
5. Add metadata if needed
6. Update this README

### Modifying Existing Vectors

1. Document reason for change
2. Update version number
3. Maintain backward compatibility
4. Update dependent tests

### Validation

Before committing:
```bash
# Validate JSON syntax
npm run validate:vectors

# Run tests with new vectors
npm test

# Check coverage impact
npm run test:coverage
```

## Version History

- **v1.0.0** (2024-01): Initial test vectors
  - 100+ test cases across all categories
  - RFC 7480-7484 compliance
  - Real-world data sanitization

## Contributing

When adding test vectors:
1. Use real-world examples when possible
2. Sanitize any PII data
3. Follow the standard format
4. Add clear descriptions
5. Update test count in README

## References

- [RFC 7480: HTTP Usage in RDAP](https://tools.ietf.org/html/rfc7480)
- [RFC 7481: Security Services for RDAP](https://tools.ietf.org/html/rfc7481)
- [RFC 7482: Registration Data Access Protocol Query Format](https://tools.ietf.org/html/rfc7482)
- [RFC 7483: JSON Responses for RDAP](https://tools.ietf.org/html/rfc7483)
- [RFC 7484: Finding Authoritative RDAP Service](https://tools.ietf.org/html/rfc7484)
- [IANA RDAP Bootstrap](https://data.iana.org/rdap/)

## License

Test vectors are provided under MIT License for testing and validation purposes.
