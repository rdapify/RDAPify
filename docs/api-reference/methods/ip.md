# `ip()`

```typescript
ip(ip: string): Promise<IPResponse>
```

Queries RDAP data for an IPv4 or IPv6 address. The authoritative Regional Internet Registry (RIR) is discovered automatically from the IANA bootstrap registry.

---

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `ip` | `string` | IPv4 or IPv6 address — e.g. `'8.8.8.8'`, `'2001:4860:4860::8888'` |

---

## Return Value — `IPResponse`

```typescript
interface IPResponse {
  query: string;              // The input IP address
  objectClass: 'ip network';
  handle?: string;            // Network handle (e.g. 'NET-8-8-8-0-2')
  startAddress?: string;      // First address in the allocated block
  endAddress?: string;        // Last address in the allocated block
  ipVersion?: 'v4' | 'v6';
  name?: string;              // Network name (e.g. 'GOOGL-2')
  type?: string;              // Allocation type
  country?: string;           // ISO 3166-1 alpha-2 country code
  status?: RDAPStatus[];
  entities?: RDAPEntity[];    // Network owner, abuse contact, etc.
  events?: RDAPEvent[];
  links?: RDAPLink[];
  remarks?: RDAPRemark[];
  raw?: any;                  // Present only when includeRaw: true
  metadata: {
    source: string;           // RIR RDAP server URL
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
const result = await client.ip('8.8.8.8');

console.log(result.query);        // '8.8.8.8'
console.log(result.name);         // 'GOOGL-2'
console.log(result.country);      // 'US'
console.log(result.startAddress); // '8.8.8.0'
console.log(result.endAddress);   // '8.8.8.255'
console.log(result.ipVersion);    // 'v4'
```

### IPv6

```typescript
const result = await client.ip('2001:4860:4860::8888');
console.log(result.ipVersion); // 'v6'
console.log(result.country);   // 'US'
```

### Accessing the network owner entity

```typescript
const result = await client.ip('8.8.8.8');

const owner = result.entities?.find(e => e.roles?.includes('registrant'));
console.log(owner?.handle); // 'GOGL'
```

---

## SSRF protection

Queries for private and reserved IP ranges are blocked by SSRF protection (enabled by default):

```typescript
// These throw SSRFError:
await client.ip('192.168.1.1');    // RFC 1918 private range
await client.ip('127.0.0.1');      // Loopback
await client.ip('169.254.0.1');    // Link-local
```

To disable SSRF protection (not recommended in production):

```typescript
const client = new RDAPClient({ ssrfProtection: false });
```

---

## Error handling

```typescript
import { RDAPClient, ValidationError, FetchError, SSRFError } from 'rdapify';

const client = new RDAPClient();

try {
  const result = await client.ip('8.8.8.8');
} catch (error) {
  if (error instanceof ValidationError) {
    // Malformed IP address
  } else if (error instanceof SSRFError) {
    // Private / reserved IP blocked
  } else if (error instanceof FetchError) {
    // Network error or non-2xx response after retries
  }
}
```

---

## Related

- [domain()](domain.md)
- [asn()](asn.md)
- [RDAPClient options](../client.md#constructor-options) — ssrfProtection, cache, timeout
