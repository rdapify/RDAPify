---
slug: rdap-bootstrap-explained-service-discovery
title: "RDAP Bootstrap Explained: How Automatic Service Discovery Works"
authors: [rdapify]
tags: [rdap, bootstrap, iana, protocol, deep-dive]
description: "A deep dive into RDAP's bootstrap mechanism — how clients automatically discover the right RDAP server for any domain, IP, or ASN without hardcoded server lists."
keywords: [rdap bootstrap, rdap service discovery, iana bootstrap, rdap server discovery, how rdap works, rdap iana files]
image: /img/rdapify-social-card.png
---

One of RDAP's most elegant features is automatic service discovery via bootstrap. You query `example.com` and your client automatically knows to contact Verisign's RDAP server — no hardcoded lists needed. Here's how it works under the hood.

<!-- truncate -->

## The Problem Bootstrap Solves

With WHOIS, you needed to maintain a server list:

```javascript
// Old WHOIS approach — hardcoded, fragile, always out of date
const WHOIS_SERVERS = {
  'com': 'whois.verisign-grs.com',
  'net': 'whois.verisign-grs.com',
  'org': 'whois.pir.org',
  'uk':  'whois.nic.uk',
  'io':  'whois.nic.io',
  // ... hundreds more, constantly changing
};
```

New TLDs? You'd find out when your code broke. RDAP solves this with a centralized, machine-readable bootstrap system maintained by IANA.

## IANA Bootstrap Files

IANA publishes three JSON files that cover all internet registration data:

| Resource | URL | Coverage |
|----------|-----|----------|
| Domains | `https://data.iana.org/rdap/dns.json` | All TLDs |
| IPv4 | `https://data.iana.org/rdap/ipv4.json` | All IPv4 space |
| IPv6 | `https://data.iana.org/rdap/ipv6.json` | All IPv6 space |
| ASNs | `https://data.iana.org/rdap/asn.json` | All ASN ranges |

### Structure of a Bootstrap File

```json
{
  "version": "1.0",
  "publication": "2024-08-01T00:00:00Z",
  "description": "RDAP bootstrap file for domain name spaces",
  "services": [
    [
      ["com", "net"],
      ["https://rdap.verisign.com/com/v1/", "https://rdap.verisign.com/net/v1/"]
    ],
    [
      ["org"],
      ["https://rdap.publicinterestregistry.org/rdap/"]
    ],
    [
      ["uk"],
      ["https://rdap.nominet.uk/uk/"]
    ]
  ]
}
```

Each entry is a pair: **[list of TLDs/ranges] + [list of RDAP server URLs]**.

## How Bootstrap Works Step by Step

### Domain Lookup: `example.co.uk`

```
1. Extract TLD: "co.uk"
2. Load dns.json from IANA
3. Search services for "co.uk" → found: ["https://rdap.nominet.uk/uk/"]
4. If not found, try "uk" → found: same
5. Build URL: https://rdap.nominet.uk/uk/domain/example.co.uk
6. Make HTTPS request → get JSON response
```

### IP Lookup: `8.8.8.8`

```
1. Load ipv4.json from IANA
2. Convert 8.8.8.8 to number: 134744072
3. Find matching range: 8.0.0.0/8 → ARIN
4. Server: https://rdap.arin.net/registry/
5. URL: https://rdap.arin.net/registry/ip/8.8.8.8
```

### ASN Lookup: `AS15169`

```
1. Load asn.json from IANA
2. Find range containing 15169: 14593-15371 → ARIN
3. Server: https://rdap.arin.net/registry/
4. URL: https://rdap.arin.net/registry/autnum/15169
```

## Multi-Level TLD Matching

Bootstrap uses longest-match first:

```
Query: example.co.uk

Try "co.uk" → found? Use it.
Try "uk"    → found? Use it.
Try ""      → fallback (root)
```

This matters for ccTLDs with second-level registries like `.co.uk`, `.com.au`, `.co.jp`.

## Bootstrap Caching

Fetching IANA bootstrap files on every query would be slow and wasteful. Smart clients cache them:

```typescript
import { RDAPClient } from 'rdapify';

// RDAPify caches bootstrap files automatically
// Default TTL: 24 hours (bootstrap files change rarely)
const client = new RDAPClient({
  cache: {
    ttl: 86400, // 24 hours
  },
});

// First query: fetches bootstrap + RDAP data
await client.domain('example.com');   // ~400ms

// Second query (same TLD): bootstrap cached
await client.domain('google.com');    // ~200ms

// Completely different TLD: bootstrap cached, new RDAP server
await client.domain('example.de');    // ~250ms
```

## Fallback Servers

When a TLD isn't found in bootstrap (rare but possible), clients can fall back to IANA's own RDAP server:

```
https://rdap.iana.org/domain/example.tld
```

IANA's server handles root zone data and can redirect to the authoritative server.

## What RDAPify Does Internally

RDAPify's bootstrap implementation:

```
1. Check local cache for bootstrap data
2. If cache miss or expired: fetch from data.iana.org
3. Parse services array
4. Match query against services (longest match wins)
5. Select RDAP server URL (prefer HTTPS)
6. Construct RESTful URL
7. Make request with proper Accept header
8. Return parsed response
```

All of this happens transparently:

```typescript
const client = new RDAPClient();

// You just call this — bootstrap is handled automatically
const domain = await client.domain('example.xyz');
// Internally: fetched dns.json, found XYZ Registry, queried their RDAP server
```

## Edge Cases

### Multiple Servers in Bootstrap

Some TLDs have multiple RDAP servers (primary + fallback):

```json
[
  ["com", "net"],
  [
    "https://rdap.verisign.com/com/v1/",
    "https://rdap-backup.verisign.com/com/v1/"
  ]
]
```

Clients typically try the first server and fall back to subsequent ones on failure.

### Bootstrap File Updates

IANA updates bootstrap files when:
- New TLDs are delegated
- Registries change their RDAP server URLs
- RIRs update their endpoints

The `publication` date in each file tells you when it was last updated. Clients should refresh periodically (RDAPify does this automatically).

## Conclusion

RDAP bootstrap is an elegant solution to the server discovery problem. Instead of maintaining fragile hardcoded lists, clients trust a centralized, machine-readable source maintained by IANA. It's one of the reasons RDAP scales gracefully to 1,500+ TLDs and all of internet IP space.

---

*Curious about RDAPify's internals? Check out the [source on GitHub](https://github.com/rdapify/rdapify).*
