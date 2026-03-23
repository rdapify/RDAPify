---
date: 2026-03-02
slug: ip-address-lookup-with-rdap
title: "IP Address Lookup with RDAP: A Practical Guide"
authors: [rdapify]
tags: [rdap, ip-lookup, networking, tutorial]
description: "Learn how to look up IP address ownership, geolocation hints, and network allocation data using RDAP. Practical examples with RDAPify for both IPv4 and IPv6."
keywords: [ip address lookup, ip whois lookup, rdap ip query, who owns ip address, ip address information, ip network lookup, ipv6 lookup]
image: /img/rdapify-social-card.png
---
date: 2026-03-02

Need to find out who owns an IP address, what network it belongs to, or when it was allocated? RDAP provides structured, authoritative answers. This guide shows you how to perform IP lookups with real code examples.

<!-- truncate -->

## Why Look Up IP Addresses?

IP address lookups are essential for:

- **Security investigations** — Identify the source of malicious traffic
- **Abuse reporting** — Find the right contact for network abuse
- **Compliance** — Verify data residency and network ownership
- **Network planning** — Understand IP allocations and available ranges
- **Threat intelligence** — Map infrastructure to organizations

## How IP RDAP Works

IP address space is managed by five Regional Internet Registries (RIRs):

| RIR | Region | RDAP Base URL |
|-----|--------|---------------|
| ARIN | North America | `https://rdap.arin.net/registry/` |
| RIPE NCC | Europe, Middle East, Central Asia | `https://rdap.db.ripe.net/` |
| APNIC | Asia-Pacific | `https://rdap.apnic.net/` |
| AFRINIC | Africa | `https://rdap.afrinic.net/rdap/` |
| LACNIC | Latin America, Caribbean | `https://rdap.lacnic.net/rdap/` |

When you query an IP, the RDAP client uses IANA bootstrap data to route your request to the correct RIR.

## Basic IP Lookup

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

// IPv4 lookup
const result = await client.ip('8.8.8.8');

console.log(result.name);          // "GOGL" — network name
console.log(result.handle);        // "NET-8-8-8-0-2"
console.log(result.startAddress);  // "8.8.8.0"
console.log(result.endAddress);    // "8.8.8.255"
console.log(result.country);       // "US"
console.log(result.type);          // "DIRECT ALLOCATION"
console.log(result.parentHandle);  // "NET-8-0-0-0-1"
```

## IPv6 Lookup

```typescript
// IPv6 works the same way
const ipv6Result = await client.ip('2001:4860:4860::8888');

console.log(ipv6Result.name);          // "GOGL"
console.log(ipv6Result.startAddress);  // "2001:4860::"
console.log(ipv6Result.endAddress);    // "2001:4860:ffff:ffff:ffff:ffff:ffff:ffff"
console.log(ipv6Result.country);       // "US"
```

## Understanding the Response

An IP RDAP response contains several key sections:

### Network Information

```typescript
const ip = await client.ip('1.1.1.1');

// Basic network info
ip.name;          // Network name
ip.handle;        // Registry handle
ip.startAddress;  // Start of the IP block
ip.endAddress;    // End of the IP block
ip.ipVersion;     // "v4" or "v6"
ip.type;          // Allocation type
ip.country;       // Country code (ISO 3166-1)
```

### Events (Timeline)

```typescript
// When was this IP block registered and last updated?
for (const event of ip.events ?? []) {
  console.log(`${event.eventAction}: ${event.eventDate}`);
}
// registration: 2010-07-14T00:00:00Z
// last changed: 2024-03-15T12:30:00Z
```

### Entities (Contacts)

```typescript
// Who manages this IP block?
for (const entity of ip.entities ?? []) {
  console.log(`Role: ${entity.roles?.join(', ')}`);
  console.log(`Handle: ${entity.handle}`);

  // Contact details in vCard format
  if (entity.vcardArray) {
    const vcard = entity.vcardArray[1];
    for (const field of vcard) {
      if (field[0] === 'fn') console.log(`Name: ${field[3]}`);
      if (field[0] === 'email') console.log(`Email: ${field[3]}`);
    }
  }
}
```

### CIDR Notation

```typescript
// Get the network in CIDR format
if (ip.cidr0_cidrs) {
  for (const cidr of ip.cidr0_cidrs) {
    console.log(`${cidr.v4prefix || cidr.v6prefix}/${cidr.length}`);
    // "8.8.8.0/24"
  }
}
```

## Practical Use Cases

### Use Case 1: Identify Network Owner

```typescript
async function identifyOwner(ipAddress: string) {
  const client = new RDAPClient();
  const result = await client.ip(ipAddress);

  const registrant = result.entities?.find(
    e => e.roles?.includes('registrant')
  );

  return {
    network: result.name,
    range: `${result.startAddress} - ${result.endAddress}`,
    country: result.country,
    owner: registrant?.handle ?? 'Unknown',
    type: result.type,
  };
}

const owner = await identifyOwner('151.101.1.140');
console.log(owner);
// {
//   network: "SKYCA-3",
//   range: "151.101.0.0 - 151.101.255.255",
//   country: "US",
//   owner: "SKYCA",
//   type: "DIRECT ALLOCATION"
// }
```

### Use Case 2: Abuse Contact Finder

```typescript
async function findAbuseContact(ipAddress: string) {
  const client = new RDAPClient();
  const result = await client.ip(ipAddress);

  const abuseEntity = result.entities?.find(
    e => e.roles?.includes('abuse')
  );

  if (!abuseEntity?.vcardArray) {
    return { email: null, phone: null };
  }

  const vcard = abuseEntity.vcardArray[1];
  const email = vcard.find((f: string[]) => f[0] === 'email')?.[3];
  const phone = vcard.find((f: string[]) => f[0] === 'tel')?.[3];

  return { email, phone };
}

const abuse = await findAbuseContact('203.0.113.50');
console.log(`Report abuse to: ${abuse.email}`);
```

### Use Case 3: Batch IP Analysis

```typescript
async function analyzeIPs(addresses: string[]) {
  const client = new RDAPClient({ cache: { ttl: 3600 } });

  const results = await Promise.all(
    addresses.map(async (ip) => {
      try {
        const data = await client.ip(ip);
        return {
          ip,
          network: data.name,
          country: data.country,
          type: data.type,
        };
      } catch {
        return { ip, network: 'unknown', country: 'unknown', type: 'error' };
      }
    })
  );

  // Group by country
  const byCountry = new Map<string, number>();
  for (const r of results) {
    byCountry.set(r.country, (byCountry.get(r.country) ?? 0) + 1);
  }

  return { results, countryDistribution: Object.fromEntries(byCountry) };
}

const analysis = await analyzeIPs([
  '8.8.8.8',
  '1.1.1.1',
  '208.67.222.222',
  '9.9.9.9',
]);
console.log(analysis.countryDistribution);
// { US: 3, AU: 1 }
```

## IP Lookup vs Domain Lookup

| Aspect | IP Lookup | Domain Lookup |
|--------|-----------|---------------|
| Registry | RIRs (ARIN, RIPE, etc.) | Domain registries (Verisign, etc.) |
| Response type | IP network object | Domain object |
| Key data | Allocation, owner, range | Registration, expiry, nameservers |
| Use case | Network forensics, abuse | Domain management, due diligence |
| CIDR support | Yes | N/A |

## Tips for IP Lookups

1. **Cache results** — IP allocations don't change often; cache for at least 1 hour
2. **Handle CIDR blocks** — The response covers the entire block, not just the single IP
3. **Check parent handles** — Large allocations may have sub-allocations with different contacts
4. **Use IPv6** — More of the internet is IPv6; make sure your tooling supports it
5. **Rate limit** — RIRs enforce rate limits; respect `Retry-After` headers

```typescript
// Recommended client configuration for IP lookups
const client = new RDAPClient({
  cache: { ttl: 3600 },   // 1 hour cache
  timeout: 15000,          // 15s timeout (some RIRs are slow)
});
```

## Conclusion

IP address lookups with RDAP give you structured, authoritative data about network allocations and ownership. Whether you're investigating security incidents, reporting abuse, or analyzing network traffic, RDAP provides reliable answers in a consistent JSON format.

---
date: 2026-03-02

*Try IP lookups in our [Playground](/playground) or install RDAPify: `npm install rdapify`.*
