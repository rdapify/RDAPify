# Security Layer - Protection & Privacy

Security layer provides SSRF protection and PII redaction for secure and privacy-compliant operations.

## Components

### SSRFProtection
**File:** `SSRFProtection.ts`  
**Purpose:** Prevent Server-Side Request Forgery attacks

**Features:**
- HTTPS-only enforcement
- Private IP blocking (RFC 1918)
- Localhost blocking
- Link-local blocking
- Domain whitelist/blacklist
- DNS resolution validation
- Redirect validation

**Usage:**
```typescript
const protection = new SSRFProtection({
  enabled: true,
  blockPrivateIPs: true,
  blockLocalhost: true,
  blockLinkLocal: true,
  allowedDomains: ['rdap.verisign.com', 'rdap.arin.net'],
  blockedDomains: ['internal.company.com']
});

// Validate URL before making request
await protection.validateUrl('https://rdap.verisign.com/com/v1/domain/example.com');
// Throws SSRFProtectionError if validation fails
```

**Configuration:**
```typescript
interface SSRFProtectionOptions {
  enabled?: boolean;              // Enable/disable protection (default: true)
  blockPrivateIPs?: boolean;      // Block RFC 1918 IPs (default: true)
  blockLocalhost?: boolean;       // Block localhost (default: true)
  blockLinkLocal?: boolean;       // Block link-local (default: true)
  allowedDomains?: string[];      // Whitelist (takes precedence)
  blockedDomains?: string[];      // Blacklist
}
```

**Validation Process:**
1. Parse URL format
2. Enforce HTTPS protocol
3. Check domain whitelist (if configured)
4. Check domain blacklist
5. Validate IP address (if hostname is IP)
6. Resolve domain to IPs (if hostname is domain)
7. Check each resolved IP against blocked ranges

**Blocked IP Ranges:**

**IPv4:**
- `10.0.0.0/8` - Private network (RFC 1918)
- `172.16.0.0/12` - Private network (RFC 1918)
- `192.168.0.0/16` - Private network (RFC 1918)
- `127.0.0.0/8` - Localhost
- `169.254.0.0/16` - Link-local (APIPA)
- `0.0.0.0/8` - Current network
- `224.0.0.0/4` - Multicast
- `240.0.0.0/4` - Reserved

**IPv6:**
- `::1/128` - Localhost
- `fe80::/10` - Link-local
- `fc00::/7` - Unique local addresses
- `ff00::/8` - Multicast

**Whitelist Behavior:**
- If `allowedDomains` is configured, ONLY those domains are allowed
- Whitelist takes precedence over all other checks
- Subdomains are allowed (e.g., "verisign.com" allows "rdap.verisign.com")
- Case-insensitive matching

**Blacklist Behavior:**
- If `blockedDomains` is configured, those domains are blocked
- Applies after whitelist check
- Subdomains are blocked (e.g., "company.com" blocks "api.company.com")
- Case-insensitive matching

**Error Examples:**
```typescript
// Non-HTTPS protocol
await protection.validateUrl('http://example.com');
// Throws: "Only HTTPS protocol is allowed, got: http:"

// Private IP
await protection.validateUrl('https://192.168.1.1');
// Throws: "Private IP address blocked: 192.168.1.1"

// Localhost
await protection.validateUrl('https://localhost');
// Throws: "Localhost access blocked: localhost"

// Not in whitelist
await protection.validateUrl('https://evil.com');
// Throws: "Domain not in allowed list: evil.com"
```

### PIIRedactor
**File:** `PIIRedactor.ts`  
**Purpose:** Remove Personally Identifiable Information for GDPR/CCPA compliance

**Features:**
- Email redaction
- Phone number redaction
- Fax number redaction
- Address redaction
- Configurable fields
- vCard data handling
- Deep copy (no mutation)
- Recursive entity processing

**Usage:**
```typescript
const redactor = new PIIRedactor({
  redactPII: true,
  redactFields: ['email', 'phone', 'fax', 'adr'],
  redactionText: '[REDACTED]'
});

const redacted = redactor.redact(response);
```

**Configuration:**
```typescript
interface PrivacyOptions {
  redactPII?: boolean;           // Enable/disable redaction (default: true)
  redactFields?: string[];       // Fields to redact (default: ['email', 'phone', 'fax'])
  redactionText?: string;        // Replacement text (default: '[REDACTED]')
}
```

**Redaction Process:**
1. Deep copy response (avoid mutation)
2. Find all entities in response
3. Process vCard data in each entity
4. Redact configured fields
5. Recursively handle nested entities
6. Return redacted copy

**Default Redacted Fields:**
- `email` - Email addresses
- `phone` - Phone numbers (tel)
- `fax` - Fax numbers

**Additional Fields (optional):**
- `adr` - Physical addresses
- `fn` - Full name
- `org` - Organization

**vCard Format:**
```json
{
  "vcardArray": [
    "vcard",
    [
      ["version", {}, "text", "4.0"],
      ["fn", {}, "text", "John Doe"],
      ["email", {}, "text", "john@example.com"],
      ["tel", {"type": "voice"}, "uri", "tel:+1-555-1234"]
    ]
  ]
}
```

**After Redaction:**
```json
{
  "vcardArray": [
    "vcard",
    [
      ["version", {}, "text", "4.0"],
      ["fn", {}, "text", "John Doe"],
      ["email", {}, "text", "[REDACTED]"],
      ["tel", {"type": "voice"}, "uri", "[REDACTED]"]
    ]
  ]
}
```

**Field Matching:**
- Case-insensitive matching
- Partial matching (e.g., "email" matches "email", "e-mail")
- Handles vCard 3.0 and 4.0 formats

**Nested Entities:**
Recursively processes all entities:
```json
{
  "entities": [
    {
      "role": ["registrar"],
      "vcardArray": [...],  // Redacted
      "entities": [
        {
          "role": ["technical"],
          "vcardArray": [...]  // Also redacted
        }
      ]
    }
  ]
}
```

## Security Best Practices

### SSRF Protection
✅ **Always enable** in production
✅ **Use whitelist** when possible (most secure)
✅ **Block private IPs** to prevent internal network access
✅ **Validate redirects** to prevent bypass
✅ **Log violations** for security monitoring

### PII Redaction
✅ **Enable by default** for privacy compliance
✅ **Redact before caching** to avoid storing PII
✅ **Redact before logging** to avoid PII in logs
✅ **Configure fields** based on requirements
✅ **Document redaction** in privacy policy

### Defense in Depth
Multiple layers of protection:
1. SSRF validation before request
2. HTTPS-only enforcement
3. Redirect validation
4. PII redaction after response
5. Input validation throughout

## Compliance

### GDPR (General Data Protection Regulation)
✅ PII redaction by default
✅ Configurable redaction fields
✅ No PII in logs or cache
✅ Data minimization principle

### CCPA (California Consumer Privacy Act)
✅ PII protection
✅ Data access controls
✅ Opt-out support via configuration

### RFC 7480 (RDAP)
✅ Compliant with RDAP specification
✅ Preserves required fields
✅ Optional PII redaction

## Performance

### SSRF Protection
- URL parsing: ~0.01ms
- IP validation: ~0.01ms
- DNS resolution: ~10-50ms (cached by OS)
- Total overhead: ~10-50ms per request

### PII Redaction
- Deep copy: ~1-5ms (depends on response size)
- vCard processing: ~0.1ms per entity
- Total overhead: ~1-10ms per response

### Optimization
- DNS results cached by OS
- Deep copy only when redaction enabled
- Lazy evaluation where possible

## Testing

### SSRF Protection Tests
```typescript
describe('SSRFProtection', () => {
  it('should block private IPs', async () => {
    const protection = new SSRFProtection();
    await expect(
      protection.validateUrl('https://192.168.1.1')
    ).rejects.toThrow(SSRFProtectionError);
  });
  
  it('should allow whitelisted domains', async () => {
    const protection = new SSRFProtection({
      allowedDomains: ['example.com']
    });
    await expect(
      protection.validateUrl('https://example.com')
    ).resolves.not.toThrow();
  });
  
  it('should enforce HTTPS', async () => {
    const protection = new SSRFProtection();
    await expect(
      protection.validateUrl('http://example.com')
    ).rejects.toThrow('Only HTTPS protocol is allowed');
  });
});
```

### PII Redaction Tests
```typescript
describe('PIIRedactor', () => {
  it('should redact email addresses', () => {
    const redactor = new PIIRedactor();
    const response = {
      entities: [{
        vcardArray: ['vcard', [
          ['email', {}, 'text', 'john@example.com']
        ]]
      }]
    };
    
    const redacted = redactor.redact(response);
    expect(redacted.entities[0].vcardArray[1][0][3]).toBe('[REDACTED]');
  });
  
  it('should not mutate original response', () => {
    const redactor = new PIIRedactor();
    const original = { entities: [...] };
    const redacted = redactor.redact(original);
    
    expect(original).not.toBe(redacted);
    expect(original.entities[0].vcardArray[1][0][3]).toBe('john@example.com');
  });
});
```

## Common Patterns

### Production Configuration
```typescript
// Strict security for production
const protection = new SSRFProtection({
  enabled: true,
  blockPrivateIPs: true,
  blockLocalhost: true,
  blockLinkLocal: true,
  allowedDomains: [
    'rdap.verisign.com',
    'rdap.arin.net',
    'rdap.ripe.net',
    'rdap.apnic.net',
    'rdap.lacnic.net'
  ]
});

const redactor = new PIIRedactor({
  redactPII: true,
  redactFields: ['email', 'phone', 'fax', 'adr']
});
```

### Development Configuration
```typescript
// Relaxed for development/testing
const protection = new SSRFProtection({
  enabled: true,
  blockPrivateIPs: false,  // Allow local testing
  blockLocalhost: false
});

const redactor = new PIIRedactor({
  redactPII: false  // See full data in development
});
```

### Custom Redaction
```typescript
// Redact additional fields
const redactor = new PIIRedactor({
  redactPII: true,
  redactFields: ['email', 'phone', 'fax', 'adr', 'fn', 'org'],
  redactionText: '***REDACTED***'
});
```

## Related

- **Port Interface**: `src/core/ports/pii-redactor.port.ts`
- **Error Types**: `src/shared/errors/SSRFProtectionError.ts`
- **Validators**: `src/shared/utils/validators/`
- **Security Whitepaper**: `security/whitepaper.md`
- **Threat Model**: `security/threat_model.md`

---

**Implements**: `IPIIRedactorPort`  
**Used by**: Application layer (QueryOrchestrator), Infrastructure (Fetcher)  
**Status**: Fully implemented and tested
