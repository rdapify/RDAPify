# Test Vectors Usage Guide

## What are Test Vectors?

Test vectors are standardized test cases in JSON format located in `test_vectors/` directory. They provide real-world examples for testing.

## Available Test Vectors

- `domain_vectors.json` - Domain lookup test cases
- `ip_vectors.json` - IP address lookup test cases
- `asn_vectors.json` - ASN lookup test cases
- `error_vectors.json` - Error handling test cases
- `edge_cases.json` - Edge cases and boundary conditions

## Using Test Vectors

```typescript
import domainVectors from '../test_vectors/domain_vectors.json';

describe('Domain Lookup', () => {
  domainVectors.forEach(vector => {
    it(`should handle ${vector.description}`, async () => {
      const result = await client.queryDomain(vector.input);
      expect(result).toMatchObject(vector.expected);
    });
  });
});
```

## Test Vector Structure

```json
{
  "description": "Valid domain lookup",
  "input": "example.com",
  "expected": {
    "handle": "EXAMPLE-COM",
    "status": ["active"]
  },
  "shouldThrow": false
}
```

## Error Test Vectors

```json
{
  "description": "Invalid domain format",
  "input": "invalid..domain",
  "shouldThrow": true,
  "expectedError": "ValidationError"
}
```

## When to Use Test Vectors

1. **Unit Tests**: Use for validator and normalizer tests
2. **Integration Tests**: Use for end-to-end client tests
3. **Regression Tests**: Add new vectors when bugs are found
4. **Documentation**: Reference vectors in API docs as examples
