---
slug: whois-to-rdap-enterprise-migration-guide
title: "From WHOIS to RDAP: A Migration Guide for Enterprise Applications"
authors: [rdapify]
tags: [migration, enterprise, rdap, whois, guide]
description: "A practical migration guide for enterprise teams moving from WHOIS to RDAP. Covers field mapping, phased rollout, backward compatibility, testing strategies, and common pitfalls."
keywords: [whois to rdap migration, enterprise rdap, rdap migration guide, replace whois with rdap, rdap enterprise integration, domain lookup migration]
image: /img/rdapify-social-card.png
---

Your enterprise has been using WHOIS for years. Now ICANN is deprecating it, registries are shutting down WHOIS endpoints, and your parsing code breaks every other week. It's time to migrate to RDAP. This guide gives you a structured, low-risk migration path.

<!-- truncate -->

## Why Migrate Now?

Three forces are converging:

1. **ICANN mandate** — RDAP is the required protocol for gTLD registration data
2. **Registry deprecation** — Major registries are reducing WHOIS support
3. **Maintenance burden** — WHOIS parsing code is fragile and expensive to maintain

Delaying migration means accumulating technical debt and risking service disruptions when WHOIS endpoints go offline.

## Migration Strategy: Phased Approach

Don't rip and replace. A phased migration minimizes risk:

```
Phase 1: Shadow Mode     (2-4 weeks)  → RDAP in parallel, compare results
Phase 2: RDAP Primary    (2-4 weeks)  → RDAP as primary, WHOIS as fallback
Phase 3: WHOIS Removal   (1-2 weeks)  → Remove WHOIS code entirely
```

### Phase 1: Shadow Mode

Run RDAP queries alongside WHOIS and compare results. This validates your RDAP integration without affecting production:

```typescript
import { RDAPClient } from 'rdapify';

const rdapClient = new RDAPClient({
  cache: { ttl: 3600 },
});

async function lookupDomainShadow(domain: string) {
  // Existing WHOIS lookup (your current code)
  const whoisResult = await existingWhoisLookup(domain);

  // New RDAP lookup (shadow)
  try {
    const rdapResult = await rdapClient.domain(domain);

    // Compare key fields
    const comparison = {
      domain,
      whoisExpiry: whoisResult.expiryDate,
      rdapExpiry: rdapResult.events?.find(
        e => e.eventAction === 'expiration'
      )?.eventDate,
      match: whoisResult.expiryDate === rdapResult.events?.find(
        e => e.eventAction === 'expiration'
      )?.eventDate,
    };

    // Log comparison for analysis
    logger.info('rdap_shadow_comparison', comparison);
  } catch (error) {
    logger.warn('rdap_shadow_error', { domain, error: error.message });
  }

  // Return WHOIS result (production path unchanged)
  return whoisResult;
}
```

**Success criteria for Phase 1:**
- RDAP returns data for 95%+ of queries
- Key fields (expiry, status, nameservers) match WHOIS data
- RDAP latency is acceptable (< 2x WHOIS)
- No errors in edge cases

### Phase 2: RDAP Primary with WHOIS Fallback

Switch to RDAP as the primary source, falling back to WHOIS only when RDAP fails:

```typescript
async function lookupDomain(domain: string) {
  try {
    // Try RDAP first
    const rdapResult = await rdapClient.domain(domain);
    return normalizeRDAPResponse(rdapResult);
  } catch (rdapError) {
    // Fall back to WHOIS
    logger.warn('rdap_fallback_to_whois', {
      domain,
      error: rdapError.message,
    });

    const whoisResult = await existingWhoisLookup(domain);
    return normalizeWHOISResponse(whoisResult);
  }
}
```

**Success criteria for Phase 2:**
- WHOIS fallback rate < 5%
- No increase in error rates or latency
- Business logic works correctly with RDAP data

### Phase 3: Remove WHOIS

Once RDAP is proven reliable, remove WHOIS dependencies:

```typescript
// Final: RDAP only
async function lookupDomain(domain: string) {
  const result = await rdapClient.domain(domain);
  return normalizeRDAPResponse(result);
}

// Delete: whois-parser.ts, whois-client.ts, whois-server-list.json
// Remove: npm uninstall whois whois-parsed node-whois
```

## Field Mapping: WHOIS to RDAP

### Domain Fields

| WHOIS Field | RDAP Equivalent | Notes |
|------------|-----------------|-------|
| `Domain Name` | `ldhName` | Always lowercase in RDAP |
| `Registry Domain ID` | `handle` | Unique identifier |
| `Creation Date` | `events[eventAction=registration].eventDate` | ISO 8601 format |
| `Updated Date` | `events[eventAction=last changed].eventDate` | ISO 8601 format |
| `Expiry Date` | `events[eventAction=expiration].eventDate` | ISO 8601 format |
| `Domain Status` | `status[]` | Standardized codes |
| `Name Server` | `nameservers[].ldhName` | Array of objects |
| `DNSSEC` | `secureDNS.delegationSigned` | Boolean |
| `Registrar` | `entities[roles=registrar].vcardArray` | Entity object |
| `Registrant` | `entities[roles=registrant].vcardArray` | Often redacted |

### Helper Functions

```typescript
// Extract common fields from RDAP responses
function normalizeRDAPResponse(rdap: any) {
  return {
    domainName: rdap.ldhName,
    handle: rdap.handle,
    status: rdap.status ?? [],

    createdDate: rdap.events?.find(
      (e: any) => e.eventAction === 'registration'
    )?.eventDate ?? null,

    updatedDate: rdap.events?.find(
      (e: any) => e.eventAction === 'last changed'
    )?.eventDate ?? null,

    expiryDate: rdap.events?.find(
      (e: any) => e.eventAction === 'expiration'
    )?.eventDate ?? null,

    nameservers: rdap.nameservers?.map(
      (ns: any) => ns.ldhName
    ) ?? [],

    dnssec: rdap.secureDNS?.delegationSigned ?? false,

    registrar: rdap.entities?.find(
      (e: any) => e.roles?.includes('registrar')
    )?.vcardArray?.[1]?.find(
      (f: any) => f[0] === 'fn'
    )?.[3] ?? null,
  };
}
```

## Common Migration Pitfalls

### Pitfall 1: Hardcoded Field Names

WHOIS parsers often use regex with hardcoded field names. RDAP uses a consistent structure, but the field names are different:

```typescript
// BAD: Looking for WHOIS-style field names in RDAP
const expiry = response['Registry Expiry Date']; // Won't work

// GOOD: Use RDAP's structured events
const expiry = response.events?.find(
  e => e.eventAction === 'expiration'
)?.eventDate;
```

### Pitfall 2: Assuming All TLDs Support RDAP

Most gTLDs support RDAP, but some ccTLDs may not yet. Handle this gracefully:

```typescript
async function lookupWithFallback(domain: string) {
  try {
    return await rdapClient.domain(domain);
  } catch (error) {
    if (error.code === 'NO_RDAP_SERVER') {
      // This TLD doesn't have RDAP yet
      logger.info(`No RDAP for ${domain}, using fallback`);
      return null;
    }
    throw error;
  }
}
```

### Pitfall 3: Date Format Differences

WHOIS dates are inconsistent. RDAP always uses ISO 8601:

```typescript
// WHOIS: "14-Aug-2024" or "2024/08/14" or "August 14, 2024"
// RDAP: "2024-08-14T00:00:00Z" (always)

// No more date parsing gymnastics
const expiryDate = new Date(rdapEvent.eventDate); // Just works
```

### Pitfall 4: Contact Data Availability

GDPR means many RDAP responses redact contact data. Don't assume contacts are always available:

```typescript
const registrant = domain.entities?.find(
  e => e.roles?.includes('registrant')
);

if (!registrant?.vcardArray) {
  // Contact data is redacted — this is normal, not an error
  console.log('Contact data redacted (GDPR)');
}
```

### Pitfall 5: Rate Limiting Differences

RDAP servers use standard HTTP rate limiting, which behaves differently from WHOIS:

```typescript
const client = new RDAPClient({
  // RDAPify handles rate limiting automatically
  // Respects Retry-After headers
  timeout: 15000,
  cache: { ttl: 3600 }, // Reduce requests with caching
});
```

## Testing Your Migration

### Unit Tests

```typescript
describe('RDAP Migration', () => {
  it('should extract expiry date correctly', () => {
    const rdapResponse = {
      events: [
        {
          eventAction: 'expiration',
          eventDate: '2025-08-13T04:00:00Z',
        },
      ],
    };

    const normalized = normalizeRDAPResponse(rdapResponse);
    expect(normalized.expiryDate).toBe('2025-08-13T04:00:00Z');
  });

  it('should handle missing events gracefully', () => {
    const rdapResponse = { events: [] };
    const normalized = normalizeRDAPResponse(rdapResponse);
    expect(normalized.expiryDate).toBeNull();
  });

  it('should handle redacted contacts', () => {
    const rdapResponse = {
      entities: [
        {
          roles: ['registrant'],
          remarks: [{ title: 'REDACTED FOR PRIVACY' }],
        },
      ],
    };
    const normalized = normalizeRDAPResponse(rdapResponse);
    expect(normalized.registrar).toBeNull();
  });
});
```

### Integration Tests

```typescript
describe('RDAP Integration', () => {
  it('should query real RDAP servers', async () => {
    const client = new RDAPClient();
    const result = await client.domain('google.com');

    expect(result.ldhName).toBe('google.com');
    expect(result.status).toContain('client delete prohibited');
    expect(result.nameservers?.length).toBeGreaterThan(0);
  });
});
```

## Migration Checklist

- [ ] **Audit** — Inventory all WHOIS usage in your codebase
- [ ] **Install** — `npm install rdapify`
- [ ] **Map fields** — Create a field mapping document
- [ ] **Build normalizer** — Write a function that converts RDAP to your internal format
- [ ] **Shadow mode** — Run RDAP in parallel for 2-4 weeks
- [ ] **Compare** — Validate RDAP results match WHOIS data
- [ ] **Switch** — Make RDAP primary with WHOIS fallback
- [ ] **Monitor** — Track fallback rate and error rates
- [ ] **Remove** — Delete WHOIS code and dependencies
- [ ] **Document** — Update internal docs and runbooks

## Conclusion

Migrating from WHOIS to RDAP is an investment that pays off immediately: structured data, fewer parsing bugs, better security, and future-proofing against WHOIS deprecation. The phased approach minimizes risk, and RDAPify handles the protocol complexity for you.

Start with shadow mode today. Your future self will thank you.

---

*Questions about enterprise migration? Join our [GitHub Discussions](https://github.com/rdapify/rdapify/discussions) or check out the [API Reference](/docs/api-reference/client).*
