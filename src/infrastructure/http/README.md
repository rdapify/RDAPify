# HTTP Layer - Data Fetching & Discovery

HTTP layer handles RDAP server discovery, data fetching, and response normalization.

## Components

### Fetcher
**File:** `Fetcher.ts`  
**Purpose:** HTTP client for RDAP queries with security features

**Features:**
- HTTPS-only requests
- Configurable timeouts (connect, request, DNS)
- SSRF protection integration
- Manual redirect handling
- Proper error types
- Custom headers support

**Usage:**
```typescript
const fetcher = new Fetcher({
  timeout: {
    connect: 5000,
    request: 10000,
    dns: 3000
  },
  userAgent: 'RDAPify/0.1.0',
  followRedirects: true,
  maxRedirects: 5,
  ssrfProtection: new SSRFProtection()
});

const response = await fetcher.fetch('https://rdap.verisign.com/com/v1/domain/example.com');
```

**Request Flow:**
1. SSRF validation of URL
2. Prepare headers (User-Agent, Accept)
3. Make request with timeout
4. Handle redirects (with SSRF checks on each redirect)
5. Parse JSON response
6. Return raw RDAP data

**Headers:**
- `User-Agent`: Identifies client
- `Accept`: `application/rdap+json, application/json`
- Custom headers from configuration

**Error Types:**
- `TimeoutError` - Request exceeded timeout
- `NetworkError` - Network connectivity issues
- `RDAPServerError` - Server returned 4xx or 5xx
- `SSRFProtectionError` - Security validation failed

### BootstrapDiscovery
**File:** `BootstrapDiscovery.ts`  
**Purpose:** Discover appropriate RDAP server using IANA bootstrap

**Features:**
- Query IANA bootstrap registries
- Cache bootstrap data (24 hours)
- Support domain, IPv4, IPv6, ASN queries
- CIDR range matching for IPs
- Automatic fallback to first server

**Usage:**
```typescript
const bootstrap = new BootstrapDiscovery(
  'https://data.iana.org/rdap',
  fetcher
);

// Discover servers
const domainServer = await bootstrap.discoverDomain('example.com');
// Returns: "https://rdap.verisign.com/com/v1"

const ipv4Server = await bootstrap.discoverIPv4('8.8.8.8');
// Returns: "https://rdap.arin.net/registry"

const ipv6Server = await bootstrap.discoverIPv6('2001:4860:4860::8888');
// Returns: "https://rdap.arin.net/registry"

const asnServer = await bootstrap.discoverASN(15169);
// Returns: "https://rdap.arin.net/registry"
```

**Bootstrap Sources:**
- DNS: `https://data.iana.org/rdap/dns.json`
- IPv4: `https://data.iana.org/rdap/ipv4.json`
- IPv6: `https://data.iana.org/rdap/ipv6.json`
- ASN: `https://data.iana.org/rdap/asn.json`

**Discovery Process:**

**For Domains:**
1. Extract TLD from domain (e.g., "com" from "example.com")
2. Check cache for DNS bootstrap data
3. Fetch from IANA if not cached
4. Match TLD against patterns
5. Return first matching server URL

**For IPs:**
1. Validate IP format
2. Check cache for IPv4/IPv6 bootstrap data
3. Fetch from IANA if not cached
4. Match IP against CIDR ranges
5. Return first matching server URL

**For ASNs:**
1. Normalize ASN (remove "AS" prefix)
2. Check cache for ASN bootstrap data
3. Fetch from IANA if not cached
4. Match ASN against ranges
5. Return first matching server URL

**Caching:**
- Bootstrap data cached for 24 hours
- Reduces load on IANA servers
- Improves performance significantly
- Manual cache clearing: `bootstrap.clearCache()`

**Statistics:**
```typescript
const stats = bootstrap.getCacheStats();
// { size: 4, types: ['dns', 'ipv4', 'ipv6', 'asn'] }
```

### Normalizer
**File:** `Normalizer.ts`  
**Purpose:** Transform raw RDAP responses to standardized format

**Features:**
- JSONPath-based field extraction
- Consistent field naming across registries
- Handle missing data gracefully
- Add metadata (query, source, cached status)
- Optional raw response inclusion
- Support all RDAP object types

**Usage:**
```typescript
const normalizer = new Normalizer();

const normalized = normalizer.normalize(
  rawResponse,           // Raw RDAP response
  'example.com',         // Query string
  'https://rdap.verisign.com/com/v1',  // Source server
  false,                 // Cached flag
  false                  // Include raw response
);
```

**Normalization Process:**
1. Detect object type (domain, ip network, autnum)
2. Extract fields using JSONPath expressions
3. Transform to standard format
4. Add metadata
5. Handle arrays and nested objects
6. Return normalized response

**Field Mappings:**

**Common Fields:**
- `objectClass` - Object type
- `handle` - Object identifier
- `status` - Status codes array
- `entities` - Related entities (registrar, contacts)
- `events` - Lifecycle events (registration, expiration, etc.)
- `links` - Related links
- `remarks` - Additional information

**Domain-Specific:**
- `ldhName` - Domain name (ASCII)
- `unicodeName` - Domain name (Unicode/IDN)
- `nameservers` - DNS servers array

**IP-Specific:**
- `startAddress` - Start of IP range
- `endAddress` - End of IP range
- `ipVersion` - IP version (v4 or v6)
- `name` - Network name
- `type` - Allocation type
- `country` - Country code

**ASN-Specific:**
- `startAutnum` - Start of ASN range
- `endAutnum` - End of ASN range
- `name` - AS name
- `type` - Allocation type

**Metadata:**
- `_meta.query` - Original query
- `_meta.source` - RDAP server URL
- `_meta.cached` - Whether response was cached
- `_meta.timestamp` - Query timestamp
- `_raw` - Raw response (if includeRaw=true)

**Example Output:**
```json
{
  "objectClass": "domain",
  "handle": "EXAMPLE-COM",
  "ldhName": "example.com",
  "status": ["active"],
  "nameservers": [
    { "ldhName": "ns1.example.com" },
    { "ldhName": "ns2.example.com" }
  ],
  "entities": [
    {
      "objectClass": "entity",
      "handle": "REGISTRAR-123",
      "roles": ["registrar"],
      "vcardArray": [...]
    }
  ],
  "events": [
    {
      "eventAction": "registration",
      "eventDate": "2000-01-01T00:00:00Z"
    }
  ],
  "_meta": {
    "query": "example.com",
    "source": "https://rdap.verisign.com/com/v1",
    "cached": false,
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

## Interfaces

### IFetcherPort
```typescript
interface IFetcherPort {
  fetch(url: string): Promise<RawRDAPResponse>;
}
```

### IBootstrapPort
```typescript
interface IBootstrapPort {
  discoverDomain(domain: string): Promise<string>;
  discoverIPv4(ip: string): Promise<string>;
  discoverIPv6(ip: string): Promise<string>;
  discoverASN(asn: number): Promise<string>;
  clearCache(): void;
}
```

### INormalizerPort
```typescript
interface INormalizerPort {
  normalize(
    raw: RawRDAPResponse,
    query: string,
    source: string,
    cached: boolean,
    includeRaw: boolean
  ): RDAPResponse;
}
```

## Error Handling

### Fetcher Errors
- `TimeoutError` - Request timeout (retryable)
- `NetworkError` - Network issues (retryable)
- `RDAPServerError` - Server errors (may be retryable)
- `SSRFProtectionError` - Security violation (not retryable)

### Bootstrap Errors
- `NoServerFoundError` - No RDAP server found for query
- `NetworkError` - Failed to fetch bootstrap data

### Normalizer Errors
- `NormalizationError` - Invalid response format
- `ValidationError` - Missing required fields

## Performance

### Fetcher
- Connection pooling via fetch API
- Configurable timeouts prevent hanging
- Parallel requests supported
- Redirect limit prevents loops

### Bootstrap
- 24-hour cache reduces IANA load
- O(n) lookup (n = number of patterns)
- Typically <100 patterns per registry
- Fast CIDR matching for IPs

### Normalizer
- JSONPath extraction is fast
- No heavy transformations
- Minimal memory allocation
- Handles large responses efficiently

## Security

### HTTPS Only
All requests must use HTTPS protocol

### SSRF Protection
- Integrated with SSRFProtection class
- Validates URLs before requests
- Checks redirects for SSRF

### Redirect Handling
- Manual redirect handling
- SSRF check on each redirect
- Configurable max redirects (default: 5)

### Input Validation
- URL format validation
- IP address validation
- Domain validation

## Testing

### Unit Tests
```typescript
describe('Fetcher', () => {
  it('should fetch RDAP data', async () => {
    const fetcher = new Fetcher();
    const response = await fetcher.fetch(url);
    expect(response).toHaveProperty('objectClass');
  });
  
  it('should timeout after configured time', async () => {
    const fetcher = new Fetcher({ timeout: { request: 100 } });
    await expect(fetcher.fetch(slowUrl)).rejects.toThrow(TimeoutError);
  });
});

describe('BootstrapDiscovery', () => {
  it('should discover domain server', async () => {
    const bootstrap = new BootstrapDiscovery();
    const server = await bootstrap.discoverDomain('example.com');
    expect(server).toContain('rdap');
  });
  
  it('should cache bootstrap data', async () => {
    const bootstrap = new BootstrapDiscovery();
    await bootstrap.discoverDomain('example.com');
    const stats = bootstrap.getCacheStats();
    expect(stats.types).toContain('dns');
  });
});

describe('Normalizer', () => {
  it('should normalize domain response', () => {
    const normalizer = new Normalizer();
    const normalized = normalizer.normalize(rawDomain, 'example.com', server, false, false);
    expect(normalized.objectClass).toBe('domain');
    expect(normalized.ldhName).toBe('example.com');
  });
});
```

## Related

- **Port Interfaces**: `src/core/ports/`
- **SSRF Protection**: `src/infrastructure/security/SSRFProtection.ts`
- **Error Types**: `src/shared/errors/`
- **Validators**: `src/shared/utils/validators/`

---

**Implements**: `IFetcherPort`, `IBootstrapPort`, `INormalizerPort`  
**Used by**: Application layer (QueryOrchestrator)  
**Status**: Fully implemented and tested
