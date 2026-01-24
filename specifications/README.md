# RDAPify Technical Specifications

Technical specifications and standards for RDAPify implementation.

## Documents

### [rdapify_spec_v1.md](rdapify_spec_v1.md)
Complete technical specification for RDAPify v1.0.

**Contents**:
- Architecture and design principles
- API specification and interfaces
- Protocol compliance (RFC 7480-7484)
- Security requirements
- Performance requirements
- Error handling
- Testing requirements
- Compatibility matrix

**Audience**: Developers, architects, implementers

### [normalization_rules.md](normalization_rules.md)
Data normalization rules for RDAP responses.

**Contents**:
- Field mappings (domain, IP, ASN)
- Nested object normalization
- Status code normalization
- Date normalization
- Entity role normalization
- Metadata addition
- Examples and test cases

**Audience**: Developers, QA engineers

### [error_state_machine.mmd](error_state_machine.mmd)
State machine diagram for error handling flow.

**Contents**:
- State transitions
- Error types and conditions
- Retry logic
- Recovery strategies

**Format**: Mermaid diagram

**View**: Use Mermaid Live Editor or GitHub

### [jsonpath_definitions.json](jsonpath_definitions.json)
JSONPath mappings for data extraction.

**Contents**:
- Path definitions for all object types
- Transformation rules
- Status code mappings
- Event action mappings
- Entity role mappings
- Examples

**Format**: JSON Schema

### [test_vectors.json](test_vectors.json)
Standardized test cases for validation.

**Contents**:
- Input validation vectors
- SSRF protection vectors
- Normalization test cases
- PII redaction test cases
- Error handling scenarios
- Cache behavior tests
- Retry logic tests

**Format**: JSON

**Usage**: Import in test suites for consistent testing

## Quick Reference

### RFC Compliance

| RFC | Title | Status |
|-----|-------|--------|
| 7480 | RDAP HTTP Usage | ✅ Full |
| 7481 | RDAP Security Services | ✅ Full |
| 7482 | RDAP Query Format | ✅ Full |
| 7483 | RDAP JSON Responses | ✅ Full |
| 7484 | RDAP Object Tagging | ✅ Full |

### API Endpoints

```typescript
// Domain query
GET /domain/{domain-name}

// IP query
GET /ip/{ip-address}

// ASN query
GET /autnum/{asn}
```

### Response Format

All responses follow this structure:

```json
{
  "objectClassName": "domain|ip network|autnum",
  "handle": "...",
  "status": ["..."],
  "events": [...],
  "entities": [...],
  "links": [...],
  "metadata": {
    "source": "...",
    "timestamp": "...",
    "cached": false,
    "normalized": true
  }
}
```

## Using Specifications

### For Developers

1. **Read** `rdapify_spec_v1.md` for overall architecture
2. **Reference** `normalization_rules.md` for data transformation
3. **Use** `jsonpath_definitions.json` for field extraction
4. **Test** with `test_vectors.json` for validation

### For QA Engineers

1. **Import** `test_vectors.json` into test suites
2. **Validate** against `normalization_rules.md`
3. **Verify** error states using `error_state_machine.mmd`

### For Architects

1. **Review** `rdapify_spec_v1.md` for design decisions
2. **Assess** compliance matrix
3. **Evaluate** security requirements
4. **Plan** integration based on API specification

## Validation

### Validating Implementation

```bash
# Run test vectors
npm test -- --testPathPattern=test-vectors

# Validate normalization
npm test -- --testPathPattern=normalization

# Check RFC compliance
npm test -- --testPathPattern=rfc
```

### Validating Responses

Use `jsonpath_definitions.json` to validate response structure:

```javascript
const jp = require('jsonpath');
const definitions = require('./jsonpath_definitions.json');

// Extract domain name
const ldhName = jp.query(response, definitions.definitions.domain.paths.ldhName);

// Extract nameservers
const nameservers = jp.query(response, definitions.definitions.domain.paths.nameservers);
```

## Contributing

When updating specifications:

1. **Update version** in document metadata
2. **Document changes** in CHANGELOG.md
3. **Update test vectors** if behavior changes
4. **Validate** against existing implementations
5. **Review** with maintainers

### Specification Versioning

Format: `MAJOR.MINOR`

- **MAJOR**: Breaking changes to API or behavior
- **MINOR**: Additions, clarifications, non-breaking changes

Current version: **1.0**

## Standards References

### RDAP Standards
- [RFC 7480](https://tools.ietf.org/html/rfc7480) - HTTP Usage in RDAP
- [RFC 7481](https://tools.ietf.org/html/rfc7481) - Security Services for RDAP
- [RFC 7482](https://tools.ietf.org/html/rfc7482) - Registration Data Access Protocol Query Format
- [RFC 7483](https://tools.ietf.org/html/rfc7483) - JSON Responses for RDAP
- [RFC 7484](https://tools.ietf.org/html/rfc7484) - Finding the Authoritative RDAP Service

### Related Standards
- [RFC 1918](https://tools.ietf.org/html/rfc1918) - Address Allocation for Private Internets
- [RFC 3339](https://tools.ietf.org/html/rfc3339) - Date and Time on the Internet
- [RFC 5730](https://tools.ietf.org/html/rfc5730) - Extensible Provisioning Protocol (EPP)
- [RFC 6350](https://tools.ietf.org/html/rfc6350) - vCard Format Specification

### JSON Standards
- [JSON Schema](https://json-schema.org/) - JSON Schema Specification
- [JSONPath](https://goessner.net/articles/JsonPath/) - JSONPath Expression Syntax

## Tools

### Viewing Diagrams

**Mermaid Diagrams** (`error_state_machine.mmd`):
- [Mermaid Live Editor](https://mermaid.live/)
- GitHub (automatic rendering)
- VS Code with Mermaid extension

### Validating JSON

**JSON Schema Validation**:
```bash
npm install -g ajv-cli

# Validate test vectors
ajv validate -s test_vectors.schema.json -d test_vectors.json

# Validate JSONPath definitions
ajv validate -s jsonpath_definitions.schema.json -d jsonpath_definitions.json
```

## Changelog

### Version 1.0 (2026-01-24)
- Initial specification release
- Complete RFC 7480-7484 compliance
- Normalization rules defined
- Test vectors established
- Error state machine documented

---

**Document Status**: Stable  
**Last Updated**: January 24, 2026  
**Version**: 1.0
