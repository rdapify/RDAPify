---
date: 2026-02-10
slug: check-domain-nameservers-rdap
title: "How to Check Domain Nameservers with RDAP"
authors: [rdapify]
tags: [rdap, nameservers, dns, tutorial]
description: "A practical guide to querying domain nameserver information using RDAP. Learn to check NS records, detect nameserver changes, monitor for DNS hijacking, and query nameservers directly."
keywords: [check domain nameservers, rdap nameserver lookup, domain ns records, nameserver change detection, dns hijacking detection, rdap nameserver query]
image: /img/rdapify-social-card.png
---
date: 2026-02-10

Nameserver data is one of the most security-relevant pieces of domain registration information. Unexpected nameserver changes can indicate domain hijacking, account compromise, or infrastructure takeovers. Here's how to query and monitor nameserver data with RDAP.

<!-- truncate -->

## Nameservers in RDAP

When you query a domain with RDAP, nameservers appear in the `nameservers` array:

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();
const domain = await client.domain('google.com');

console.log(domain.nameservers);
// [
//   { objectClassName: 'nameserver', ldhName: 'ns1.google.com' },
//   { objectClassName: 'nameserver', ldhName: 'ns2.google.com' },
//   { objectClassName: 'nameserver', ldhName: 'ns3.google.com' },
//   { objectClassName: 'nameserver', ldhName: 'ns4.google.com' }
// ]
```

## Extracting Nameserver Names

```typescript
async function getNameservers(domain: string): Promise<string[]> {
  const client = new RDAPClient({ cache: { ttl: 3600 } });
  const result = await client.domain(domain);
  return result.nameservers?.map(ns => ns.ldhName ?? '') ?? [];
}

const ns = await getNameservers('cloudflare.com');
console.log(ns);
// ['ns3.cloudflare.com', 'ns4.cloudflare.com', 'ns5.cloudflare.com', ...]
```

## Querying a Nameserver Directly

RDAP also supports direct nameserver lookups — get IP addresses for a specific nameserver:

```typescript
const ns = await client.nameserver('ns1.google.com');

console.log(ns.ldhName);      // "ns1.google.com"
console.log(ns.ipAddresses);
// {
//   v4: ["216.239.32.10"],
//   v6: ["2001:4860:4802:32::a"]
// }
```

## Detecting Nameserver Changes

Unexpected nameserver changes are a red flag for domain hijacking:

```typescript
interface NSSnapshot {
  domain: string;
  nameservers: string[];
  capturedAt: string;
}

// Store a snapshot
async function captureNSSnapshot(domain: string): Promise<NSSnapshot> {
  const ns = await getNameservers(domain);
  return {
    domain,
    nameservers: ns.sort(), // Sort for consistent comparison
    capturedAt: new Date().toISOString(),
  };
}

// Compare against stored snapshot
async function detectNSChange(
  domain: string,
  previous: NSSnapshot
): Promise<{ changed: boolean; added: string[]; removed: string[] }> {
  const current = await captureNSSnapshot(domain);

  const currentSet = new Set(current.nameservers);
  const previousSet = new Set(previous.nameservers);

  const added = current.nameservers.filter(ns => !previousSet.has(ns));
  const removed = previous.nameservers.filter(ns => !currentSet.has(ns));
  const changed = added.length > 0 || removed.length > 0;

  if (changed) {
    console.warn(`⚠️ Nameserver change detected for ${domain}!`);
    if (added.length) console.warn(`  Added: ${added.join(', ')}`);
    if (removed.length) console.warn(`  Removed: ${removed.join(', ')}`);
  }

  return { changed, added, removed };
}
```

## Nameserver Pattern Analysis

Identify nameserver providers and detect unusual patterns:

```typescript
const NS_PROVIDERS: Record<string, string> = {
  'cloudflare.com': 'Cloudflare',
  'google.com': 'Google Cloud DNS',
  'awsdns': 'Amazon Route 53',
  'azure-dns': 'Azure DNS',
  'ns.cloudflare.com': 'Cloudflare',
  'domaincontrol.com': 'GoDaddy',
  'registrar-servers.com': 'Namecheap',
  'parkingcrew.net': 'Parked Domain',
  'sedoparking.com': 'Parked/For Sale',
  'hugedomains.com': 'For Sale',
};

function identifyNSProvider(nameservers: string[]): string {
  for (const ns of nameservers) {
    for (const [pattern, provider] of Object.entries(NS_PROVIDERS)) {
      if (ns.toLowerCase().includes(pattern.toLowerCase())) {
        return provider;
      }
    }
  }
  return 'Unknown Provider';
}

// Detect parked or for-sale domains
function isParked(nameservers: string[]): boolean {
  const parkedPatterns = [
    'parkingcrew', 'sedo', 'hugedomains', 'bodis',
    'above.com', 'parking', 'cashparking',
  ];
  return nameservers.some(ns =>
    parkedPatterns.some(p => ns.toLowerCase().includes(p))
  );
}
```

## Batch Nameserver Audit

Audit nameservers across all your domains:

```typescript
async function auditNameservers(domains: string[]) {
  const client = new RDAPClient({ cache: { ttl: 3600 } });
  const results = [];

  for (const domain of domains) {
    try {
      const result = await client.domain(domain);
      const nameservers = result.nameservers?.map(ns => ns.ldhName ?? '') ?? [];
      const provider = identifyNSProvider(nameservers);
      const parked = isParked(nameservers);

      results.push({
        domain,
        nameservers,
        provider,
        parked,
        count: nameservers.length,
      });
    } catch {
      results.push({ domain, nameservers: [], provider: 'Error', parked: false, count: 0 });
    }

    await new Promise(r => setTimeout(r, 200)); // Be respectful
  }

  // Group by provider
  const byProvider = new Map<string, string[]>();
  for (const r of results) {
    const list = byProvider.get(r.provider) ?? [];
    list.push(r.domain);
    byProvider.set(r.provider, list);
  }

  return { results, byProvider: Object.fromEntries(byProvider) };
}
```

## Security Monitoring: NS Hijacking Watchlist

```typescript
// Run daily — alert on any change
async function monitorNSHijacking(
  domains: string[],
  storedSnapshots: Map<string, NSSnapshot>,
  alertWebhook: string
) {
  const client = new RDAPClient();
  const alerts = [];

  for (const domain of domains) {
    const previous = storedSnapshots.get(domain);
    if (!previous) {
      // First run — just capture snapshot
      const snapshot = await captureNSSnapshot(domain);
      storedSnapshots.set(domain, snapshot);
      continue;
    }

    const change = await detectNSChange(domain, previous);
    if (change.changed) {
      alerts.push({ domain, ...change });
      // Update snapshot
      storedSnapshots.set(domain, await captureNSSnapshot(domain));
    }
  }

  if (alerts.length > 0) {
    await fetch(alertWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alert: 'Nameserver changes detected',
        timestamp: new Date().toISOString(),
        changes: alerts,
      }),
    });
  }

  return alerts;
}
```

## Conclusion

RDAP makes nameserver data structured and easy to work with. Whether you're auditing your own domains, monitoring for hijacking, or building DNS intelligence tools, the combination of domain queries and direct nameserver lookups gives you everything you need.

---
date: 2026-02-10

*Try nameserver lookups in our [Playground](/playground) or install RDAPify: `npm install rdapify`.*
