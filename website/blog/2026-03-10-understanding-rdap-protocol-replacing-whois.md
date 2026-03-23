---
date: 2026-03-10
slug: understanding-rdap-protocol-replacing-whois
title: "Understanding RDAP: The Protocol Replacing WHOIS"
authors: [rdapify]
tags: [rdap, protocol, internet-standards, education]
description: "A comprehensive introduction to RDAP (Registration Data Access Protocol). Learn what RDAP is, how it works, its object types, and why it's replacing WHOIS as the standard for internet registration data."
keywords: [what is rdap, rdap explained, rdap protocol, registration data access protocol, rdap standard, rdap rfc, how rdap works]
image: /img/rdapify-social-card.png
---
date: 2026-03-10

RDAP (Registration Data Access Protocol) is the modern standard for querying internet registration data — domain names, IP addresses, and autonomous system numbers. If you work with DNS, networking, cybersecurity, or domain management, RDAP is a protocol you need to know.

This article explains RDAP from the ground up: what it is, how it works, and what you can do with it.

<!-- truncate -->

## What is RDAP?

RDAP stands for **Registration Data Access Protocol**. It's a set of IETF standards (RFC 7480-7484, updated by RFC 9082-9083) that define how to query and retrieve registration data about internet resources.

Think of it as a structured, secure, RESTful API for looking up:

- **Who registered a domain name** and when it expires
- **Who owns an IP address block** and where it's allocated
- **Who operates an autonomous system** (ASN) and their contact details

## How RDAP Works

### The Request Flow

```
1. Client wants to look up "example.com"
2. Client queries IANA bootstrap to find the right RDAP server
3. IANA says: ".com domains → rdap.verisign.com"
4. Client sends: GET https://rdap.verisign.com/com/v1/domain/example.com
5. Server responds with structured JSON
```

### Bootstrap: Finding the Right Server

Unlike WHOIS (where you need to know which server to query), RDAP uses a **bootstrap** system. IANA maintains JSON files that map:

- Domain TLDs → RDAP server URLs
- IP ranges → RDAP server URLs (ARIN, RIPE, APNIC, etc.)
- ASN ranges → RDAP server URLs

These bootstrap files are publicly available at `https://data.iana.org/rdap/`.

### URL Patterns

RDAP uses consistent, RESTful URL patterns:

```
# Domain lookup
GET {base}/domain/{name}
GET https://rdap.verisign.com/com/v1/domain/example.com

# IP lookup
GET {base}/ip/{address}
GET https://rdap.arin.net/registry/ip/8.8.8.8

# IP network lookup
GET {base}/ip/{prefix}/{length}
GET https://rdap.arin.net/registry/ip/8.8.8.0/24

# ASN lookup
GET {base}/autnum/{number}
GET https://rdap.arin.net/registry/autnum/15169

# Nameserver lookup
GET {base}/nameserver/{name}

# Entity (contact) lookup
GET {base}/entity/{handle}
```

## The Five RDAP Object Types

### 1. Domain

The most commonly queried object. Returns registration info, nameservers, status, and events.

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();
const domain = await client.domain('google.com');

// Key fields
domain.ldhName;       // "google.com"
domain.status;        // ["client delete prohibited", "client transfer prohibited", ...]
domain.events;        // Registration, expiration, last changed dates
domain.nameservers;   // NS records
domain.entities;      // Registrant, admin, tech contacts
domain.secureDNS;     // DNSSEC information
```

### 2. IP Network

Returns information about an IP address or network block, including the organization that holds the allocation.

```typescript
const ip = await client.ip('8.8.8.8');

ip.name;         // "GOGL" (network name)
ip.startAddress; // "8.8.8.0"
ip.endAddress;   // "8.8.8.255"
ip.country;      // "US"
ip.type;         // "DIRECT ALLOCATION"
ip.entities;     // Google LLC contact info
```

### 3. Autonomous System Number (ASN)

Returns information about who operates a specific ASN.

```typescript
const asn = await client.asn(15169);

asn.handle; // "AS15169"
asn.name;   // "GOOGLE"
asn.type;   // "DIRECT ALLOCATION"
asn.events; // Registration and last changed dates
```

### 4. Nameserver

Returns information about a specific nameserver.

```typescript
const ns = await client.nameserver('ns1.google.com');

ns.ldhName;      // "ns1.google.com"
ns.ipAddresses;  // { v4: ["216.239.32.10"], v6: ["2001:4860:4802:32::a"] }
```

### 5. Entity

Returns information about a registered contact (person or organization).

```typescript
const entity = await client.entity('GOGL');

entity.handle;   // "GOGL"
entity.roles;    // ["registrant"]
entity.vcardArray; // Contact info in jCard format
```

## RDAP Response Structure

Every RDAP response follows a consistent structure:

```json
{
  "objectClassName": "domain",
  "handle": "unique-id",
  "ldhName": "example.com",
  "unicodeName": "example.com",

  "status": ["active", "client transfer prohibited"],

  "events": [
    {
      "eventAction": "registration",
      "eventDate": "2024-01-15T00:00:00Z"
    }
  ],

  "entities": [
    {
      "objectClassName": "entity",
      "roles": ["registrant"],
      "vcardArray": ["vcard", [
        ["fn", {}, "text", "John Doe"],
        ["email", {}, "text", "john@example.com"]
      ]]
    }
  ],

  "links": [
    {
      "rel": "self",
      "href": "https://rdap.example.com/domain/example.com",
      "type": "application/rdap+json"
    }
  ],

  "notices": [
    {
      "title": "Terms of Use",
      "description": ["Service subject to terms at ..."]
    }
  ],

  "rdapConformance": ["rdap_level_0", "icann_rdap_response_profile_0"]
}
```

### Key Sections

- **status** — Standardized status codes (RFC 8056): `active`, `inactive`, `locked`, `client delete prohibited`, etc.
- **events** — Timestamped lifecycle events: `registration`, `expiration`, `last changed`, `transfer`
- **entities** — Contacts with roles: `registrant`, `administrative`, `technical`, `abuse`
- **links** — HATEOAS-style links for navigation between related objects
- **notices** — Terms of service, rate limit info, redaction notices
- **rdapConformance** — Declares which RDAP extensions the server supports

## RDAP Standards (RFCs)

| RFC | Title |
|-----|-------|
| RFC 7480 | HTTP Usage in the Registration Data Access Protocol |
| RFC 7481 | Security Services for RDAP |
| RFC 7482 | Registration Data Access Protocol Query Format |
| RFC 7483 | JSON Responses for RDAP |
| RFC 7484 | Finding the Authoritative Registration Data Service |
| RFC 8056 | EPP Status Mapping for RDAP |
| RFC 9082 | Registration Data Access Protocol (RDAP) Query Format (updated) |
| RFC 9083 | JSON Responses for RDAP (updated) |
| RFC 9224 | Finding the Authoritative RDAP Service (updated) |

## Querying RDAP with RDAPify

RDAPify abstracts the complexity of bootstrap discovery, HTTP negotiation, and response parsing:

```bash
npm install rdapify
```

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  cache: { ttl: 3600 },     // Built-in response caching
  timeout: 10000,            // 10s timeout
});

// All five object types
const domain = await client.domain('example.com');
const ip = await client.ip('192.0.2.1');
const asn = await client.asn(64496);
const ns = await client.nameserver('ns1.example.com');
const entity = await client.entity('EXAMPLE-HANDLE');
```

No need to manually discover servers, parse bootstrap files, or handle HTTP content negotiation. RDAPify handles it all.

## Conclusion

RDAP is a well-designed, modern protocol that solves the real problems with WHOIS. Whether you're building a security tool, domain management platform, or compliance system, understanding RDAP fundamentals will serve you well.

The protocol is already live and authoritative for most of the internet's registration data. Now is the time to learn it and build with it.

---
date: 2026-03-10

*Ready to start querying? Install RDAPify with `npm install rdapify` and follow our [Getting Started guide](/docs/getting-started/installation).*
