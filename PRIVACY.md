# Privacy Policy

**Effective Date:** March 23, 2026
**Version:** 2.0

## Executive Summary

RDAPify is a **client-side library** that operates under a **privacy-by-default** architecture. We do not collect, store, or transmit personal data. Your applications maintain complete control over data handling, and you remain the data controller for GDPR/CCPA purposes.

**Key Point**: RDAPify does not send data to our servers. The library only queries public RDAP registries and caches results locally.

## Core Privacy Principles

1. **Data Minimization**: Process only necessary data for RDAP lookups
2. **Privacy by Default**: PII redaction enabled by default (no opt-in required)
3. **Transparency**: Clear documentation of all data flows
4. **User Control**: Applications control all data retention and usage
5. **No Telemetry**: No usage statistics, analytics, or tracking by default
6. **Open Source**: Full code transparency for security auditing

## How RDAPify Processes Data

### What We DON'T Do

- ❌ Collect or send usage statistics to any servers
- ❌ Transmit your RDAP queries to our servers
- ❌ Include hidden tracking code or beacons
- ❌ Persist query results across sessions (by default)
- ❌ Sell or share data with third parties
- ❌ Track individual queries or create user profiles
- ❌ Include telemetry by default (opt-in only if explicitly enabled)

### What We DO

- ✅ Query public RDAP registries (as directed by your application)
- ✅ Cache responses locally in your process memory (configurable)
- ✅ Redact personally identifiable information (PII) by default
- ✅ Provide privacy controls and configuration options
- ✅ Support GDPR/CCPA compliance features
- ✅ Keep all processing within your infrastructure

## Data Flow Diagram

```
Your Application
      ↓
RDAPify (Client-side Library)
      ├─ Input: Domain/IP to look up
      ├─ Step 1: Validate input
      ├─ Step 2: Check local cache (in-memory only)
      │         No network traffic here
      ├─ Step 3: Bootstrap discovery (IANA registry only)
      │         Query: https://data.iana.org/rdap/dns.json
      │         Response: URLs of authoritative servers
      ├─ Step 4: Security checks (SSRF validation, no private IPs)
      ├─ Step 5: Fetch from authoritative RDAP server
      │         Example: https://rdap.verisign.com/com/v1/domain/example.com
      ├─ Step 6: Normalize response (standardize field names)
      ├─ Step 7: Redact PII (remove emails, phones, addresses)
      ├─ Step 8: Cache normalized result (local, in-memory)
      └─ Output: Redacted RDAP data
      ↓
Your Application
(You control retention, logging, storage)
```

### What Data Leaves Your Infrastructure

**Only these requests leave your system:**

1. **RDAP Query Requests** (to public RDAP servers)
   - Domain: `https://rdap.{registrar}/domain/{query}`
   - IP: `https://rdap.{rir}/ip/{query}`
   - ASN: `https://rdap.{rir}/autnum/{query}`
   - Contains: ONLY the query (domain/IP/ASN) you looked up

2. **Bootstrap Discovery** (to IANA registry)
   - URL: `https://data.iana.org/rdap/dns.json` (public, cached)
   - Frequency: Once per bootstrap cycle (configurable)
   - Data: None (HTTPS GET request)

**What does NOT leave your infrastructure:**
- ❌ Your application's code or environment
- ❌ Browser cookies or user authentication
- ❌ Metadata about your queries (timestamps, counts, etc.)
- ❌ Your application's settings or configuration
- ❌ Any personal information about your users

## PII Redaction Details

### Default Redaction Levels

**Privacy Level: "Standard" (Default)**
```typescript
Redacted fields:
  ✓ contact.email
  ✓ contact.phone
  ✓ contact.fax
  ✓ registrant.name
  ✓ registrant.email
  ✓ registrant.address (full)
  ✓ administrator.email
  ✓ technical.email
  ✓ tech.phone
```

**Privacy Level: "Strict"**
```typescript
Redacted fields (includes above plus):
  ✓ contact.name (all variations)
  ✓ registrar.contactEmail
  ✓ nameserver.email
  ✓ administrative.email
  ✓ ipContact.email
```

**Privacy Level: "Permissive"**
```typescript
Redacted fields (minimal):
  ✓ contact.email (only email)
  ✓ registrant.email (only email)
  ✓ personal.email (only email)
```

### Configuration Examples

```typescript
// Default (Standard privacy)
const client = new RDAPClient();
// Redacts standard PII automatically

// Strict privacy
const client = new RDAPClient({
  privacy: { level: 'strict' }
});
// Redacts all personal identifiers

// Custom redaction
const client = new RDAPClient({
  privacy: {
    level: 'custom',
    redactFields: ['email', 'phone'],
    preserveFields: ['organization']
  }
});

// Disable redaction (not recommended)
const client = new RDAPClient({
  privacy: { enabled: false }
});
// WARNING: GDPR/CCPA risks if you do this
```

### How Redaction Works

```typescript
// Original RDAP response
{
  "handle": "EXAMPLE.COM",
  "ldhName": "example.com",
  "contacts": [{
    "type": "registrant",
    "email": "admin@example.com",
    "phone": "+1.5551234567",
    "name": "John Doe"
  }]
}

// After redaction (Standard level)
{
  "handle": "EXAMPLE.COM",
  "ldhName": "example.com",
  "contacts": [{
    "type": "registrant",
    "email": "[REDACTED]",           // ← removed
    "phone": "[REDACTED]",           // ← removed
    "name": "[REDACTED]"             // ← removed
  }]
}
```

## Cache Privacy & Data Retention

### Cache Behavior

```typescript
// In-memory cache (L1)
- Stored in process memory only
- Cleared when process exits
- Survives request interruptions
- Configurable TTL (default: 1 hour)
- Default size: 1000 entries

// Redis cache (L2) - Optional
- Persistent across process restarts
- Configurable retention (default: 24 hours)
- Shared across processes if using Redis
- You control Redis access and backup
```

### Cache Clearing (GDPR Right to Erasure)

```typescript
// Clear all cached data
await client.cache.clear();

// Clear specific entry
await client.cache.delete('domain:example.com');

// Clear by pattern
await client.cache.deletePattern('domain:*');

// Automatic cleanup with TTL
// (default: 1 hour, configurable)
```

### Cache Configuration for Compliance

```typescript
// Minimal caching (compliance-focused)
const client = new RDAPClient({
  cache: {
    enabled: true,
    ttl: 300,          // 5 minutes
    maxSize: 100       // Small cache
  }
});

// No caching (most privacy-protective)
const client = new RDAPClient({
  cache: {
    enabled: false
  }
});
```

## Third-Party Data Handling

### RDAP Registries (Public Data Sources)

RDAPify queries these public RDAP registries, which are operated independently:

**Domain Registry**
- `.com`, `.net`: Verisign (https://rdap.verisign.com)
- Generic TLDs: ICANN registry operators
- Country TLDs: Country-specific registries

**IP Registry**
- ARIN (Americas): https://rdap.arin.net
- RIPE (Europe): https://rdap.db.ripe.net
- APNIC (Asia-Pacific): https://rdap.apnic.net
- LACNIC (Latin America): https://rdap.lacnic.net
- AFRINIC (Africa): https://rdap.afrinic.net

**Data Privacy Implications:**
- These are public registries (WHOIS data)
- You are responsible for registrant privacy at registration time
- RDAPify only retrieves what's already public
- Redaction is done client-side (registries see queries but not our redaction)

### Our Servers

**Clarity**: RDAPify does not send data to rdapify.com servers.

However, if you use @rdapify/pro features:
- License validation (encrypted)
- Webhook notifications (if configured)
- Analytics (opt-in only)

These optional features are:
- Always encrypted in transit (TLS)
- Transmitted only if explicitly enabled
- Documented in @rdapify/pro documentation

### Optional Telemetry

**Default**: Disabled
**How to enable** (if needed):
```typescript
const client = new RDAPClient({
  telemetry: {
    enabled: true,
    endpoint: 'https://your-analytics-server.com'
  }
});
```

**What's collected** (if enabled):
- Query types (domain/IP/ASN - not the actual values)
- Response times
- Cache hit rates
- Error codes (not error details)
- Library version
- Runtime (Node.js version)

**What's NOT collected**:
- ❌ Actual domain names, IP addresses, or query values
- ❌ Personal information
- ❌ Application identifiers
- ❌ User IP addresses
- ❌ Request headers (except standard HTTP headers)

## GDPR Compliance

RDAPify provides tools to support GDPR Article 32 (Security) requirements:

### Right to Access
- Your application has direct access to all cached data
- `await client.cache.getAll()` returns all entries
- No data stored on RDAPify servers

### Right to Rectification
- Data is fetched fresh (not stale copies kept)
- Cached data can be refreshed
- `await client.cache.delete('key')` forces fresh fetch

### Right to Erasure
- Clear cache: `await client.cache.clear()`
- Redaction removes personal data immediately
- No data persisted beyond cache TTL
- GDPR Article 17 compliance: client-side deletion only

### Right to Data Portability
- All data is in standard RDAP JSON format
- Can be exported from cache
- No proprietary formats

### Lawful Basis
As the data controller, you must establish lawful basis:
- **Legitimate Interest** (most common for domain research)
- **Contract** (if registrant is customer)
- **Legal Obligation** (compliance/fraud prevention)
- **Consent** (if you've obtained it)

**RDAPify's role**: Data processor supporting your compliance

## CCPA Compliance

RDAPify supports CCPA Consumer Rights:

### Disclosure Requirements
- RDAPify doesn't collect "personal information" per CCPA
- Library is transparent about what data is accessed
- Cache is under user control

### Consumer Rights Implementation
```typescript
// 1. Right to Know - Access cached data
const cachedData = await client.cache.getAll();

// 2. Right to Delete - Clear data
await client.cache.clear();

// 3. Right to Opt-Out - Disable telemetry (default)
// Telemetry is disabled by default; no opt-out needed

// 4. Right to Non-Discrimination
// RDAPify doesn't discriminate based on privacy choices
```

### Sensitive Personal Information
- Email addresses and phone numbers are redacted by default
- If you need to process them, you must handle at application level
- CCPA penalties apply to your application, not RDAPify

## Data Retention

### Retention Policies

**Cache Data**
- Default TTL: 1 hour
- Max cache entries: 1000
- Retention beyond cache: 0 (cleared on process exit)

**Bootstrap Discovery Cache**
- Default TTL: 30 days
- Stored locally in process directory
- Can be manually cleared

**Logs**
- Standard application logs not kept by RDAPify
- Audit logging (if enabled) is application's responsibility
- Recommend log retention: 7-90 days per compliance needs

**No Server-Side Retention**
- RDAPify servers don't store query data
- No long-term databases of lookups
- No historical data collection

## Security Considerations

### Encryption

**In Transit:**
- All RDAP queries use HTTPS (TLS 1.2+)
- Certificate pinning supported (configurable)
- HSTS preloading recommended

**At Rest:**
- Cache data kept in process memory (not encrypted)
- If sensitive, implement application-level encryption
- Redis cache can use Redis encryption module

### Access Control

Your application controls:
- Who can instantiate RDAPClient
- Which queries are allowed
- Cache access permissions
- Redaction levels

RDAPify enforces:
- SSRF protection (no internal IP access)
- Input validation (no injection)
- HTTPS only (no cleartext)

## Privacy by Runtime

### Node.js
- Cache: Process memory
- Logs: To stdout/stderr (your control)
- Plugins: Full access to cache and client

### Bun
- Cache: Process memory (same as Node.js)
- Faster execution, same privacy model
- TypeScript support native

### Deno
- Cache: Process memory
- Permissions model: Can restrict file access
- Secure by default

### Cloudflare Workers
- Cache: Durable Objects (you control)
- Memory: Worker instance memory
- No persistent local storage

### Browser (Future)
- Cache: IndexedDB or localStorage (user's choice)
- No network requests hidden
- Transparent in DevTools

## User Rights & Responsibilities

### Our Responsibilities
- Transparent code (open source)
- Default privacy settings (redaction enabled)
- No hidden data collection
- Security best practices
- Clear documentation

### Your Responsibilities (As Developer)
1. **Data Controller** obligations:
   - Establish lawful basis for RDAP lookups
   - Create privacy notices for your users
   - Handle data retention policies
   - Respond to data subject requests

2. **Security**:
   - Protect RDAPify cache from unauthorized access
   - Secure your RDAP queries if sensitive
   - Update RDAPify regularly
   - Monitor for security advisories

3. **Configuration**:
   - Set appropriate redaction levels
   - Configure cache TTL for your needs
   - Disable telemetry if not needed
   - Implement audit logging if required

4. **Compliance**:
   - Document your lawful basis
   - Provide privacy notices to users
   - Handle data subject requests
   - Maintain compliance records

## Data Processing Agreement

If you're an EU entity subject to GDPR:

RDAPify acts as your **Data Processor** for:
- Processing instructions via client configuration
- Querying RDAP registries on your behalf
- Storing data temporarily in cache
- Redacting PII per your settings

You remain the **Data Controller** and are responsible for:
- Lawful basis for processing
- User privacy notices
- Data subject rights
- Compliance documentation

**RDAPify does NOT**:
- Subcontract processing (data stays with you)
- Transfer data internationally
- Use data for profiling or marketing
- Combine with other datasets

## Privacy Policy Updates

We may update this policy to:
- Reflect new features
- Improve clarity
- Address new regulations
- Respond to feedback

**Notice**: Material changes will be announced via GitHub releases and email to registered developers.

**Current version**: 2.0 (March 23, 2026)
**Previous version**: 1.0 (December 5, 2025)

## Contact & Questions

### Privacy Inquiries
**Email**: privacy@rdapify.com

### GDPR Data Subject Requests
**Email**: gdpr@rdapify.com

### Security Vulnerabilities
**Email**: security@rdapify.com

### General Inquiries
**Email**: hello@rdapify.com

### Mailing Address
```
RDAPify Project
Technical Committee
[Address to be added]
```

---

## Appendix: RDAP Registries Privacy Notice

When using RDAPify, you are accessing data from public RDAP registries. These registries are public by design (equivalent to WHOIS data) and operated by:

- ICANN (generic TLDs)
- Country-specific registries (.uk, .de, etc.)
- RIRs (ARIN, RIPE, APNIC, LACNIC, AFRINIC)

**Your responsibilities:**
- Understand that accessed data is public
- Comply with registry policies (usually in their TOS)
- Don't use data for spam, harassment, or illegal purposes
- Report misuse to respective registry operators

**Registry privacy policies:**
- ICANN: https://www.icann.org/privacy
- Verisign: https://www.verisign.com/en_US/privacy/index.xhtml
- ARIN: https://www.arin.net/resources/registry_data_access/

---

**Last Updated**: March 23, 2026
**Next Review**: June 23, 2026

**Thank you for trusting RDAPify with your privacy!**
