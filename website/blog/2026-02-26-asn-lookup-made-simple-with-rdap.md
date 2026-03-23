---
date: 2026-02-26
slug: asn-lookup-made-simple-with-rdap
title: "ASN Lookup Made Simple: Query Autonomous System Numbers with RDAP"
authors: [rdapify]
tags: [rdap, asn, networking, bgp, tutorial]
description: "Learn how to look up Autonomous System Numbers (ASNs) using RDAP. Understand ASN allocations, identify network operators, and build ASN intelligence tools with practical code examples."
keywords: [asn lookup, autonomous system number, asn whois, bgp asn lookup, who owns asn, asn information api, asn query tool]
image: /img/rdapify-social-card.png
---
date: 2026-02-26

Every major network on the internet is identified by an Autonomous System Number (ASN). Whether you're analyzing BGP routes, investigating network ownership, or building infrastructure intelligence tools, ASN lookups are a fundamental capability. Here's how to do it with RDAP.

<!-- truncate -->

## What is an ASN?

An **Autonomous System Number (ASN)** is a unique identifier assigned to a network or group of networks under a single administrative control. Every organization that manages its own routing policy on the internet has an ASN.

Some well-known ASNs:

| ASN | Organization | Description |
|-----|-------------|-------------|
| AS15169 | Google | Google's primary ASN |
| AS13335 | Cloudflare | Cloudflare's global network |
| AS16509 | Amazon | AWS infrastructure |
| AS32934 | Meta (Facebook) | Meta's network |
| AS8075 | Microsoft | Microsoft's global network |
| AS714 | Apple | Apple's network |

ASNs are either **2-byte** (0–65535) or **4-byte** (0–4294967295, introduced to handle exhaustion of the 2-byte space).

## Querying ASNs with RDAP

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

// Look up Google's ASN
const asn = await client.asn(15169);

console.log(asn.handle);  // "AS15169"
console.log(asn.name);    // "GOOGLE"
console.log(asn.type);    // "DIRECT ALLOCATION"
console.log(asn.status);  // ["active"]
```

### Full ASN Response

```typescript
const asn = await client.asn(13335); // Cloudflare

// Registration events
for (const event of asn.events ?? []) {
  console.log(`${event.eventAction}: ${event.eventDate}`);
}
// registration: 2010-07-14T00:00:00Z
// last changed: 2024-01-10T15:20:00Z

// Contact entities
for (const entity of asn.entities ?? []) {
  console.log(`Role: ${entity.roles?.join(', ')}`);
  console.log(`Handle: ${entity.handle}`);
}

// Links to related resources
for (const link of asn.links ?? []) {
  console.log(`${link.rel}: ${link.href}`);
}
```

## Understanding ASN Allocation

ASN space is managed hierarchically:

```
IANA (global)
  ├── ARIN    (AS1-AS65535 partial, various 4-byte blocks)
  ├── RIPE    (AS1-AS65535 partial, various 4-byte blocks)
  ├── APNIC   (various ranges)
  ├── AFRINIC (various ranges)
  └── LACNIC  (various ranges)
```

The RDAP bootstrap automatically routes your query to the correct RIR.

### ASN Ranges by RIR

```typescript
const client = new RDAPClient();

// These automatically go to the correct RIR
await client.asn(15169);  // → ARIN (Google, US)
await client.asn(13335);  // → ARIN (Cloudflare, US)
await client.asn(3356);   // → ARIN (Lumen/CenturyLink)
await client.asn(6805);   // → RIPE (Telefonica Germany)
await client.asn(4766);   // → APNIC (Korea Telecom)
await client.asn(37100);  // → AFRINIC (SEACOM, Africa)
await client.asn(28001);  // → LACNIC (TeleCentro, Argentina)
```

## Practical Use Cases

### Use Case 1: Network Operator Identification

```typescript
async function identifyOperator(asnNumber: number) {
  const client = new RDAPClient({ cache: { ttl: 86400 } });
  const asn = await client.asn(asnNumber);

  const registrant = asn.entities?.find(
    e => e.roles?.includes('registrant')
  );

  return {
    asn: asn.handle,
    name: asn.name,
    type: asn.type,
    registered: asn.events?.find(
      e => e.eventAction === 'registration'
    )?.eventDate,
    registrant: registrant?.handle,
  };
}

const operator = await identifyOperator(15169);
// { asn: "AS15169", name: "GOOGLE", type: "DIRECT ALLOCATION", ... }
```

### Use Case 2: Batch ASN Intelligence

```typescript
async function buildASNReport(asns: number[]) {
  const client = new RDAPClient({ cache: { ttl: 86400 } });

  const results = await Promise.all(
    asns.map(async (num) => {
      try {
        const data = await client.asn(num);
        return {
          asn: num,
          name: data.name ?? 'Unknown',
          handle: data.handle,
          status: data.status?.[0] ?? 'unknown',
          type: data.type ?? 'unknown',
        };
      } catch {
        return {
          asn: num,
          name: 'Error',
          handle: `AS${num}`,
          status: 'error',
          type: 'unknown',
        };
      }
    })
  );

  return results;
}

const report = await buildASNReport([
  15169, 13335, 16509, 32934, 8075
]);

console.table(report);
// ┌─────────┬───────┬──────────────┬───────────┬────────┬──────────────────┐
// │ (index) │  asn  │     name     │  handle   │ status │      type        │
// ├─────────┼───────┼──────────────┼───────────┼────────┼──────────────────┤
// │    0    │ 15169 │   "GOOGLE"   │ "AS15169" │ active │ DIRECT ALLOCATION│
// │    1    │ 13335 │ "CLOUDFLARENET"│"AS13335"│ active │ DIRECT ALLOCATION│
// │    2    │ 16509 │  "AMAZON-02" │ "AS16509" │ active │ DIRECT ALLOCATION│
// │    3    │ 32934 │ "FACEBOOK"   │ "AS32934" │ active │ DIRECT ALLOCATION│
// │    4    │  8075 │ "MICROSOFT"  │ "AS8075"  │ active │ DIRECT ALLOCATION│
// └─────────┴───────┴──────────────┴───────────┴────────┴──────────────────┘
```

### Use Case 3: ASN to Organization Mapping

```typescript
async function mapASNtoOrg(asnNumber: number) {
  const client = new RDAPClient();
  const asn = await client.asn(asnNumber);

  // Extract organization info from entities
  const orgEntity = asn.entities?.find(
    e => e.roles?.includes('registrant') || e.roles?.includes('administrative')
  );

  let orgName = asn.name;

  if (orgEntity?.vcardArray) {
    const vcard = orgEntity.vcardArray[1];
    const fn = vcard.find((f: string[]) => f[0] === 'fn');
    if (fn) orgName = fn[3] as string;
  }

  return {
    asn: `AS${asnNumber}`,
    organization: orgName,
    registeredTo: orgEntity?.handle,
  };
}
```

## ASN Lookup vs IP Lookup

Sometimes you have an IP and want to find its ASN, or vice versa. Here's how they relate:

```
IP Address → IP RDAP Lookup → Network Block → Organization
ASN        → ASN RDAP Lookup → Operator Info → Contact Details
```

An organization can have:
- Multiple ASNs (Google has several)
- Multiple IP blocks per ASN
- IP blocks registered separately from ASNs

```typescript
// Start from an IP, then investigate the ASN
const ip = await client.ip('8.8.8.8');
console.log(ip.name); // "GOGL" — this is Google

// Now look up Google's ASN for more details
const asn = await client.asn(15169);
console.log(asn.name); // "GOOGLE"
```

## Tips for ASN Lookups

1. **Cache aggressively** — ASN allocations rarely change; cache for 24 hours
2. **Handle 4-byte ASNs** — Modern allocations use 4-byte ASNs (> 65535)
3. **Check status** — Not all ASNs are active; check the `status` field
4. **Follow entities** — Use entity handles to look up full contact details
5. **Rate limit** — Batch your queries and respect RIR rate limits

## Conclusion

ASN lookups with RDAP give you structured, authoritative data about network operators. Combined with IP lookups, you can build comprehensive network intelligence tools that map infrastructure to organizations.

---
date: 2026-02-26

*Try ASN lookups in our [Playground](/playground) or install RDAPify: `npm install rdapify`.*
