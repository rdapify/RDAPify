---
slug: rdap-for-cybersecurity-domain-investigation
title: "RDAP for Cybersecurity: How to Investigate Suspicious Domains"
authors: [rdapify]
tags: [security, cybersecurity, threat-intelligence, rdap]
description: "Learn how cybersecurity professionals use RDAP to investigate suspicious domains, identify malicious infrastructure, and gather threat intelligence — with real code examples."
keywords: [domain investigation, threat intelligence rdap, suspicious domain lookup, cybersecurity domain analysis, malicious domain detection, rdap security research]
image: /img/rdapify-social-card.png
---

When a suspicious domain appears in your logs, RDAP is your first tool for investigation. It gives you registration history, nameserver patterns, registrar data, and status flags — all in structured JSON. Here's how security professionals use it effectively.

<!-- truncate -->

## Why RDAP for Threat Investigation?

Traditional WHOIS gave you raw text — inconsistent, often outdated, and increasingly redacted. RDAP gives you:

- **Structured JSON** — Machine-parseable, no regex guessing
- **Standardized status codes** — Know exactly why a domain is locked or suspended
- **Event history** — When was it registered? Recently changed?
- **Nameserver data** — Is it using bulletproof hosting nameservers?
- **Registrar information** — Known abuse-friendly registrar?

## Red Flags to Look For

### 1. Recently Registered Domains

Malicious domains are often registered days or hours before an attack:

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

async function isRecentlyRegistered(domain: string, thresholdDays = 30) {
  const result = await client.domain(domain);

  const registered = result.events?.find(
    e => e.eventAction === 'registration'
  )?.eventDate;

  if (!registered) return null;

  const age = (Date.now() - new Date(registered).getTime()) / (1000 * 60 * 60 * 24);
  return {
    domain,
    registeredDate: registered,
    ageDays: Math.floor(age),
    suspicious: age < thresholdDays,
  };
}

const check = await isRecentlyRegistered('suspicious-domain.com');
if (check?.suspicious) {
  console.warn(`⚠️ Domain registered only ${check.ageDays} days ago!`);
}
```

### 2. Suspicious Nameservers

Many malware campaigns share infrastructure. Check if nameservers are associated with bulletproof hosting:

```typescript
async function checkNameservers(domain: string) {
  const result = await client.domain(domain);

  const nameservers = result.nameservers?.map(ns => ns.ldhName?.toLowerCase()) ?? [];

  // Known bulletproof/abuse-friendly NS patterns
  const suspiciousPatterns = [
    'njalla', 'flokinet', 'privacyprotect', 'whoisguard',
  ];

  const flagged = nameservers.filter(ns =>
    suspiciousPatterns.some(pattern => ns.includes(pattern))
  );

  return { domain, nameservers, flagged, suspicious: flagged.length > 0 };
}
```

### 3. Abnormal Status Combinations

Legitimate domains rarely have certain status combinations:

```typescript
async function analyzeStatus(domain: string) {
  const result = await client.domain(domain);
  const status = result.status ?? [];

  const redFlags = [];

  // Active but no transfer protection — easy to hijack
  if (status.includes('active') && !status.includes('client transfer prohibited')) {
    redFlags.push('No transfer lock — easy to hijack');
  }

  // Pending delete — domain may be in "drop catch" window
  if (status.some(s => s.includes('pending delete'))) {
    redFlags.push('Pending deletion — possible domain squatting');
  }

  // Hold status — registrar or registry suspended it
  if (status.some(s => s.includes('hold'))) {
    redFlags.push('Domain on hold — may have been reported for abuse');
  }

  return { domain, status, redFlags };
}
```

### 4. Rapid Re-registration

Was this domain previously owned by someone else?

```typescript
async function checkTransferHistory(domain: string) {
  const result = await client.domain(domain);

  const created = result.events?.find(e => e.eventAction === 'registration')?.eventDate;
  const transferred = result.events?.find(e => e.eventAction === 'transfer')?.eventDate;
  const lastChanged = result.events?.find(e => e.eventAction === 'last changed')?.eventDate;

  return {
    domain,
    created,
    transferred,
    lastChanged,
    hasTransferHistory: !!transferred,
  };
}
```

## Building a Domain Risk Scorer

```typescript
interface RiskScore {
  domain: string;
  score: number;       // 0-100
  level: 'low' | 'medium' | 'high' | 'critical';
  flags: string[];
}

async function scoreDomainRisk(domain: string): Promise<RiskScore> {
  const client = new RDAPClient({ cache: { ttl: 300 } });
  const result = await client.domain(domain);
  const flags: string[] = [];
  let score = 0;

  // Age check (max 40 points)
  const created = result.events?.find(e => e.eventAction === 'registration')?.eventDate;
  if (created) {
    const ageDays = (Date.now() - new Date(created).getTime()) / 86400000;
    if (ageDays < 1)   { score += 40; flags.push('Registered today'); }
    else if (ageDays < 7)  { score += 30; flags.push('Registered this week'); }
    else if (ageDays < 30) { score += 20; flags.push('Registered this month'); }
    else if (ageDays < 90) { score += 10; flags.push('Registered < 90 days ago'); }
  }

  // No transfer lock (15 points)
  if (!result.status?.includes('client transfer prohibited')) {
    score += 15;
    flags.push('No transfer lock');
  }

  // Hold status (25 points)
  if (result.status?.some(s => s.includes('hold'))) {
    score += 25;
    flags.push('Domain on hold');
  }

  // Recent change (10 points)
  const changed = result.events?.find(e => e.eventAction === 'last changed')?.eventDate;
  if (changed) {
    const changedDays = (Date.now() - new Date(changed).getTime()) / 86400000;
    if (changedDays < 7) { score += 10; flags.push('Modified recently'); }
  }

  const level =
    score >= 70 ? 'critical' :
    score >= 40 ? 'high' :
    score >= 20 ? 'medium' : 'low';

  return { domain, score, level, flags };
}

// Usage
const risk = await scoreDomainRisk('unknown-domain.xyz');
console.log(`Risk: ${risk.level.toUpperCase()} (${risk.score}/100)`);
console.log('Flags:', risk.flags);
```

## Pivoting: From Domain to Infrastructure

Once you have one domain, RDAP helps you pivot to related infrastructure:

```typescript
async function pivotFromDomain(domain: string) {
  const client = new RDAPClient();
  const result = await client.domain(domain);

  // Get nameservers — often shared across malicious domains
  const nameservers = result.nameservers?.map(ns => ns.ldhName) ?? [];

  // Get registrar — useful for abuse reporting
  const registrar = result.entities?.find(e => e.roles?.includes('registrar'));
  const registrarName = registrar?.vcardArray?.[1]?.find(
    (f: string[]) => f[0] === 'fn'
  )?.[3];

  // Get registrant handle — may reveal other domains
  const registrant = result.entities?.find(e => e.roles?.includes('registrant'));

  return {
    domain,
    nameservers,
    registrar: registrarName,
    registrantHandle: registrant?.handle,
    // Use these to search for related domains
  };
}
```

## Batch Investigation

```typescript
async function investigateBatch(domains: string[]) {
  const client = new RDAPClient({ cache: { ttl: 300 } });

  const results = await Promise.allSettled(
    domains.map(d => scoreDomainRisk(d))
  );

  const scores = results
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<RiskScore>).value)
    .sort((a, b) => b.score - a.score);

  const critical = scores.filter(s => s.level === 'critical');
  const high = scores.filter(s => s.level === 'high');

  console.log(`Investigated: ${scores.length} domains`);
  console.log(`Critical: ${critical.length} | High: ${high.length}`);

  return scores;
}
```

## Conclusion

RDAP transforms domain investigation from manual text parsing into structured, automated analysis. Combined with other threat intelligence sources, it gives security teams a fast, reliable way to triage suspicious domains.

---

*Questions about using RDAPify for security research? Join our [GitHub Discussions](https://github.com/rdapify/rdapify/discussions).*
