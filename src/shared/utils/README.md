# Utilities

Reusable utility functions for validation, formatting, and common operations.

## Directory Structure

```
utils/
├── validators/         # Input validation
│   ├── domain.ts      # Domain validation
│   ├── ip.ts          # IP validation
│   ├── asn.ts         # ASN validation
│   ├── network.ts     # Network utilities
│   └── index.ts
├── helpers/           # Helper functions
│   ├── async.ts       # Async utilities
│   ├── cache.ts       # Cache utilities
│   ├── format.ts      # Formatting
│   ├── http.ts        # HTTP utilities
│   ├── object.ts      # Object utilities
│   ├── runtime.ts     # Runtime detection
│   ├── string.ts      # String utilities
│   └── index.ts
└── formatters/        # Data formatters (future)
```

## Validators

### Domain Validation (`validators/domain.ts`)

**Functions:**
- `validateDomain(domain: string): void` - Validate domain format
- `normalizeDomain(domain: string): string` - Normalize domain to lowercase

**Rules:**
- Must contain at least one dot
- No consecutive dots
- Valid characters: a-z, 0-9, hyphen, dot
- No leading/trailing hyphens in labels
- Maximum 253 characters total
- Maximum 63 characters per label

**Examples:**
```typescript
// Valid domains
validateDomain('example.com');
validateDomain('subdomain.example.com');
validateDomain('example.co.uk');

// Invalid domains
validateDomain('invalid..com');      // Throws: consecutive dots
validateDomain('-invalid.com');      // Throws: leading hyphen
validateDomain('no-tld');            // Throws: no dot

// Normalization
normalizeDomain('EXAMPLE.COM');      // Returns: 'example.com'
normalizeDomain('example.com.');     // Returns: 'example.com' (removes trailing dot)
```

### IP Validation (`validators/ip.ts`)

**Functions:**
- `validateIP(ip: string): 'v4' | 'v6'` - Validate IP and return version
- `validateIPv4(ip: string): void` - Validate IPv4 format
- `validateIPv6(ip: string): void` - Validate IPv6 format
- `normalizeIP(ip: string): string` - Normalize IP address

**IPv4 Rules:**
- Four octets separated by dots
- Each octet: 0-255
- No leading zeros (except for 0)

**IPv6 Rules:**
- Eight groups of hex digits
- Groups separated by colons
- Supports :: compression
- Supports IPv4-mapped format

**Examples:**
```typescript
// IPv4
validateIP('8.8.8.8');               // Returns: 'v4'
validateIPv4('192.168.1.1');         // OK
validateIPv4('256.1.1.1');           // Throws: octet > 255

// IPv6
validateIP('2001:4860:4860::8888');  // Returns: 'v6'
validateIPv6('::1');                 // OK (localhost)
validateIPv6('fe80::1');             // OK (link-local)

// Normalization
normalizeIP('8.8.8.8');              // Returns: '8.8.8.8'
normalizeIP('2001:4860:4860::8888'); // Returns normalized form
```

### ASN Validation (`validators/asn.ts`)

**Functions:**
- `validateASN(asn: string | number): number` - Validate and parse ASN
- `normalizeASN(asn: string | number): string` - Normalize to 'AS' format

**Rules:**
- Range: 0 to 4,294,967,295 (32-bit)
- Accepts: number, 'AS12345', '12345'
- Returns: numeric value

**Examples:**
```typescript
// Valid ASNs
validateASN(15169);                  // Returns: 15169
validateASN('AS15169');              // Returns: 15169
validateASN('15169');                // Returns: 15169

// Invalid ASNs
validateASN(-1);                     // Throws: negative
validateASN(4294967296);             // Throws: too large

// Normalization
normalizeASN(15169);                 // Returns: 'AS15169'
normalizeASN('AS15169');             // Returns: 'AS15169'
normalizeASN('15169');               // Returns: 'AS15169'
```

### Network Utilities (`validators/network.ts`)

**Functions:**
- `isPrivateIP(ip: string): boolean` - Check if IP is private (RFC 1918)
- `isLocalhost(ip: string): boolean` - Check if IP is localhost
- `isLinkLocal(ip: string): boolean` - Check if IP is link-local

**Private IP Ranges (RFC 1918):**
- `10.0.0.0/8`
- `172.16.0.0/12`
- `192.168.0.0/16`

**Examples:**
```typescript
// Private IPs
isPrivateIP('192.168.1.1');          // Returns: true
isPrivateIP('10.0.0.1');             // Returns: true
isPrivateIP('8.8.8.8');              // Returns: false

// Localhost
isLocalhost('127.0.0.1');            // Returns: true
isLocalhost('::1');                  // Returns: true (IPv6)
isLocalhost('8.8.8.8');              // Returns: false

// Link-local
isLinkLocal('169.254.1.1');          // Returns: true (APIPA)
isLinkLocal('fe80::1');              // Returns: true (IPv6)
```

## Helpers

### Async Utilities (`helpers/async.ts`)

**Functions:**
- `calculateBackoff(attempt, strategy, initial, max): number` - Calculate retry delay
- `sleep(ms: number): Promise<void>` - Async sleep
- `createTimeout(ms, message): Promise<never>` - Create timeout promise
- `withTimeout<T>(promise, ms, message): Promise<T>` - Wrap promise with timeout

**Backoff Strategies:**
- `exponential` - delay * (2 ^ attempt)
- `linear` - delay * attempt
- `fixed` - constant delay

**Examples:**
```typescript
// Backoff calculation
calculateBackoff(1, 'exponential', 1000, 10000);  // Returns: 2000
calculateBackoff(2, 'exponential', 1000, 10000);  // Returns: 4000
calculateBackoff(3, 'exponential', 1000, 10000);  // Returns: 8000
calculateBackoff(4, 'exponential', 1000, 10000);  // Returns: 10000 (capped)

// Sleep
await sleep(1000);  // Wait 1 second

// Timeout wrapper
try {
  const result = await withTimeout(
    fetch(url),
    5000,
    'Request timeout'
  );
} catch (error) {
  // TimeoutError thrown after 5 seconds
}
```

### String Utilities (`helpers/string.ts`)

**Functions:**
- `extractTLD(domain: string): string` - Extract top-level domain
- `sanitizeUrl(url: string): string` - Clean and validate URL
- `truncate(str: string, length: number): string` - Truncate with ellipsis

**Examples:**
```typescript
// TLD extraction
extractTLD('example.com');           // Returns: 'com'
extractTLD('subdomain.example.co.uk'); // Returns: 'co.uk'
extractTLD('example.com.');          // Returns: 'com'

// URL sanitization
sanitizeUrl('https://example.com/path?query=1');

// Truncation
truncate('Long text here', 10);      // Returns: 'Long te...'
truncate('Short', 10);               // Returns: 'Short'
```

### Object Utilities (`helpers/object.ts`)

**Functions:**
- `isPlainObject(value: any): boolean` - Check if value is plain object
- `deepMerge<T>(target: T, source: Partial<T>): T` - Deep merge objects

**Examples:**
```typescript
// Plain object check
isPlainObject({});                   // Returns: true
isPlainObject({ a: 1 });             // Returns: true
isPlainObject([]);                   // Returns: false
isPlainObject(null);                 // Returns: false
isPlainObject(new Date());           // Returns: false

// Deep merge
const merged = deepMerge(
  { a: 1, b: { c: 2 } },
  { b: { d: 3 }, e: 4 }
);
// Returns: { a: 1, b: { c: 2, d: 3 }, e: 4 }
```

### Cache Utilities (`helpers/cache.ts`)

**Functions:**
- `generateCacheKey(type: string, value: string): string` - Generate cache key

**Format:** `{type}:{normalized_value}`

**Examples:**
```typescript
generateCacheKey('domain', 'example.com');  // Returns: 'domain:example.com'
generateCacheKey('ip', '8.8.8.8');          // Returns: 'ip:8.8.8.8'
generateCacheKey('asn', 'AS15169');         // Returns: 'asn:as15169'
```

### HTTP Utilities (`helpers/http.ts`)

**Functions:**
- `parseRetryAfter(header: string): number` - Parse Retry-After header

**Formats:**
- Seconds: `"120"`
- HTTP date: `"Wed, 21 Oct 2015 07:28:00 GMT"`

**Examples:**
```typescript
parseRetryAfter('120');              // Returns: 120
parseRetryAfter('Wed, 21 Oct 2015 07:28:00 GMT');  // Returns: seconds until date
```

### Format Utilities (`helpers/format.ts`)

**Functions:**
- `formatBytes(bytes: number): string` - Format bytes to human-readable
- `formatDuration(ms: number): string` - Format milliseconds to duration

**Examples:**
```typescript
// Bytes
formatBytes(1024);                   // Returns: '1.00 KB'
formatBytes(1048576);                // Returns: '1.00 MB'
formatBytes(1073741824);             // Returns: '1.00 GB'

// Duration
formatDuration(1000);                // Returns: '1s'
formatDuration(65000);               // Returns: '1m 5s'
formatDuration(3665000);             // Returns: '1h 1m 5s'
```

### Runtime Detection (`helpers/runtime.ts`)

**Functions:**
- `isNode(): boolean` - Check if running in Node.js
- `isBrowser(): boolean` - Check if running in browser
- `isDeno(): boolean` - Check if running in Deno
- `isBun(): boolean` - Check if running in Bun
- `getRuntimeName(): string` - Get runtime name

**Examples:**
```typescript
if (isNode()) {
  // Node.js-specific code
}

if (isBrowser()) {
  // Browser-specific code
}

const runtime = getRuntimeName();  // Returns: 'node' | 'browser' | 'deno' | 'bun'
```

## Testing

### Validator Tests
```typescript
describe('validateDomain', () => {
  it('should accept valid domains', () => {
    expect(() => validateDomain('example.com')).not.toThrow();
  });
  
  it('should reject invalid domains', () => {
    expect(() => validateDomain('invalid..com')).toThrow(ValidationError);
  });
});
```

### Helper Tests
```typescript
describe('calculateBackoff', () => {
  it('should calculate exponential backoff', () => {
    expect(calculateBackoff(1, 'exponential', 1000, 10000)).toBe(2000);
  });
  
  it('should cap at max delay', () => {
    expect(calculateBackoff(10, 'exponential', 1000, 10000)).toBe(10000);
  });
});
```

## Performance

### Validators
- Domain: ~0.01ms
- IP: ~0.01ms
- ASN: ~0.01ms

### Helpers
- Deep merge: ~0.1ms (small objects)
- Cache key: ~0.01ms
- String ops: ~0.01ms

## Related

- **Shared Layer**: `src/shared/README.md`
- **Error Types**: `src/shared/errors/`
- **Type Definitions**: `src/shared/types/`

---

**Purpose**: Reusable utility functions  
**Dependencies**: None  
**Status**: Fully implemented and tested
