# `domain()`

```typescript
domain(domain: string): Promise<DomainResponse>
```

Queries registration data for a domain name. The authoritative RDAP server is discovered automatically from the IANA bootstrap registry (RFC 9224).

---

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `domain` | `string` | Domain name — ASCII (LDH) or Unicode IDN (e.g. `'example.com'`, `'例子.测试'`) |

---

## Return Value — `DomainResponse`

```typescript
interface DomainResponse {
  query: string;           // The input domain, as provided
  objectClass: 'domain';
  handle?: string;         // Registry-assigned handle (e.g. '2336799_DOMAIN_COM-VRSN')
  ldhName?: string;        // LDH (ASCII) form of the domain
  unicodeName?: string;    // Unicode (IDN) form, when different from ldhName
  status?: RDAPStatus[];   // Status flags per RFC 5732 (e.g. 'clientDeleteProhibited')
  nameservers?: string[];  // Delegated nameservers (hostnames only)
  registrar?: {
    name?: string;
    handle?: string;
    url?: string;
  };
  entities?: RDAPEntity[];  // All associated entities (registrant, admin, tech, etc.)
  events?: RDAPEvent[];     // Lifecycle events — see below
  links?: RDAPLink[];
  remarks?: RDAPRemark[];
  raw?: any;               // Present only when client option includeRaw: true
  metadata: {
    source: string;        // RDAP server URL that served the response
    timestamp: string;     // ISO 8601 query timestamp
    cached: boolean;       // true when served from cache
  };
}
```

### Events

```typescript
interface RDAPEvent {
  eventAction: string;  // e.g. 'registration', 'expiration', 'last changed'
  eventDate: string;    // ISO 8601 date string
}
```

Common `eventAction` values: `'registration'`, `'last changed'`, `'expiration'`, `'deletion'`.

### Entities

Entities carry role information in their `roles` array. Common roles: `'registrant'`, `'administrative'`, `'technical'`, `'billing'`, `'registrar'`.

When PII redaction is enabled (default), fields like `email`, `phone`, `fax` inside entity vCard data are replaced with `[REDACTED]`.

---

## Examples

### Basic query

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();
const result = await client.domain('example.com');

console.log(result.query);                    // 'example.com'
console.log(result.registrar?.name);          // registrar name
console.log(result.nameservers);              // ['a.iana-servers.net', 'b.iana-servers.net']
console.log(result.status);                   // ['client delete prohibited', ...]
console.log(result.metadata.cached);          // false (first call), true (subsequent)

// Expiration date
const expiry = result.events?.find(e => e.eventAction === 'expiration');
console.log(expiry?.eventDate);               // '2024-08-13T04:00:00Z'
```

### With raw response

```typescript
const client = new RDAPClient({ includeRaw: true });
const result = await client.domain('example.com');

console.log(result.raw); // unprocessed RDAP JSON from the registry
```

### Disable PII redaction

```typescript
const client = new RDAPClient({ privacy: false });
const result = await client.domain('example.com');
// entity vCard fields (email, phone) are not redacted
```

### Explicit TypeScript types

```typescript
import { RDAPClient, DomainResponse, RDAPEvent } from 'rdapify';

const client = new RDAPClient();
const result: DomainResponse = await client.domain('example.com');

const expiry: RDAPEvent | undefined =
  result.events?.find(e => e.eventAction === 'expiration');
```

---

## Error handling

```typescript
import { RDAPClient, ValidationError, FetchError, SSRFError } from 'rdapify';

const client = new RDAPClient();

try {
  const result = await client.domain('example.com');
} catch (error) {
  if (error instanceof ValidationError) {
    // Malformed domain name
  } else if (error instanceof SSRFError) {
    // Target blocked by SSRF protection
  } else if (error instanceof FetchError) {
    // Network error or non-2xx response after all retries
  }
}
```

---

## Related

- [ip()](ip.md) — IP address queries
- [asn()](asn.md) — ASN queries
- [nameserver()](../client.md#nameservernameserver) — Nameserver queries
- [entity()](../client.md#entityhandle-serverurl) — Entity queries
- [RDAPClient options](../client.md#constructor-options) — Timeout, cache, retry, privacy
