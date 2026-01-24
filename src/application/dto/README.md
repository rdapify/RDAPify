# Data Transfer Objects (DTOs)

This directory is reserved for Data Transfer Objects in the Application layer.

## Purpose

DTOs are used to transfer data between layers without exposing internal domain models. They provide:

- **Decoupling**: Separate API contracts from domain models
- **Validation**: Input validation before reaching domain layer
- **Transformation**: Convert external data to internal format
- **Versioning**: Support multiple API versions

## Current Status

**Status**: Not currently used

RDAPify currently uses domain types directly from the `core/domain` layer. DTOs will be added when:

1. **API Versioning**: Multiple API versions need to coexist
2. **Complex Transformations**: Input requires significant preprocessing
3. **External Integrations**: Third-party systems require specific formats

## When to Add DTOs

Add DTOs when you need to:

- Support multiple API versions simultaneously
- Validate complex input before domain processing
- Transform external formats to internal models
- Protect domain models from external changes

## Example Structure

When DTOs are needed, they would follow this pattern:

```typescript
// dto/DomainQueryDTO.ts
export interface DomainQueryDTO {
  domain: string;
  options?: {
    cache?: boolean;
    redactPII?: boolean;
  };
}

// dto/DomainResponseDTO.ts
export interface DomainResponseDTO {
  domain: string;
  status: string[];
  nameservers: string[];
  // ... simplified response
}
```

## Current Architecture

RDAPify uses types directly from domain layer:

```
User Input
    ↓
RDAPClient (validates input)
    ↓
Domain Types (from core/domain)
    ↓
Infrastructure Layer
    ↓
Response (domain types)
```

## Future Considerations

DTOs may be added for:

- **GraphQL API**: Different query structure
- **REST API v2**: Breaking changes without affecting v1
- **Batch Operations**: Complex multi-query requests
- **Webhooks**: Event notification formats

## Related

- Domain entities: `src/core/domain/entities/`
- Type definitions: `src/shared/types/`
- API client: `src/application/client/`

---

**Note**: This is a placeholder directory for future use. Current implementation uses domain types directly for simplicity.
