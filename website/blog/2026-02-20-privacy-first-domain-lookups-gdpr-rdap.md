---
slug: privacy-first-domain-lookups-gdpr-rdap
title: "Privacy-First Domain Lookups: GDPR-Compliant RDAP Queries"
authors: [rdapify]
tags: [privacy, gdpr, rdap, compliance, pii-redaction]
description: "How to perform domain lookups while respecting GDPR and privacy regulations. Learn about PII redaction, data minimization, and building compliant registration data tools with RDAP."
keywords: [gdpr domain lookup, privacy rdap, pii redaction domain, gdpr whois, domain data privacy, compliant domain lookup, data protection rdap]
image: /img/rdapify-social-card.png
---

Since GDPR took effect in 2018, domain registration data has been a compliance minefield. WHOIS exposed personal data freely. RDAP was designed with privacy in mind — but you still need to handle responses carefully. This guide shows you how to build privacy-compliant domain lookup tools.

<!-- truncate -->

## The Privacy Problem with Domain Data

Domain registration records often contain Personally Identifiable Information (PII):

- **Registrant name** — The person or organization that registered the domain
- **Email addresses** — Contact emails for registrant, admin, and tech roles
- **Phone numbers** — Contact phone numbers
- **Physical addresses** — Street address, city, country of the registrant
- **Organization name** — Can identify individuals in small companies

Under GDPR (and similar regulations like CCPA, LGPD, PIPEDA), collecting, storing, or processing this data without proper legal basis is a violation.

## How RDAP Handles Privacy

RDAP was designed after GDPR. It includes privacy features that WHOIS never had:

### 1. Differentiated Access

RDAP servers can return different data based on the requester:

```
Anonymous user:
  → Redacted contact data
  → Basic domain info only

Authenticated registrar:
  → Full contact details
  → Administrative access

Law enforcement (with proper authorization):
  → Unredacted data
  → Full audit trail
```

### 2. Redaction Notices

When data is redacted, RDAP servers include explicit notices:

```json
{
  "entities": [
    {
      "roles": ["registrant"],
      "remarks": [
        {
          "title": "REDACTED FOR PRIVACY",
          "description": [
            "Personal data redacted per GDPR."
          ]
        }
      ]
    }
  ]
}
```

### 3. Purpose Limitation

RDAP responses include notices about permitted use:

```json
{
  "notices": [
    {
      "title": "Terms of Use",
      "description": [
        "This data may not be used for marketing purposes.",
        "Mass collection of registration data is prohibited."
      ]
    }
  ]
}
```

## PII Redaction with RDAPify

RDAPify includes a built-in PII redactor that strips personal data from RDAP responses before they reach your application:

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  ppiRedaction: true, // Enable PII redaction
});

const domain = await client.domain('example.com');

// Contact entities are automatically redacted
// Email addresses → [REDACTED]
// Phone numbers → [REDACTED]
// Personal names → [REDACTED]
// Street addresses → [REDACTED]
```

### What Gets Redacted

| Field | Before Redaction | After Redaction |
|-------|-----------------|-----------------|
| Email | john@example.com | [REDACTED] |
| Phone | +1-555-0123 | [REDACTED] |
| Name | John Smith | [REDACTED] |
| Address | 123 Main St, City | [REDACTED] |
| Organization | Kept (not personal) | Kept |
| Domain name | Kept (public) | Kept |
| Nameservers | Kept (technical) | Kept |
| Status | Kept (public) | Kept |
| Events | Kept (dates) | Kept |

### Selective Redaction

You may have legitimate reasons to access some PII fields. RDAPify lets you configure what to redact:

```typescript
const client = new RDAPClient({
  ppiRedaction: {
    redactEmails: true,
    redactPhones: true,
    redactNames: true,
    redactAddresses: true,
  },
});
```

## Building GDPR-Compliant Domain Tools

### Principle 1: Data Minimization

Only query what you need. Don't fetch full RDAP responses if you only need the expiry date:

```typescript
async function getExpiryOnly(domain: string) {
  const client = new RDAPClient({ ppiRedaction: true });
  const result = await client.domain(domain);

  // Only extract what you need
  return {
    domain: result.ldhName,
    expires: result.events?.find(
      e => e.eventAction === 'expiration'
    )?.eventDate,
  };
  // All PII is redacted, and you only return the expiry date
}
```

### Principle 2: Purpose Limitation

Document why you need the data and don't use it for other purposes:

```typescript
// Good: Security investigation with documented purpose
async function investigateDomain(domain: string, incidentId: string) {
  const client = new RDAPClient();
  const result = await client.domain(domain);

  // Log the purpose
  console.log(`RDAP query for incident ${incidentId}: ${domain}`);

  return {
    domain: result.ldhName,
    status: result.status,
    nameservers: result.nameservers?.map(ns => ns.ldhName),
    registrationDate: result.events?.find(
      e => e.eventAction === 'registration'
    )?.eventDate,
    // No contact PII needed for status investigation
  };
}
```

### Principle 3: Storage Limitation

Don't store RDAP responses longer than necessary:

```typescript
const client = new RDAPClient({
  cache: {
    ttl: 3600,  // Cache for 1 hour, then discard
  },
});

// Cached responses are automatically expired
// No long-term PII storage
```

### Principle 4: Audit Trail

Log what data you access and why:

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

// Use middleware to log queries
client.use({
  name: 'audit-logger',
  beforeQuery: (query) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      action: 'rdap_query',
      queryType: query.type,
      queryValue: query.value,
      purpose: 'domain_monitoring',
    }));
    return query;
  },
});
```

## Privacy Regulations Quick Reference

| Regulation | Region | Key Requirements for Domain Data |
|-----------|--------|--------------------------------|
| **GDPR** | EU/EEA | Legal basis required, data minimization, right to erasure, DPO for bulk processing |
| **CCPA/CPRA** | California | Opt-out of sale, right to know, right to delete |
| **LGPD** | Brazil | Similar to GDPR, consent-based, data protection officer |
| **PIPEDA** | Canada | Consent required, purpose limitation, access rights |
| **POPIA** | South Africa | Lawful processing, data minimization, security safeguards |

### GDPR Lawful Bases for Domain Lookups

1. **Legitimate interest** (most common) — Security research, brand protection, fraud prevention
2. **Legal obligation** — Compliance with court orders, regulatory requirements
3. **Contractual necessity** — Registrar operations, domain management services
4. **Consent** — User explicitly agrees to data processing (rare for RDAP)

## Common Mistakes to Avoid

### Mistake 1: Storing Full RDAP Responses

```typescript
// BAD: Storing everything including PII
const result = await client.domain('example.com');
await database.save('rdap_cache', result); // Contains PII!

// GOOD: Store only non-PII fields
const result = await client.domain('example.com');
await database.save('domain_status', {
  domain: result.ldhName,
  status: result.status,
  expires: result.events?.find(e => e.eventAction === 'expiration')?.eventDate,
  nameservers: result.nameservers?.map(ns => ns.ldhName),
  // No contact entities stored
});
```

### Mistake 2: Exposing PII in Logs

```typescript
// BAD: Logging full responses
console.log('RDAP result:', JSON.stringify(result));

// GOOD: Log only non-sensitive fields
console.log('RDAP result:', {
  domain: result.ldhName,
  status: result.status,
  queryTime: Date.now(),
});
```

### Mistake 3: No Data Retention Policy

Set clear retention periods and auto-delete old data:

```typescript
// Implement automatic cleanup
async function cleanupOldRecords() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  await database.deleteWhere('rdap_queries', {
    createdAt: { $lt: thirtyDaysAgo },
  });
}
```

## Checklist: Privacy-Compliant RDAP Integration

- [ ] Enable PII redaction in your RDAP client
- [ ] Document your lawful basis for processing registration data
- [ ] Implement data minimization — only extract fields you need
- [ ] Set cache/storage TTLs — don't keep data longer than necessary
- [ ] Add audit logging for all RDAP queries
- [ ] Don't log PII in application logs
- [ ] Implement data deletion procedures
- [ ] Review your privacy policy to cover domain lookup data
- [ ] Train your team on handling registration data

## Conclusion

RDAP was designed with privacy in mind, but the protocol alone doesn't make you compliant. You need to handle responses carefully, minimize data collection, and implement proper safeguards. RDAPify's built-in PII redaction gives you a strong starting point.

---

*Learn more about RDAPify's privacy features in our [documentation](/docs/getting-started/installation) or check our [Privacy Policy](/privacy).*
