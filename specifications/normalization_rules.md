# RDAP Response Normalization Rules

**Version**: 1.0  
**Date**: January 24, 2026

## Overview

This document defines the normalization rules for converting raw RDAP responses into a consistent, standardized format.

## Normalization Goals

1. **Consistency**: Same structure regardless of source registry
2. **Completeness**: Extract all relevant information
3. **Type Safety**: Ensure correct data types
4. **Simplicity**: Flatten complex nested structures where appropriate

## Field Mappings

### Domain Response

| RDAP Field | Normalized Field | Type | Transformation |
|------------|------------------|------|----------------|
| `ldhName` | `ldhName` | string | Lowercase |
| `unicodeName` | `unicodeName` | string | As-is |
| `handle` | `handle` | string | As-is |
| `status` | `status` | string[] | Lowercase, deduplicate |
| `nameservers[].ldhName` | `nameservers` | string[] | Extract, lowercase |
| `entities` | `entities` | Entity[] | Normalize entities |
| `events` | `events` | Event[] | Normalize events |
| `links` | `links` | Link[] | Normalize links |

### IP Response

| RDAP Field | Normalized Field | Type | Transformation |
|------------|------------------|------|----------------|
| `startAddress` | `startAddress` | string | Normalize IP format |
| `endAddress` | `endAddress` | string | Normalize IP format |
| `ipVersion` | `ipVersion` | 'v4' \| 'v6' | Detect from address |
| `name` | `name` | string | As-is |
| `type` | `type` | string | Lowercase |
| `country` | `country` | string | Uppercase (ISO 3166) |
| `handle` | `handle` | string | As-is |
| `status` | `status` | string[] | Lowercase, deduplicate |

### ASN Response

| RDAP Field | Normalized Field | Type | Transformation |
|------------|------------------|------|----------------|
| `startAutnum` | `startAutnum` | number | Parse integer |
| `endAutnum` | `endAutnum` | number | Parse integer |
| `name` | `name` | string | As-is |
| `type` | `type` | string | Lowercase |
| `country` | `country` | string | Uppercase (ISO 3166) |
| `handle` | `handle` | string | As-is |
| `status` | `status` | string[] | Lowercase, deduplicate |

## Nested Object Normalization

### Events

**Input**:
```json
{
  "eventAction": "registration",
  "eventDate": "1995-08-14T04:00:00Z"
}
```

**Output**:
```json
{
  "type": "registration",
  "date": "1995-08-14T04:00:00Z"
}
```

**Rules**:
- Rename `eventAction` → `type`
- Rename `eventDate` → `date`
- Normalize type to lowercase
- Validate ISO 8601 date format

### Entities

**Input**:
```json
{
  "objectClassName": "entity",
  "handle": "REG123",
  "roles": ["registrar"],
  "vcardArray": ["vcard", [...]]
}
```

**Output**:
```json
{
  "handle": "REG123",
  "roles": ["registrar"],
  "vcard": {...}
}
```

**Rules**:
- Extract `handle` and `roles`
- Parse vCard if present
- Normalize roles to lowercase
- Remove `objectClassName`

### Links

**Input**:
```json
{
  "value": "https://example.com/domain/example.com",
  "rel": "self",
  "href": "https://example.com/domain/example.com",
  "type": "application/rdap+json"
}
```

**Output**:
```json
{
  "rel": "self",
  "href": "https://example.com/domain/example.com",
  "type": "application/rdap+json"
}
```

**Rules**:
- Keep `rel`, `href`, `type`
- Remove redundant `value`
- Normalize `rel` to lowercase

## Status Code Normalization

### Standard Status Codes

| Raw Status | Normalized | Description |
|------------|-----------|-------------|
| `active` | `active` | Domain is active |
| `inactive` | `inactive` | Domain is inactive |
| `locked` | `locked` | Domain is locked |
| `pending create` | `pending-create` | Pending creation |
| `pending delete` | `pending-delete` | Pending deletion |
| `pending transfer` | `pending-transfer` | Pending transfer |
| `clientTransferProhibited` | `client-transfer-prohibited` | Transfer locked |
| `clientUpdateProhibited` | `client-update-prohibited` | Update locked |
| `clientDeleteProhibited` | `client-delete-prohibited` | Delete locked |

**Rules**:
- Convert to lowercase
- Replace spaces with hyphens
- Preserve camelCase as kebab-case
- Remove duplicates

## Date Normalization

### Input Formats

Accepted formats:
- ISO 8601: `2024-01-24T12:00:00Z`
- RFC 3339: `2024-01-24T12:00:00+00:00`
- Unix timestamp: `1706097600`

### Output Format

Always output ISO 8601:
```
YYYY-MM-DDTHH:mm:ss.sssZ
```

**Rules**:
- Convert all dates to UTC
- Include milliseconds if available
- Always include 'Z' suffix
- Validate date is not in future (with tolerance)

## Nameserver Normalization

### Input

```json
{
  "nameservers": [
    {
      "objectClassName": "nameserver",
      "ldhName": "ns1.example.com",
      "unicodeName": "ns1.example.com",
      "status": ["active"],
      "ipAddresses": {
        "v4": ["192.0.2.1"],
        "v6": ["2001:db8::1"]
      }
    }
  ]
}
```

### Output

```json
{
  "nameservers": ["ns1.example.com", "ns2.example.com"]
}
```

**Rules**:
- Extract `ldhName` only
- Convert to lowercase
- Remove duplicates
- Sort alphabetically

## Entity Role Normalization

### Standard Roles

| Raw Role | Normalized | Description |
|----------|-----------|-------------|
| `registrant` | `registrant` | Domain owner |
| `registrar` | `registrar` | Domain registrar |
| `administrative` | `administrative` | Admin contact |
| `technical` | `technical` | Tech contact |
| `billing` | `billing` | Billing contact |
| `abuse` | `abuse` | Abuse contact |
| `noc` | `noc` | Network operations |
| `sponsor` | `sponsor` | Sponsoring registrar |

**Rules**:
- Convert to lowercase
- Preserve standard roles
- Map non-standard roles to closest match

## Metadata Addition

### Added Fields

```json
{
  "metadata": {
    "source": "https://rdap.verisign.com",
    "timestamp": "2024-01-24T12:00:00.000Z",
    "cached": false,
    "normalized": true,
    "version": "1.0"
  }
}
```

**Rules**:
- `source`: Original RDAP server URL
- `timestamp`: Query execution time
- `cached`: Whether response was cached
- `normalized`: Always true
- `version`: Normalization version

## Error Handling

### Invalid Data

**Strategy**: Best-effort normalization

- Missing required fields → Use defaults
- Invalid dates → Use null
- Invalid status codes → Keep as-is
- Malformed entities → Skip

### Validation Errors

**Throw Error If**:
- Response is not valid JSON
- `objectClassName` is missing
- No identifying field (handle/ldhName)

## Examples

### Domain Normalization

**Input**:
```json
{
  "objectClassName": "domain",
  "ldhName": "EXAMPLE.COM",
  "handle": "DOM123",
  "status": ["active", "clientTransferProhibited", "active"],
  "nameservers": [
    {"ldhName": "NS1.EXAMPLE.COM"},
    {"ldhName": "NS2.EXAMPLE.COM"}
  ],
  "events": [
    {
      "eventAction": "registration",
      "eventDate": "1995-08-14T04:00:00Z"
    }
  ]
}
```

**Output**:
```json
{
  "ldhName": "example.com",
  "handle": "DOM123",
  "status": ["active", "client-transfer-prohibited"],
  "nameservers": ["ns1.example.com", "ns2.example.com"],
  "events": [
    {
      "type": "registration",
      "date": "1995-08-14T04:00:00.000Z"
    }
  ],
  "metadata": {
    "source": "https://rdap.verisign.com",
    "timestamp": "2024-01-24T12:00:00.000Z",
    "cached": false,
    "normalized": true,
    "version": "1.0"
  }
}
```

### IP Normalization

**Input**:
```json
{
  "objectClassName": "ip network",
  "handle": "NET-8-0-0-0-1",
  "startAddress": "8.0.0.0",
  "endAddress": "8.255.255.255",
  "ipVersion": "v4",
  "name": "LVLT-ORG-8-8",
  "type": "DIRECT ALLOCATION",
  "country": "us"
}
```

**Output**:
```json
{
  "handle": "NET-8-0-0-0-1",
  "startAddress": "8.0.0.0",
  "endAddress": "8.255.255.255",
  "ipVersion": "v4",
  "name": "LVLT-ORG-8-8",
  "type": "direct allocation",
  "country": "US",
  "metadata": {
    "source": "https://rdap.arin.net",
    "timestamp": "2024-01-24T12:00:00.000Z",
    "cached": false,
    "normalized": true,
    "version": "1.0"
  }
}
```

## Implementation Notes

### Performance

- Normalization should complete in <10ms
- Use streaming for large responses
- Cache normalized results

### Extensibility

- Support custom normalization rules
- Allow field mapping overrides
- Plugin system for custom transformations

## Testing

### Test Cases

Required test vectors:
- Valid domain response
- Valid IP response
- Valid ASN response
- Missing optional fields
- Invalid data types
- Malformed responses

See `test_vectors.json` for complete test suite.

---

**Document Status**: Stable  
**Last Updated**: January 24, 2026  
**Version**: 1.0
