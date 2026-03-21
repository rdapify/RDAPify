# `DomainResponse`

The normalized response object returned by [`client.domain()`](../methods/domain.md).

```typescript
interface DomainResponse {
  query: string;           // The input domain, as provided
  objectClass: 'domain';
  handle?: string;         // Registry-assigned handle (e.g. '2336799_DOMAIN_COM-VRSN')
  ldhName?: string;        // LDH (ASCII) form
  unicodeName?: string;    // Unicode (IDN) form, when applicable
  status?: RDAPStatus[];   // Status flags (e.g. 'clientDeleteProhibited')
  nameservers?: string[];  // Delegated nameserver hostnames
  registrar?: {
    name?: string;
    handle?: string;
    url?: string;
  };
  entities?: RDAPEntity[];  // All associated entities
  events?: RDAPEvent[];     // Lifecycle events
  links?: RDAPLink[];
  remarks?: RDAPRemark[];
  raw?: any;               // Only present when client option includeRaw: true
  metadata: {
    source: string;        // RDAP server URL
    timestamp: string;     // ISO 8601 query timestamp
    cached: boolean;
  };
}
```

---

## Sub-types

### `RDAPEvent`

```typescript
interface RDAPEvent {
  eventAction: string;  // 'registration' | 'expiration' | 'last changed' | ...
  eventDate: string;    // ISO 8601 date string
  links?: RDAPLink[];
}
```

### `RDAPEntity`

```typescript
interface RDAPEntity {
  handle?: string;
  objectClass: string;
  roles?: string[];         // 'registrant' | 'administrative' | 'technical' | 'registrar' | ...
  vcardArray?: any[];       // vCard 4.0 array representation
  entities?: RDAPEntity[];  // Nested sub-entities
  events?: RDAPEvent[];
  links?: RDAPLink[];
  remarks?: RDAPRemark[];
}
```

### `RDAPLink`

```typescript
interface RDAPLink {
  value: string;
  rel: string;
  href: string;
  type?: string;
}
```

### `RDAPRemark`

```typescript
interface RDAPRemark {
  title?: string;
  description: string[];
  links?: RDAPLink[];
}
```

---

## PII redaction

When `privacy: true` (the default), the following vCard fields inside entity objects are replaced with `[REDACTED]`:

- `email`
- `phone` (tel)
- `fax`

Other fields — `fn` (formatted name), `org`, `adr` — are passed through as-is from the registry. Registries vary in how much they expose; most modern registries already redact personal data server-side.

To disable redaction entirely:

```typescript
const client = new RDAPClient({ privacy: false });
```

To configure the redaction fields or replacement text:

```typescript
const client = new RDAPClient({
  privacy: {
    redactPII: true,
    redactFields: ['email', 'phone', 'fax'],
    redactionText: '[REDACTED]',
  },
});
```

---

## Common access patterns

```typescript
const result = await client.domain('example.com');

// Query input
result.query             // 'example.com'

// Nameservers
result.nameservers       // ['a.iana-servers.net', 'b.iana-servers.net']

// Registrar
result.registrar?.name   // 'Registrar Name, Inc.'

// Entities by role
const registrant = result.entities?.find(e => e.roles?.includes('registrant'));
const techContact = result.entities?.find(e => e.roles?.includes('technical'));

// Events
const expiry   = result.events?.find(e => e.eventAction === 'expiration');
const created  = result.events?.find(e => e.eventAction === 'registration');
const modified = result.events?.find(e => e.eventAction === 'last changed');

console.log(expiry?.eventDate);   // '2024-08-13T04:00:00Z'
console.log(created?.eventDate);  // '1995-08-14T04:00:00Z'

// Cache information
result.metadata.cached    // false on first call, true on cache hit
result.metadata.source    // 'https://rdap.verisign.com/com/v1/domain/example.com'
result.metadata.timestamp // '2026-03-21T12:00:00.000Z'
```

---

## See also

- [`IPResponse`](ip-response.md)
- [`ASNResponse`](asn-response.md)
- [`domain()` method reference](../methods/domain.md)
- [Privacy controls](../privacy-controls.md)
