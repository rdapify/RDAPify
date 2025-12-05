# 📚 RDAPClient API Reference

> **🎯 Purpose:** Complete reference for the RDAPClient class, including constructor options, methods, and configuration parameters  
> **📚 Related:** [Privacy Controls](./privacy-controls.md) | [Types Reference](../types/index.md) | [Methods Reference](../methods/domain.md)  
> **⏱️ Reading Time:** 8 minutes  
> **🔍 Pro Tip:** Use the [Visual Debugger](../../playground/visual-debugger.md) to interactively explore API behavior with real examples

---

## 🌐 Class Overview

The `RDAPClient` is the primary interface for interacting with RDAP (Registration Data Access Protocol) services. It provides a privacy-aware, high-performance client for querying domain, IP, and autonomous system registration data with built-in compliance controls.

```typescript
import { RDAPClient } from 'rdapify';

// Basic usage
const client = new RDAPClient({
  redactPII: true,
  cacheOptions: {
    ttl: 3600
  }
});

// With advanced configuration
const enterpriseClient = new RDAPClient({
  redactPII: true,
  timeout: 8000,
  retries: 3,
  cacheAdapter: new RedisAdapter({
    redactBeforeStore: true,
    encryptionKey: process.env.CACHE_KEY
  }),
  telemetry: {
    enabled: true,
    anonymize: true
  }
});
```

### 🔐 Security Defaults
The client is configured with **privacy-protecting defaults** that comply with GDPR/CCPA requirements:
- ✅ PII redaction enabled by default
- ✅ TLS 1.3+ enforcement
- ✅ SSRF protection enabled
- ✅ Cache data redaction before storage
- ✅ No telemetry collection by default

---

## ⚙️ Constructor Options

### Basic Configuration
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `redactPII` | `boolean` | `true` | Enable automatic PII redaction for GDPR/CCPA compliance |
| `timeout` | `number` | `8000` | Request timeout in milliseconds |
| `retries` | `number` | `2` | Number of retry attempts for failed requests |
| `userAgent` | `string` | `'rdapify/{version}'` | User-agent header for registry identification |

### Security Configuration
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `blockPrivateIPs` | `boolean` | `true` | Block requests to private IP ranges (RFC 1918) |
| `blockCloudMeta` | `boolean` | `true` | Block access to cloud metadata endpoints |
| `tlsOptions` | `TLSOptions` | `{ minVersion: 'TLSv1.3' }` | TLS security configuration |
| `certificatePins` | `Record<string, string[]>` | `{}` | Certificate pins for critical registry endpoints |

### Caching Configuration
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cacheOptions` | `CacheOptions` | `{ ttl: 3600, max: 1000 }` | Default cache settings for memory cache |
| `cacheAdapter` | `CacheAdapter` | `MemoryAdapter` | Custom cache adapter implementation |
| `bootstrapCache` | `BootstrapCacheOptions` | `{ enabled: true, maxAge: 86400 }` | Bootstrap data caching configuration |

### Advanced Configuration
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `fetcher` | `Fetcher` | `SecureFetcher` | Custom HTTP fetcher implementation |
| `normalizer` | `Normalizer` | `StandardNormalizer` | Custom response normalization |
| `telemetry` | `TelemetryOptions` | `{ enabled: false }` | Anonymous usage statistics collection |
| `offlineMode` | `OfflineModeOptions` | `{ enabled: false }` | Offline operation configuration |

```typescript
interface RDAPClientOptions {
  // Basic configuration
  redactPII?: boolean;
  timeout?: number;
  retries?: number;
  userAgent?: string;
  
  // Security configuration
  blockPrivateIPs?: boolean;
  blockCloudMeta?: boolean;
  tlsOptions?: {
    minVersion?: string;
    rejectUnauthorized?: boolean;
    ca?: string | string[];
    ciphers?: string;
  };
  certificatePins?: Record<string, string[]>; // { hostname: [sha256 pins] }
  
  // Caching configuration
  cacheOptions?: {
    ttl?: number;       // seconds
    max?: number;       // max items
    maxAge?: number;    // max age in ms
  };
  cacheAdapter?: CacheAdapter;
  bootstrapCache?: {
    enabled?: boolean;
    path?: string;
    maxAge?: number;
    autoUpdate?: boolean;
  };
  
  // Advanced configuration
  fetcher?: Fetcher;
  normalizer?: Normalizer;
  telemetry?: {
    enabled?: boolean;
    anonymize?: boolean;
    endpoint?: string;
    sampleRate?: number;
  };
  offlineMode?: {
    enabled?: boolean;
    maxStaleAge?: number;
    criticalDomains?: string[];
    backgroundSync?: boolean;
  };
}
```

---

## 📡 Instance Methods

### `domain()`
Query domain registration data with privacy protections.

**Signature:**
```typescript
async domain(
  query: string, 
  options?: DomainQueryOptions
): Promise<DomainResponse>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | `string` | ✅ | Domain name to query (e.g., 'example.com') |
| `options` | `DomainQueryOptions` | ❌ | Query-specific options |

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `redactPII` | `boolean` | Client default | Override PII redaction for this query |
| `includeRaw` | `boolean` | `false` | Include raw RDAP response (⚠️ security risk) |
| `registryUrl` | `string` | Auto-discovered | Override registry URL |
| `maxStaleness` | `number` | `0` | Maximum acceptable data staleness in seconds for offline mode |

**Returns:**
`Promise<DomainResponse>` - Normalized domain registration data with PII redaction applied.

**Example:**
```typescript
const result = await client.domain('example.com', {
  redactPII: true,
  maxStaleness: 86400 // Accept data up to 24h stale in offline mode
});

console.log('Domain:', result.domain);
console.log('Nameservers:', result.nameservers.map(ns => ns.hostname));
console.log('Registrant:', result.registrant); // { name: 'REDACTED', email: 'REDACTED@redacted.invalid' }
```

### `ip()`
Query IP address registration data.

**Signature:**
```typescript
async ip(
  query: string | number[], 
  options?: IPQueryOptions
): Promise<IPResponse>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | `string \| number[]` | ✅ | IP address (IPv4/v6) or CIDR range |
| `options` | `IPQueryOptions` | ❌ | Query-specific options |

**Example:**
```typescript
// Single IP lookup
const ipResult = await client.ip('8.8.8.8');
console.log('Organization:', ipResult.entity.name);
console.log('Country:', ipResult.country);
console.log('CIDR Range:', ipResult.cidr);

// CIDR range lookup
const rangeResult = await client.ip('2001:4860::/32');
```

### `asn()`
Query autonomous system number registration data.

**Signature:**
```typescript
async asn(
  query: number | string, 
  options?: ASNQueryOptions
): Promise<ASNResponse>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | `number \| string` | ✅ | ASN (e.g., 15169) |
| `options` | `ASNQueryOptions` | ❌ | Query-specific options |

**Example:**
```typescript
const asnResult = await client.asn(15169);
console.log('Organization:', asnResult.entity.name);
console.log('IP Ranges:', asnResult.ipRanges);
console.log('Country:', asnResult.country);
```

### `batchDomainLookup()`
Perform batch lookup of multiple domains with concurrency control.

**Signature:**
```typescript
async batchDomainLookup(
  domains: string[], 
  options?: BatchDomainOptions
): Promise<BatchDomainResult>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `domains` | `string[]` | ✅ | Array of domain names to query |
| `options` | `BatchDomainOptions` | ❌ | Batch processing options |

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `concurrency` | `number` | `5` | Maximum concurrent requests |
| `throttleMs` | `number` | `1000` | Minimum delay between requests in milliseconds |
| `stopOnError` | `boolean` | `false` | Stop processing on first error |
| `partialResults` | `boolean` | `true` | Return results for successful queries even if some fail |

**Returns:**
```typescript
interface BatchDomainResult {
  successful: { domain: string; result: DomainResponse }[];
  failed: { domain: string; error: RDAPError }[];
  summary: {
    total: number;
    successCount: number;
    failureCount: number;
    averageLatency: number;
  };
}
```

**Example:**
```typescript
const domains = ['example.com', 'google.com', 'facebook.com'];
const batchResult = await client.batchDomainLookup(domains, {
  concurrency: 3,
  throttleMs: 2000,
  stopOnError: false
});

console.log(`Successfully processed ${batchResult.successful.length} domains`);
console.log(`Failed domains: ${batchResult.failed.map(f => f.domain).join(', ')}`);
```

### `clearCache()`
Clear all cached data for privacy compliance or troubleshooting.

**Signature:**
```typescript
async clearCache(options?: CacheClearOptions): Promise<CacheClearResult>
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `byDomain` | `string \| string[]` | ❌ | Clear cache for specific domains |
| `byIPRange` | `string` | ❌ | Clear cache for IP range (CIDR notation) |
| `byASN` | `number \| number[]` | ❌ | Clear cache for specific ASNs |
| `preserveCritical` | `boolean` | `false` | Preserve critical domain cache entries |
| `force` | `boolean` | `false` | Force clear even if cache is shared |

**Example:**
```typescript
// Clear all cache
await client.clearCache();

// Clear specific domain cache
await client.clearCache({ byDomain: ['example.com', 'example.net'] });

// GDPR right to erasure
await client.clearCache({ byDomain: 'user-controlled-domain.com' });

// CCPA deletion request
await client.ccpaDelete('user@example.com');
```

---

## 🔧 Utility Methods

### `detectAnomalies()`
Enterprise feature for detecting unusual registration patterns.

**Signature:**
```typescript
detectAnomalies(
  results: (DomainResponse | IPResponse | ASNResponse)[],
  options?: AnomalyDetectionOptions
): AnomalyReport
```

**Example:**
```typescript
const domains = await Promise.all([
  client.domain('example.com'),
  client.domain('google.com'),
  client.domain('newly-registered-domain-12345.com')
]);

const anomalies = client.detectAnomalies(domains, {
  sensitivity: 'high',
  patterns: ['recent-registration', 'suspicious-nameservers']
});

if (anomalies.suspiciousDomains.length > 0) {
  console.log('Suspicious domains detected:', anomalies.suspiciousDomains);
}
```

### `mapRelationships()`
Build relationship graphs between domains, registrants, and networks.

**Signature:**
```typescript
mapRelationships(
  results: (DomainResponse | IPResponse | ASNResponse)[],
  options?: RelationshipMappingOptions
): RelationshipGraph
```

**Example:**
```typescript
const domains = await Promise.all([
  client.domain('example.com'),
  client.domain('example.net'),
  client.ip('93.184.216.34')
]);

const graph = client.mapRelationships(domains, {
  maxDepth: 2,
  includePII: false // Always false in production
});

// Visualize relationships
console.log('Nodes:', graph.nodes.length);
console.log('Edges:', graph.edges.length);
```

### `getCacheStats()`
Get detailed cache performance statistics.

**Signature:**
```typescript
getCacheStats(): CacheStatistics
```

**Returns:**
```typescript
interface CacheStatistics {
  hits: number;
  misses: number;
  hitRate: number;
  entries: number;
  sizeInBytes: number;
  averageLatency: number;
  evictions: number;
  purgeCount: number;
}
```

---

## 🛡️ Security and Compliance Methods

### `gdprErase()`
GDPR Article 17 right to erasure implementation.

**Signature:**
```typescript
async gdprErase(identifier: string): Promise<GDPREraseResult>
```

**Example:**
```typescript
// Erase all data related to a domain
await client.gdprErase('personal-domain.tld');

// Erase by email address
await client.gdprErase('user@example.com');
```

### `ccpaDelete()`
CCPA Section 1798.105 deletion request handler.

**Signature:**
```typescript
async ccpaDelete(identifier: string): Promise<CCPADeleteResult>
```

**Example:**
```typescript
// CCPA deletion request
await client.ccpaDelete('user@example.com');
```

### `restrictDomain()`
Restrict processing of a domain for compliance.

**Signature:**
```typescript
async restrictDomain(
  domain: string, 
  options?: RestrictionOptions
): Promise<RestrictionResult>
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `reason` | `'consent-withdrawn' \| 'legal-basis-lost' \| 'opt-out'` | `'consent-withdrawn'` | Reason for restriction |
| `duration` | `number` | `Infinity` | Duration of restriction in seconds |
| `scope` | `'read' \| 'write' \| 'all'` | `'all'` | Scope of restriction |

---

## ⚠️ Error Handling

RDAPify throws standardized errors that can be caught and handled appropriately:

```typescript
try {
  const result = await client.domain('non-existent-domain-123456789.com');
} catch (error) {
  if (error.code === 'RDAP_NOT_FOUND') {
    console.log('Domain not found in RDAP system');
  } else if (error.code === 'RDAP_RATE_LIMITED') {
    console.log(`Rate limited. Retry after: ${error.details.retryAfter} seconds`);
  } else if (error.code === 'RDAP_TIMEOUT') {
    console.log('Request timed out');
  } else if (error.code === 'RDAP_SSRF_ATTEMPT') {
    console.error('Security violation: SSRF attempt blocked');
    // Report to security team
  } else {
    console.error('Unexpected error:', error.message);
  }
}
```

### Common Error Codes
| Code | Description | Retryable | Security Critical |
|------|-------------|-----------|-------------------|
| `RDAP_NOT_FOUND` | Resource not found in registry | ❌ | ❌ |
| `RDAP_RATE_LIMITED` | Registry rate limit exceeded | ✅ | ❌ |
| `RDAP_TIMEOUT` | Request timed out | ✅ | ❌ |
| `RDAP_REGISTRY_UNAVAILABLE` | Registry server unavailable | ✅ | ❌ |
| `RDAP_INVALID_RESPONSE` | Malformed registry response | ❌ | ❌ |
| `RDAP_BOOTSTRAP_FAILED` | Bootstrap data unavailable | ✅ | ❌ |
| `RDAP_SSRF_ATTEMPT` | Server-side request forgery attempt | ❌ | ✅ |
| `RDAP_TLS_ERROR` | TLS certificate validation failure | ❌ | ✅ |
| `RDAP_CACHE_ERROR` | Cache system failure | ✅ | ❌ |
| `RDAP_OFFLINE_MODE` | Offline mode restrictions | ❌ | ❌ |

---

## ⚡ Performance Considerations

### Caching Best Practices
```typescript
// ✅ GOOD: Use cache effectively
const client = new RDAPClient({
  cacheOptions: {
    ttl: 3600, // 1 hour for most domains
    max: 10000 // Cache 10,000 entries
  }
});

// ✅ GOOD: Preload critical domains
async function preloadCriticalDomains() {
  const criticalDomains = ['example.com', 'iana.org', 'icann.org'];
  await Promise.all(criticalDomains.map(domain => 
    client.domain(domain).catch(e => console.warn(`Preload failed for ${domain}:`, e))
  ));
}

// ❌ AVOID: Disabling cache for performance testing only
const testClient = new RDAPClient({
  cacheOptions: { ttl: 1 } // 1 second TTL for testing
});
```

### Connection Pooling
For high-volume applications, reuse client instances:

```typescript
// ✅ GOOD: Singleton pattern for high performance
class RDAPService {
  private static instance: RDAPClient;
  
  static getClient(): RDAPClient {
    if (!RDAPService.instance) {
      RDAPService.instance = new RDAPClient({
        cacheAdapter: new RedisAdapter({
          url: process.env.REDIS_URL,
          connectionPool: { min: 5, max: 50 }
        })
      });
    }
    return RDAPService.instance;
  }
}

// Usage
const client = RDAPService.getClient();
const result = await client.domain('example.com');
```

### Memory Management
For long-running processes, monitor memory usage:

```typescript
// Periodic cache cleanup
setInterval(async () => {
  const stats = client.getCacheStats();
  if (stats.sizeInBytes > 100 * 1024 * 1024) { // 100MB
    console.log('Cache size exceeds limit, performing cleanup');
    await client.clearCache({ preserveCritical: true });
  }
}, 3600000); // Every hour
```

---

## 🔐 Security Best Practices

### Critical Security Settings
```typescript
// ✅ Enterprise-grade security configuration
const secureClient = new RDAPClient({
  redactPII: true,
  blockPrivateIPs: true,
  blockCloudMeta: true,
  tlsOptions: {
    minVersion: 'TLSv1.3',
    rejectUnauthorized: true,
    // Use system CA store in production
    ca: fs.readFileSync('/etc/ssl/certs/ca-certificates.crt')
  },
  certificatePins: {
    'rdap.verisign.com': ['sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='],
    'rdap.arin.net': ['sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=']
  },
  cacheAdapter: new RedisAdapter({
    redactBeforeStore: true,
    encryptionKey: process.env.CACHE_ENCRYPTION_KEY,
    accessControls: {
      requireAuth: true,
      allowedIPs: ['10.0.0.0/24', '192.168.1.0/24']
    }
  }),
  telemetry: {
    enabled: true,
    anonymize: true,
    endpoint: 'https://your-telemetry-endpoint.com'
  }
});
```

### PII Redaction Verification
Always verify redaction is working correctly:

```typescript
// Test PII redaction
async function verifyRedaction() {
  const testResult = await client.domain('example.com');
  
  // Verify PII fields are redacted
  const piiFields = [
    testResult.registrant?.name,
    testResult.registrant?.email,
    testResult.registrant?.phone,
    testResult.administrativeContact?.name,
    testResult.technicalContact?.email
  ];
  
  const unredacted = piiFields.filter(field => 
    field && !field.toString().includes('REDACTED')
  );
  
  if (unredacted.length > 0) {
    throw new Error(`PII redaction failed for fields: ${unredacted.join(', ')}`);
  }
  
  console.log('✅ PII redaction verification passed');
}
```

### SSRF Protection Validation
Test SSRF protection mechanisms:

```typescript
// Verify SSRF protection
async function testSSRFProtection() {
  try {
    // Attempt to access internal IP
    await client.domain('127.0.0.1.xip.io');
    throw new Error('SSRF protection failed - internal IP was allowed');
  } catch (error) {
    if (error.code === 'RDAP_SSRF_ATTEMPT') {
      console.log('✅ SSRF protection working correctly');
    } else {
      throw new Error(`Unexpected error type: ${error.code}`);
    }
  }
}
```

---

## 🧪 Testing Patterns

### Unit Testing
```typescript
// Mock RDAP client for unit tests
jest.mock('rdapify', () => ({
  RDAPClient: jest.fn().mockImplementation(() => ({
    domain: jest.fn().mockResolvedValue({
      domain: 'example.com',
      nameservers: ['ns1.example.com', 'ns2.example.com'],
      registrant: { name: 'REDACTED', email: 'REDACTED@redacted.invalid' }
    }),
    ip: jest.fn().mockResolvedValue({
      entity: { name: 'Google LLC' },
      country: 'US',
      cidr: '8.8.8.0/24'
    })
  }))
}));

// Test usage
const client = new RDAPClient();
const result = await client.domain('example.com');
expect(result.registrant.name).toBe('REDACTED');
```

### Integration Testing
```typescript
// Integration test with real registry
describe('RDAPClient Integration', () => {
  let client: RDAPClient;
  
  beforeAll(() => {
    client = new RDAPClient({
      cacheOptions: { ttl: 1 }, // Short TTL for testing
      timeout: 10000
    });
  });
  
  test('queries example.com successfully', async () => {
    const result = await client.domain('example.com');
    
    expect(result.domain).toBe('example.com');
    expect(result.nameservers).toEqual(expect.arrayContaining([
      expect.objectContaining({ hostname: 'a.iana-servers.net' }),
      expect.objectContaining({ hostname: 'b.iana-servers.net' })
    ]));
    expect(result.registrant.name).toBe('REDACTED');
  }, 15000); // Longer timeout for network requests
});
```

---

## 📚 Related Documentation

| Document | Description | Path |
|----------|-------------|------|
| **Privacy Controls** | Advanced PII redaction configuration | [./privacy-controls.md](./privacy-controls.md) |
| **Domain Method** | Detailed domain query documentation | [../methods/domain.md](../methods/domain.md) |
| **IP Method** | Detailed IP query documentation | [../methods/ip.md](../methods/ip.md) |
| **ASN Method** | Detailed ASN query documentation | [../methods/asn.md](../methods/asn.md) |
| **Types Reference** | Complete type definitions | [../types/index.md](../types/index.md) |
| **Security Whitepaper** | Complete security architecture | [../../security/whitepaper.md](../../security/whitepaper.md) |
| **Caching Strategies** | Advanced caching configurations | [../../guides/caching-strategies.md](../../guides/caching-strategies.md) |
| **Error State Machine** | Detailed error handling flow | [../../core-concepts/error-state-machine.md](../../core-concepts/error-state-machine.md) |

---

## 🏷️ Version Information

| Property | Value |
|----------|-------|
| **Class Version** | 2.3.0 |
| **Minimum Node.js** | 18.0.0 |
| **TypeScript Support** | 5.0+ |
| **Last Updated** | December 5, 2025 |
| **RFC Compliance** | RFC 7480 series |

> **🔐 Critical Reminder:** The RDAPClient is designed with privacy-by-default. Never disable `redactPII` without documented legal basis and Data Protection Officer approval. When in doubt, keep privacy protections enabled.

[← Back to API Reference](../api-reference.md) | [Next: Privacy Controls →](./privacy-controls.md)

*Document generated automatically from source code with security review on November 28, 2025*