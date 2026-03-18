# 🌐 `domain()` Method Reference

> **🎯 Purpose:** Query domain registration information using RDAP protocol with built-in privacy protections  
> **📚 Related:** [RDAPClient Class](../client.md) | [IP Method](ip.md) | [ASN Method](asn.md) | [Privacy Controls](../privacy-controls.md)  
> **⏱️ Reading Time:** 5 minutes  
> **🔍 Pro Tip:** Use the [Visual Debugger](../../playground/visual-debugger.md) to interactively explore domain query results

---

## 📋 Method Signature

```typescript
async domain(
  query: string,
  options?: DomainQueryOptions
): Promise<DomainResponse>
```

## 📡 Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | `string` | ✅ | - | Domain name to query (e.g., `'example.com'`) |
| `options` | `DomainQueryOptions` | ❌ | See below | Query-specific configuration options |

### `DomainQueryOptions` Interface
```typescript
interface DomainQueryOptions {
  // Privacy controls
  redactPII?: boolean;            // Override client-level PII redaction setting
  includeRaw?: boolean;           // Include raw RDAP response (⚠️ security risk)
  
  // Performance and reliability
  timeout?: number;               // Request timeout in milliseconds
  retries?: number;               // Number of retry attempts
  registryUrl?: string;           // Override auto-discovered registry URL
  maxStaleness?: number;          // Max acceptable data staleness in seconds (offline mode)
  
  // Advanced features
  relationshipDepth?: number;     // How many levels deep to resolve entity relationships (max 3)
  customNormalizer?: Normalizer;  // Custom normalization function for this query
  priority?: 'critical' | 'high' | 'normal' | 'low'; // Query priority for rate limiting
}
```

**Default Options Values:**
```typescript
{
  redactPII: client.config.redactPII, // Inherits from client configuration
  includeRaw: false,
  timeout: client.config.timeout || 8000,
  retries: client.config.retries || 2,
  relationshipDepth: 1,
  priority: 'normal'
}
```

## 💾 Return Value

Returns a `Promise<DomainResponse>` with the following structure:

```typescript
interface DomainResponse {
  // Core domain information
  domain: string;                  // Canonical domain name
  handle: string;                  // Registry-assigned handle/ID
  unicodeName?: string;            // Internationalized domain name (if different)
  status: string[];                // Domain status flags (e.g., 'client delete prohibited')
  
  // Name servers
  nameservers: Array<{
    hostname: string;              // Name server hostname
    ipv4?: string;                 // IPv4 address (if available)
    ipv6?: string;                 // IPv6 address (if available)
  }>;
  
  // Registration events
  events: Array<{
    action: 'registration' | 'last changed' | 'expiration' | 'deletion';
    date: string;                  // ISO 8601 date string
    actor?: string;                // Entity responsible for change
  }>;
  
  // Entity relationships (with PII redacted by default)
  registrar?: Entity;              // Domain registrar
  registrant?: Entity;             // Domain owner
  administrativeContact?: Entity; // Administrative contact
  technicalContact?: Entity;       // Technical contact
  billingContact?: Entity;         // Billing contact
  
  // DNSSEC information
  secureDNS?: {
    enabled: boolean;              // Whether DNSSEC is enabled
    dsData?: Array<{               // DS record data (if available)
      keyTag: number;
      algorithm: number;
      digestType: number;
      digest: string;
    }>;
  };
  
  // Metadata
  _metadata: {
    registry: string;              // Registry source (e.g., 'verisign')
    queryTime: number;             // Query duration in milliseconds
    cached: boolean;               // Whether result came from cache
    redacted: boolean;             // Whether PII was redacted
    rawResponse?: any;             // Raw RDAP response (only if includeRaw: true)
  };
}
```

## 🛡️ Security & Privacy Controls

### Automatic PII Redaction
By default, sensitive personal information is automatically redacted:

```json
{
  "registrant": {
    "name": "REDACTED",
    "organization": "Internet Corporation for Assigned Names and Numbers",
    "email": "REDACTED@redacted.invalid",
    "phone": "REDACTED",
    "address": [
      "REDACTED",
      "REDACTED, REDACTED REDACTED",
      "REDACTED"
    ]
  },
  "technicalContact": {
    "name": "REDACTED",
    "email": "REDACTED@redacted.invalid"
  }
}
```

### Redaction Rules
- **Email addresses** → `REDACTED@redacted.invalid`
- **Phone numbers** → `REDACTED`
- **Names** → `REDACTED` (except for organization names)
- **Physical addresses** → Redacted line-by-line
- **Organization names** → Preserved (non-personal entity)
- **Technical data** → Preserved (nameservers, DNSSEC, status flags)

> **🔐 Critical Reminder:** To comply with GDPR/CCPA, never disable `redactPII` without documented legal basis and Data Protection Officer approval.

---

## 🚀 Usage Examples

### Basic Domain Query
```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({ redactPII: true });

try {
  const result = await client.domain('example.com');
  console.log(`Domain: ${result.domain}`);
  console.log(`Registrar: ${result.registrar?.name || 'REDACTED'}`);
  console.log(`Nameservers: ${result.nameservers.map(ns => ns.hostname).join(', ')}`);
  console.log(`Expiration: ${result.events.find(e => e.action === 'expiration')?.date}`);
} catch (error) {
  console.error('Query failed:', error.message);
}
```

### Advanced Features
```typescript
// Enterprise-grade domain lookup with relationship mapping
const result = await client.domain('example.com', {
  redactPII: true,
  relationshipDepth: 2, // Resolve relationships 2 levels deep
  priority: 'high',     // Higher priority for critical domains
  timeout: 10000,       // Extended timeout
  registryUrl: 'https://rdap.verisign.com' // Explicit registry override
});

// Access relationship graph
const relationships = client.mapRelationships(result);
console.log(`Found ${relationships.nodes.length} related entities`);
```

### Offline Mode with Stale Data Acceptance
```typescript
// Continue operating during network outages
const result = await client.domain('critical-system.example.com', {
  maxStaleness: 86400, // Accept data up to 24 hours stale
  offlineMode: {
    enabled: true,
    strategy: 'stale-while-revalidate'
  }
});

if (result._metadata.cached && result._metadata.queryTime === 0) {
  console.warn(`⚠️ Using stale data (last updated: ${result._metadata.lastUpdated})`);
}
```

---

## ⚠️ Error Handling

### Common Errors
| Error Code | Description | Recommended Action |
|------------|-------------|-------------------|
| `RDAP_NOT_FOUND` | Domain not found in RDAP system | Check domain spelling, consider WHOIS fallback |
| `RDAP_TIMEOUT` | Request timed out | Increase timeout, check network connectivity |
| `RDAP_RATE_LIMITED` | Rate limit exceeded by registry | Implement exponential backoff, reduce query frequency |
| `RDAP_REGISTRY_UNAVAILABLE` | Registry server down | Try alternate registry, implement fallback strategy |
| `RDAP_INVALID_RESPONSE` | Unexpected/malformed registry response | Report to registry, use cached data if available |
| `RDAP_OFFLINE_MODE` | Offline mode limitations reached | Reduce `maxStaleness`, preload critical domains |
| `RDAP_SSRF_ATTEMPT` | Attempted internal network access | Security breach attempt - audit application immediately |

### Error Handling Pattern
```typescript
try {
  const result = await client.domain('example.com');
} catch (error) {
  switch (error.code) {
    case 'RDAP_NOT_FOUND':
      console.log('Domain not registered or not in RDAP system');
      break;
      
    case 'RDAP_RATE_LIMITED':
      console.log(`Rate limited. Retry after: ${error.details.retryAfter} seconds`);
      // Implement exponential backoff
      break;
      
    case 'RDAP_TIMEOUT':
      console.log('Request timed out. Consider increasing timeout or checking connectivity');
      break;
      
    case 'RDAP_SSRF_ATTEMPT':
      console.error('🚨 SECURITY ALERT: SSRF attempt blocked');
      // Notify security team immediately
      break;
      
    default:
      console.error(`Unexpected error: ${error.message}`);
      // Log full error for debugging (with PII redacted)
      logger.error('Domain query failed', {
        domain: 'example.com',
        error: sanitizeErrorForLogging(error)
      });
  }
}
```

---

## ⚡ Performance Characteristics

### Benchmarks (2025-12-05)
| Scenario | Avg. Latency | P95 Latency | Throughput |
|----------|--------------|-------------|------------|
| **Cache Hit** | 0.8ms | 2.3ms | 1,250 req/s |
| **Cache Miss (Online)** | 320ms | 850ms | 3.1 req/s |
| **Offline Mode** | 12ms | 35ms | 83 req/s |
| **With Relationship Mapping** | 580ms | 1.2s | 1.7 req/s |

### Performance Optimization Tips
```typescript
// ✅ GOOD: Optimize for high-volume queries
const client = new RDAPClient({
  cacheOptions: {
    ttl: 3600,    // 1 hour TTL for most domains
    max: 10000    // Cache 10,000 entries
  },
  retries: 1,     // Reduce retries for high-volume scenarios
  timeout: 5000   // Shorter timeout for faster failover
});

// ✅ GOOD: Preload critical domains on startup
async function warmCache() {
  const criticalDomains = ['example.com', 'google.com', 'microsoft.com'];
  await Promise.all(criticalDomains.map(domain => 
    client.domain(domain).catch(e => console.warn(`Cache warm failed for ${domain}`, e))
  ));
}

// ❌ AVOID: Unnecessary relationship depth for simple lookups
const result = await client.domain('example.com', {
  relationshipDepth: 3 // Only use when you need deep relationship mapping
});
```

---

## 🔗 Related Methods & Concepts

### Complementary Methods
| Method | Use Case | Relation to `domain()` |
|--------|----------|------------------------|
| [`ip()`](ip.md) | Query IP registration data | Often used alongside domain lookups for network analysis |
| [`asn()`](asn.md) | Query autonomous system data | Complements domain data for infrastructure mapping |
| [`batchDomainLookup()`](../client.md#batchdomainlookup) | Bulk domain processing | Batch version of domain() for high-volume operations |
| [`detectAnomalies()`](../client.md#detectanomalies) | Identify suspicious patterns | Uses domain() results as input for analysis |

### Architectural Concepts
- [**Bootstrap Discovery**](../../core_concepts/discovery.md): How registry servers are located
- [**Normalization Pipeline**](../../core_concepts/normalization.md): How raw RDAP responses are transformed
- [**Caching Strategies**](../../core_concepts/caching.md): Performance optimization patterns
- [**Offline Mode**](../../core_concepts/offline_mode.md): Operating without connectivity

---

## 🧪 Testing Patterns

### Unit Testing with Mocks
```typescript
// Mock domain responses for testing
jest.mock('rdapify', () => ({
  RDAPClient: jest.fn().mockImplementation(() => ({
    domain: jest.fn().mockImplementation(async (domain) => {
      if (domain === 'example.com') {
        return {
          domain: 'example.com',
          nameservers: [{ hostname: 'a.iana-servers.net' }, { hostname: 'b.iana-servers.net' }],
          registrant: { name: 'REDACTED', organization: 'Internet Corporation for Assigned Names and Numbers' }
        };
      }
      throw new RDAPError('RDAP_NOT_FOUND', `Domain ${domain} not found`);
    })
  }))
}));

// Test case
test('handles domain lookup correctly', async () => {
  const client = new RDAPClient();
  const result = await client.domain('example.com');
  
  expect(result.domain).toBe('example.com');
  expect(result.nameservers).toHaveLength(2);
  expect(result.registrant.name).toBe('REDACTED');
});
```

### Integration Testing with Real Data
```typescript
describe('Domain Lookup Integration', () => {
  let client: RDAPClient;
  
  beforeAll(() => {
    client = new RDAPClient({
      cacheOptions: { ttl: 1 }, // Short TTL for testing
      timeout: 10000
    });
  });
  
  test('retrieves example.com registration data', async () => {
    const result = await client.domain('example.com');
    
    // Core structure validation
    expect(result).toHaveProperty('domain', 'example.com');
    expect(result).toHaveProperty('nameservers');
    expect(Array.isArray(result.nameservers)).toBe(true);
    
    // Privacy compliance validation
    expect(result.registrant).toHaveProperty('name', 'REDACTED');
    expect(result.registrant).toHaveProperty('email', expect.stringContaining('REDACTED'));
    
    // Business logic validation
    const expiration = result.events.find(e => e.action === 'expiration');
    expect(expiration).toBeDefined();
    expect(new Date(expiration?.date || '')).toBeGreaterThan(new Date());
  }, 15000); // Extended timeout for network requests
});
```

---

## 🔍 Debugging Tools

### Visual Debugger Integration
```typescript
// Enable debug mode for detailed query tracing
const result = await client.domain('example.com', {
  debug: {
    enabled: true,
    logLevel: 'trace',
    includeHeaders: true,
    includeTiming: true
  }
});

// Inspect query flow
console.log('Debug metadata:', result._metadata.debug);
/*
{
  bootstrapDiscovery: {
    duration: 120ms,
    registryUrl: 'https://rdap.verisign.com'
  },
  registryRequest: {
    duration: 280ms,
    statusCode: 200,
    headers: {
      'content-type': 'application/rdap+json',
      'ratelimit-limit': '100',
      'ratelimit-remaining': '99'
    }
  },
  normalization: {
    duration: 15ms,
    entitiesProcessed: 3
  }
}
*/
```

### CLI Debugging Command
```bash
# Debug domain lookup from command line
rdapify debug domain example.com --verbose --include-raw

# Output includes:
# - Raw RDAP response
# - Normalization steps
# - Privacy redaction markers
# - Timing breakdown
```

---

## 🌐 Protocol Compliance

### RFC Standards Implemented
- **RFC 7482**: RDAP Domain Name Query Format
- **RFC 7483**: JSON Responses for RDAP
- **RFC 8521**: Registration Data Access Protocol (RDAP) DNS Registry
- **RFC 9083**: RDAP Partial Response

### Registry-Specific Behavior
Different registries implement the RDAP protocol with variations. RDAPify normalizes these differences:

| Registry | Special Handling |
|----------|------------------|
| **Verisign** (.com/.net) | Handles complex status mappings, supports bootstrap redirection |
| **IANA** (.org) | Proper handling of international characters, enhanced privacy fields |
| **Nominet** (.uk) | Special handling of UK-specific fields and regulatory requirements |
| **DENIC** (.de) | German privacy law compliance (TMG/BDSG) with stricter redaction |
| **AFRINIC** | African regional registry with specific contact handling |

---

## 📚 Additional Resources

| Resource | Description | Link |
|----------|-------------|------|
| **Privacy Controls Guide** | Advanced PII redaction configuration | [../privacy-controls.md](../privacy-controls.md) |
| **Security Whitepaper** | Full security architecture documentation | [../../security/whitepaper.md](../../security/whitepaper.md) |
| **Test Vectors** | Standardized test cases for domain queries | [../../../test-vectors/domain-vectors.json](../../../test-vectors/domain-vectors.json) |
| **Relationship Mapping Guide** | Building entity relationship graphs | [../../guides/relationship-mapping.md](../../guides/relationship-mapping.md) |
| **WHOIS Fallback Strategy** | Legacy protocol compatibility | [../../guides/whois-fallback.md](../../guides/whois-fallback.md) |

---

## 🏷️ Method Specifications

| Property | Value |
|----------|-------|
| **Method Version** | 2.3.0 |
| **RFC Compliance** | RFC 7480 series |
| **Caching Support** | ✅ (In-memory, Redis, custom adapters) |
| **Offline Support** | ✅ (With staleness controls) |
| **GDPR Compliant** | ✅ (With redactPII: true) |
| **CCPA Compliant** | ✅ (With redactPII: true) |
| **Last Updated** | December 5, 2025 |
| **Benchmark Environment** | Node.js 18.17.0, AWS c5.large, Redis 7.0 |

> **🔐 Security Reminder:** The `domain()` method processes potentially sensitive registration data. Always maintain `redactPII: true` in production environments unless you have explicit legal basis and DPO approval to process unredacted personal information. When in doubt, keep privacy protections enabled.

[← Back to API Reference](../api-reference.md) | [Next: IP Method →](ip.md)

*Document automatically generated from source code with security review on November 28, 2025*