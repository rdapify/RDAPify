---
slug: rdap-vs-whois-complete-developers-guide
title: "RDAP vs WHOIS: The Complete Developer's Guide (2026)"
authors: [rdapify]
tags: [rdap, whois, comparison, tutorial]
description: "A detailed technical comparison of RDAP and WHOIS for developers. Understand the differences in protocol, data format, security, and see real code examples for both."
keywords: [rdap vs whois, rdap whois comparison, domain lookup protocol, whois replacement 2026, rdap tutorial, registration data protocol]
image: /img/rdapify-social-card.png
---

Choosing between RDAP and WHOIS in 2026 isn't really a choice — RDAP is the clear successor. But understanding *why* and *how* they differ helps you build better domain intelligence tools. This guide breaks down every technical difference with real code examples.

<!-- truncate -->

## Protocol Architecture

### WHOIS: Text Over TCP

WHOIS uses a simple TCP connection on port 43. You send a query string, get back unstructured text:

```
Client → TCP:43 → "example.com\r\n"
Server → TCP:43 → "Domain Name: EXAMPLE.COM\r\n..."
```

There's no schema, no content negotiation, no error codes. If the server doesn't understand your query, you might get an error message — or just an empty response. There's no way to tell programmatically.

### RDAP: RESTful HTTPS

RDAP uses standard HTTPS with RESTful URL patterns:

```
GET https://rdap.verisign.com/com/v1/domain/example.com
Accept: application/rdap+json

→ HTTP/1.1 200 OK
  Content-Type: application/rdap+json
  {
    "objectClassName": "domain",
    "ldhName": "example.com",
    ...
  }
```

Standard HTTP status codes (200, 404, 429), content type negotiation, and caching headers.

## Data Format Comparison

### WHOIS Response (Unstructured)

```text
Domain Name: EXAMPLE.COM
Registry Domain ID: 2336799_DOMAIN_COM-VRSN
Registrar WHOIS Server: whois.iana.org
Registrar URL: http://www.iana.org
Updated Date: 2024-08-14T07:01:38Z
Creation Date: 1995-08-14T04:00:00Z
Registry Expiry Date: 2025-08-13T04:00:00Z
Registrar: RESERVED-Internet Assigned Numbers Authority
Domain Status: clientDeleteProhibited
Name Server: A.IANA-SERVERS.NET
Name Server: B.IANA-SERVERS.NET
```

Parsing this requires custom regex for every registrar. Some registrars use "Creation Date", others use "Created", and some use "Registration Date".

### RDAP Response (Structured JSON)

```json
{
  "objectClassName": "domain",
  "handle": "2336799_DOMAIN_COM-VRSN",
  "ldhName": "example.com",
  "status": ["client delete prohibited"],
  "events": [
    {
      "eventAction": "registration",
      "eventDate": "1995-08-14T04:00:00Z"
    },
    {
      "eventAction": "last changed",
      "eventDate": "2024-08-14T07:01:38Z"
    },
    {
      "eventAction": "expiration",
      "eventDate": "2025-08-13T04:00:00Z"
    }
  ],
  "nameservers": [
    {
      "objectClassName": "nameserver",
      "ldhName": "a.iana-servers.net"
    },
    {
      "objectClassName": "nameserver",
      "ldhName": "b.iana-servers.net"
    }
  ]
}
```

Every field has a defined name. Dates always follow ISO 8601. Status codes are standardized.

## Code Comparison

### Domain Lookup: WHOIS Way

```javascript
// Using a WHOIS library
const whois = require('whois');

whois.lookup('example.com', (err, data) => {
  if (err) throw err;

  // Parse unstructured text... good luck
  const creationMatch = data.match(
    /Creat(?:ion|ed)\s*Date:\s*(.+)/i
  );
  const expiryMatch = data.match(
    /(?:Expir(?:y|ation)|Registry Expiry)\s*Date:\s*(.+)/i
  );

  const created = creationMatch ? new Date(creationMatch[1]) : null;
  const expires = expiryMatch ? new Date(expiryMatch[1]) : null;
  // Fragile, breaks when registrar changes format
});
```

### Domain Lookup: RDAP Way

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();
const domain = await client.domain('example.com');

// Structured, typed access
const created = domain.events.find(
  e => e.eventAction === 'registration'
)?.eventDate;

const expires = domain.events.find(
  e => e.eventAction === 'expiration'
)?.eventDate;

// Works for every registrar, every TLD
```

## Security Comparison

| Aspect | WHOIS | RDAP |
|--------|-------|------|
| Transport encryption | None (plaintext TCP) | TLS (HTTPS) |
| Authentication | Not supported | HTTP auth (Basic, Bearer, OAuth) |
| Access control | All-or-nothing | Differentiated responses per role |
| Rate limiting standard | None (ad-hoc) | HTTP 429 + Retry-After header |
| Input validation | Server-dependent | HTTP standard |
| SSRF risk | Port 43 — unusual | Port 443 — standard firewall rules |

### RDAP's Differentiated Access

RDAP servers can return different data based on who's asking:

- **Anonymous users** — Basic domain info, redacted contacts
- **Authenticated registrars** — Full contact details
- **Law enforcement** — Unredacted data with audit trail

This isn't possible with WHOIS.

## Service Discovery

### WHOIS: Hardcoded Servers

With WHOIS, you need to know which server to query:

```
.com → whois.verisign-grs.com
.net → whois.verisign-grs.com
.org → whois.pir.org
.uk  → whois.nic.uk
```

New TLDs? You need to manually update your server list.

### RDAP: IANA Bootstrap

RDAP uses [IANA bootstrap files](https://data.iana.org/rdap/) to automatically discover the right server:

```typescript
// RDAPify handles bootstrap automatically
const client = new RDAPClient();

// Works for any TLD — discovers the right server
await client.domain('example.com');     // → Verisign RDAP
await client.domain('example.org');     // → PIR RDAP
await client.domain('example.uk');      // → Nominet RDAP
await client.domain('example.xyz');     // → Centralnic RDAP
```

No hardcoded server lists. No manual maintenance.

## Internationalization

WHOIS is limited to ASCII. RDAP supports full Unicode:

```typescript
const client = new RDAPClient();

// Internationalized domain names work natively
const domain = await client.domain('example.xn--p1ai'); // .рф (Russian)

// Unicode contact data is properly encoded
// Not garbled or transliterated like WHOIS
```

## Performance Comparison

| Metric | WHOIS | RDAP |
|--------|-------|------|
| Connection reuse | No (new TCP per query) | Yes (HTTP keep-alive) |
| Caching | Not standardized | HTTP Cache-Control headers |
| Compression | No | gzip/brotli via HTTP |
| Pipelining | No | HTTP/2 multiplexing |

With RDAPify's built-in cache:

```typescript
const client = new RDAPClient({
  cache: { ttl: 3600 } // Cache responses for 1 hour
});

// First call: network request (~200ms)
await client.domain('example.com');

// Second call: cache hit (~1ms)
await client.domain('example.com');
```

## When to Use Which

**Use RDAP** (recommended) when:
- Building new applications
- You need structured, reliable data
- You need security (TLS, auth)
- You query international domains
- You need compliance (GDPR)

**WHOIS still necessary** when:
- Querying legacy servers that haven't migrated yet
- Some ccTLDs still only offer WHOIS (diminishing)
- Internal tools with existing WHOIS parsing you can't rewrite yet

## The Bottom Line

RDAP is superior in every measurable way: security, reliability, parsing, performance, internationalization, and compliance. The only reason to use WHOIS in 2026 is backward compatibility — and that window is closing.

```bash
# Start using RDAP today
npm install rdapify
```

---

*Need help migrating from WHOIS to RDAP? Check out our [migration guide](/blog/whois-to-rdap-enterprise-migration-guide) or ask in [GitHub Discussions](https://github.com/rdapify/rdapify/discussions).*
