# Domain Layer

This directory is reserved for domain models following Domain-Driven Design (DDD) principles.

## Current Status

**Status:** Empty (placeholder for future use)

RDAPify currently uses a simplified architecture where domain types are defined in `shared/types/` instead of full domain entities. This approach is appropriate for the current scope and complexity.

## Purpose

The domain layer will contain:

- **Entities** - Objects with identity and lifecycle
- **Value Objects** - Immutable objects defined by their attributes
- **Domain Errors** - Business rule violations

## Directory Structure

```
domain/
├── entities/        # Domain entities with identity
├── value-objects/   # Immutable value objects
└── errors/          # Domain-specific errors
```

## When to Add Domain Models

Consider adding domain models when:

1. **Complex Business Rules** - Domain logic becomes too complex for simple types
2. **Behavior + Data** - Objects need methods that operate on their data
3. **Invariants** - Business rules must be enforced at all times
4. **Rich Domain** - Multiple related concepts need coordination

## Future Examples

### Entities (entities/)

Entities have **identity** and **lifecycle**:

```typescript
// Future: Domain entity example
export class Domain {
  constructor(
    private readonly handle: string,
    private status: DomainStatus[],
    private nameservers: Nameserver[],
    private registrar: Registrar | null
  ) {
    this.validate();
  }
  
  // Business logic
  isActive(): boolean {
    return this.status.includes(DomainStatus.Active);
  }
  
  isExpired(): boolean {
    return this.status.includes(DomainStatus.Expired);
  }
  
  canBeTransferred(): boolean {
    return this.isActive() && !this.hasTransferLock();
  }
  
  addNameserver(ns: Nameserver): void {
    if (this.nameservers.length >= 13) {
      throw new DomainError('Maximum 13 nameservers allowed');
    }
    this.nameservers.push(ns);
  }
  
  private validate(): void {
    if (!this.handle) {
      throw new DomainError('Domain handle is required');
    }
  }
  
  private hasTransferLock(): boolean {
    return this.status.includes(DomainStatus.ClientTransferProhibited);
  }
}
```

### Value Objects (value-objects/)

Value objects are **immutable** and defined by their **attributes**:

```typescript
// Future: Value object example
export class EmailAddress {
  private readonly value: string;
  
  constructor(email: string) {
    if (!this.isValid(email)) {
      throw new ValidationError(`Invalid email: ${email}`);
    }
    this.value = email.toLowerCase();
  }
  
  private isValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  
  toString(): string {
    return this.value;
  }
  
  getDomain(): string {
    return this.value.split('@')[1];
  }
  
  equals(other: EmailAddress): boolean {
    return this.value === other.value;
  }
}

export class IPAddress {
  private readonly value: string;
  private readonly version: 'v4' | 'v6';
  
  constructor(ip: string) {
    this.version = this.detectVersion(ip);
    this.value = this.normalize(ip);
  }
  
  isV4(): boolean {
    return this.version === 'v4';
  }
  
  isV6(): boolean {
    return this.version === 'v6';
  }
  
  isPrivate(): boolean {
    // RFC 1918 check for IPv4
    if (this.isV4()) {
      return /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(this.value);
    }
    return false;
  }
  
  private detectVersion(ip: string): 'v4' | 'v6' {
    return ip.includes(':') ? 'v6' : 'v4';
  }
  
  private normalize(ip: string): string {
    // Normalization logic
    return ip;
  }
}

export class ASN {
  private readonly value: number;
  
  constructor(asn: string | number) {
    this.value = this.parse(asn);
    this.validate();
  }
  
  private parse(asn: string | number): number {
    if (typeof asn === 'number') return asn;
    return parseInt(asn.replace(/^AS/i, ''), 10);
  }
  
  private validate(): void {
    if (this.value < 0 || this.value > 4294967295) {
      throw new ValidationError('ASN must be between 0 and 4294967295');
    }
  }
  
  toString(): string {
    return `AS${this.value}`;
  }
  
  toNumber(): number {
    return this.value;
  }
}
```

### Domain Errors (errors/)

Domain-specific error types:

```typescript
// Future: Domain error examples
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export class InvalidDomainError extends DomainError {
  constructor(domain: string, reason: string) {
    super(`Invalid domain "${domain}": ${reason}`);
    this.name = 'InvalidDomainError';
  }
}

export class DomainNotFoundError extends DomainError {
  constructor(domain: string) {
    super(`Domain not found: ${domain}`);
    this.name = 'DomainNotFoundError';
  }
}

export class BusinessRuleViolationError extends DomainError {
  constructor(rule: string, details: string) {
    super(`Business rule violated: ${rule} - ${details}`);
    this.name = 'BusinessRuleViolationError';
  }
}
```

## Current Architecture

Currently, RDAPify uses:

- **Types** in `shared/types/` for data structures
- **Validators** in `shared/utils/validators/` for validation logic
- **Errors** in `shared/errors/` for error handling

This is simpler and sufficient for current needs.

## Migration Path

When domain models are needed:

1. **Start small** - Convert one type to entity/value object
2. **Add behavior** - Move validation and business logic to domain models
3. **Refactor gradually** - Update application layer to use domain models
4. **Maintain compatibility** - Keep shared types for DTOs

Example migration:
```typescript
// Before: Simple type
interface DomainResponse {
  handle: string;
  status: string[];
}

// After: Domain entity
class Domain {
  constructor(handle: string, status: DomainStatus[]) {
    // Validation and business logic
  }
  
  isActive(): boolean {
    return this.status.includes(DomainStatus.Active);
  }
}
```

## Benefits of Domain Models

When implemented, domain models provide:

✅ **Encapsulation** - Business logic lives with data
✅ **Validation** - Invariants enforced at construction
✅ **Type Safety** - Stronger guarantees than plain objects
✅ **Testability** - Business logic tested in isolation
✅ **Expressiveness** - Code reads like business language

## Related

- **Current Types**: `src/shared/types/README.md`
- **Validators**: `src/shared/utils/validators/`
- **Core Layer**: `src/core/README.md`
- **DDD Resources**: `docs/architecture/layer_design.md`

---

**Status**: Placeholder for future domain models  
**Current Approach**: Simple types in `shared/types/`  
**Migration**: Gradual, as complexity grows
