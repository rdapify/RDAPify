# Specifications

This directory contains technical specifications, RFC compliance documentation, and normalization rules for RDAPify.

## Contents

- **rdapify_spec_v1.md** - RDAPify specification version 1
- **normalization_rules.md** - Data normalization rules and JSONPath definitions
- **jsonpath_definitions.json** - JSONPath mappings for data extraction
- **test_vectors.json** - Standardized test cases
- **error_state_machine.mmd** - Error handling state machine diagram

## RFC Compliance

RDAPify implements the following IETF RFCs:
- RFC 7480: HTTP Usage in RDAP
- RFC 7481: Security Services for RDAP
- RFC 7482: RDAP Query Format
- RFC 7483: JSON Responses for RDAP
- RFC 7484: Finding Authoritative RDAP Service

## Test Vectors

Test vectors provide standardized test cases for:
- Domain lookups
- IP address queries
- ASN queries
- Error conditions
- Edge cases

## Contributing

When updating specifications:
1. Maintain RFC compliance
2. Update test vectors accordingly
3. Document breaking changes
4. Version appropriately
