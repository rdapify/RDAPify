---
date: 2026-03-06
slug: securing-domain-lookups-ssrf-protection
title: "Securing Domain Lookups: A Guide to SSRF Protection in RDAP Clients"
authors: [rdapify]
tags: [security, ssrf, rdap, best-practices]
description: "RDAP clients make outbound HTTP requests — making them potential SSRF vectors. Learn how to protect your applications with proper SSRF defenses when performing domain lookups."
keywords: [ssrf protection, server side request forgery, secure domain lookup, rdap security, ssrf prevention nodejs, domain lookup security]
image: /img/rdapify-social-card.png
---
date: 2026-03-06

Every RDAP client makes outbound HTTP requests to external servers. If user input influences those requests, you have a potential Server-Side Request Forgery (SSRF) vulnerability. This guide shows you how SSRF attacks work in the context of domain lookups and how to defend against them.

<!-- truncate -->

## What is SSRF?

Server-Side Request Forgery (SSRF) tricks your server into making requests to unintended destinations. In the context of RDAP/WHOIS lookups:

```
User input: "evil.com"
Expected: Client queries rdap.verisign.com for evil.com
Actual attack: Attacker manipulates the request to hit internal services
```

An attacker could potentially:

- **Access internal services** — `http://169.254.169.254/` (cloud metadata), `http://localhost:6379/` (Redis)
- **Scan internal networks** — Map out your internal infrastructure
- **Exfiltrate data** — Route sensitive data through attacker-controlled servers
- **Bypass firewalls** — Use your server as a proxy to reach protected resources

## How SSRF Applies to RDAP Clients

RDAP clients are particularly susceptible because they follow a multi-step process:

```
1. User provides a domain name (user input)
2. Client queries IANA bootstrap (trusted)
3. Bootstrap returns an RDAP server URL (semi-trusted)
4. Client makes HTTP request to that URL (potential SSRF vector!)
5. RDAP server may return redirect URLs (another vector!)
```

### Attack Vector 1: Malicious Bootstrap Data

If an attacker can influence bootstrap data (poisoned cache, MITM), they could redirect your client to an internal endpoint.

### Attack Vector 2: Redirect Following

An RDAP server could return an HTTP redirect to an internal URL:

```
GET https://rdap.example.com/domain/test.com
→ 302 Redirect → http://169.254.169.254/latest/meta-data/
```

### Attack Vector 3: Response-Embedded URLs

RDAP responses contain `links` arrays. A malicious server could embed internal URLs that your application follows.

## SSRF Protection Strategies

### 1. Block Private/Reserved IP Ranges

Never allow requests to private, loopback, or reserved IP addresses:

```
Blocked ranges:
- 10.0.0.0/8        (Private)
- 172.16.0.0/12     (Private)
- 192.168.0.0/16    (Private)
- 127.0.0.0/8       (Loopback)
- 169.254.0.0/16    (Link-local / Cloud metadata)
- 0.0.0.0/8         (Current network)
- 100.64.0.0/10     (Carrier-grade NAT)
- ::1/128           (IPv6 loopback)
- fc00::/7          (IPv6 unique local)
- fe80::/10         (IPv6 link-local)
```

### 2. DNS Resolution Validation

Resolve hostnames *before* connecting and validate the resolved IP:

```
Hostname: evil-rdap-server.com
DNS resolves to: 169.254.169.254  ← BLOCK!
```

This prevents DNS rebinding attacks where a hostname initially resolves to a public IP but changes to a private IP on subsequent lookups.

### 3. Protocol Enforcement

Only allow HTTPS. Block `http://`, `file://`, `gopher://`, `ftp://`, and all other schemes.

### 4. Redirect Limits

Limit redirect following and validate each redirect destination against the same SSRF rules.

## How RDAPify Handles SSRF

RDAPify has built-in SSRF protection enabled by default:

```typescript
import { RDAPClient } from 'rdapify';

// SSRF protection is ON by default
const client = new RDAPClient();

// These are automatically blocked:
// - Requests to private IP ranges
// - DNS rebinding attacks
// - Suspicious redirects
// - Non-HTTPS protocols
```

### What RDAPify Blocks

RDAPify's SSRF protection layer:

1. **Resolves DNS before connecting** — Validates the resolved IP isn't in a private range
2. **Blocks all private/reserved ranges** — Including IPv4 and IPv6
3. **Enforces HTTPS** — Rejects non-TLS connections to RDAP servers
4. **Validates redirects** — Each redirect hop is checked against SSRF rules
5. **Limits redirect depth** — Prevents infinite redirect chains

### Testing SSRF Protection

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

// This would throw an SSRF error if the bootstrap
// somehow resolved to a private IP
try {
  await client.domain('example.com');
} catch (error) {
  if (error.code === 'SSRF_BLOCKED') {
    console.error('SSRF attempt blocked:', error.message);
  }
}
```

## Defense in Depth: Beyond the Client

SSRF protection in your RDAP client is just one layer. A complete defense includes:

### Network-Level Controls

```
# Firewall rules: block outbound to private ranges
iptables -A OUTPUT -d 169.254.0.0/16 -j DROP
iptables -A OUTPUT -d 10.0.0.0/8 -j DROP
iptables -A OUTPUT -d 172.16.0.0/12 -j DROP
iptables -A OUTPUT -d 192.168.0.0/16 -j DROP
```

### Cloud Metadata Protection

If running on AWS, GCP, or Azure, use IMDSv2 (token-required) instead of the default metadata endpoint:

```bash
# AWS: Require IMDSv2 tokens
aws ec2 modify-instance-metadata-options \
  --instance-id i-1234567890abcdef0 \
  --http-tokens required
```

### Application-Level Controls

```typescript
// Rate limit RDAP queries per user
const rateLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60000, // 100 requests per minute
});

// Validate user input before querying
function validateDomainInput(input: string): boolean {
  // Only allow valid domain name characters
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
  return domainRegex.test(input) && input.length <= 253;
}
```

## Common SSRF Bypass Techniques (and Defenses)

| Bypass Technique | Example | Defense |
|-----------------|---------|---------|
| Decimal IP | `http://2130706433/` (= 127.0.0.1) | Parse and normalize all IP formats |
| IPv6 mapping | `http://[::ffff:127.0.0.1]/` | Check IPv6-mapped IPv4 addresses |
| DNS rebinding | Hostname resolves to different IPs | Resolve DNS and validate before connecting |
| URL encoding | `http://127.0.0.1%00@evil.com/` | Strict URL parsing before resolution |
| Redirect chain | Public → Private via 302 | Validate every redirect destination |
| Short URL | `http://bit.ly/xyz` → private IP | Resolve and validate final destination |

## Checklist: SSRF-Safe RDAP Integration

- [ ] Use a client with built-in SSRF protection (like RDAPify)
- [ ] Validate user input before passing to the RDAP client
- [ ] Block outbound requests to private IP ranges at the firewall level
- [ ] Protect cloud metadata endpoints (IMDSv2)
- [ ] Rate limit RDAP queries
- [ ] Log and monitor outbound requests for anomalies
- [ ] Keep your RDAP client updated for security patches

## Conclusion

RDAP clients are powerful tools, but they make outbound HTTP requests based on semi-trusted data. SSRF protection isn't optional — it's essential. RDAPify builds these defenses in by default, so you can query registration data safely without rolling your own security layer.

---
date: 2026-03-06

*Learn more about RDAPify's security features in our [Security documentation](/docs/guides/error-handling) or run the SSRF test suite: `npm run test:security`.*
