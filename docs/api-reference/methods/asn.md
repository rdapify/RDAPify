# `asn()`

```typescript
asn(asn: string | number): Promise<ASNResponse>
```

Queries RDAP data for an Autonomous System Number. The authoritative RIR is discovered automatically from the IANA bootstrap registry.

---

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `asn` | `string \| number` | ASN — bare number (`15169`) or `AS`-prefixed string (`'AS15169'`). Case-insensitive prefix accepted. |

---

## Return Value — `ASNResponse`

```typescript
interface ASNResponse {
  query: string;          // Normalised query string (e.g. 'AS15169')
  objectClass: 'autnum';
  handle?: string;        // Registry handle
  startAutnum?: number;   // First ASN in the allocated block
  endAutnum?: number;     // Last ASN in the allocated block
  name?: string;          // Organisation name (e.g. 'GOOGLE')
  type?: string;          // Allocation type
  country?: string;       // ISO 3166-1 alpha-2 country code
  status?: RDAPStatus[];
  entities?: RDAPEntity[];
  events?: RDAPEvent[];
  links?: RDAPLink[];
  remarks?: RDAPRemark[];
  raw?: any;              // Present only when includeRaw: true
  metadata: {
    source: string;
    timestamp: string;
    cached: boolean;
  };
}
```

---

## Examples

### Basic lookup

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

// Both forms are equivalent
const result = await client.asn(15169);
const result = await client.asn('AS15169');

console.log(result.query);      // 'AS15169'
console.log(result.name);       // 'GOOGLE'
console.log(result.country);    // 'US'
console.log(result.startAutnum); // 15169
console.log(result.endAutnum);   // 15169
```

### Accessing the registrant entity

```typescript
const result = await client.asn(15169);

const registrant = result.entities?.find(e => e.roles?.includes('registrant'));
console.log(registrant?.handle);
```

### Expiration / last-changed events

```typescript
const result = await client.asn(15169);

const lastChanged = result.events?.find(e => e.eventAction === 'last changed');
console.log(lastChanged?.eventDate); // ISO 8601 date
```

---

## Error handling

```typescript
import { RDAPClient, ValidationError, FetchError } from 'rdapify';

const client = new RDAPClient();

try {
  const result = await client.asn(15169);
} catch (error) {
  if (error instanceof ValidationError) {
    // Malformed or out-of-range ASN
  } else if (error instanceof FetchError) {
    // Network error or non-2xx response after retries
  }
}
```

---

## Related

- [domain()](domain.md)
- [ip()](ip.md)
- [RDAPClient options](../client.md#constructor-options)
