# Security Implementation Checklist

## SSRF Protection

### URL Validation
```typescript
export class SSRFProtection {
  validateURL(url: string): void {
    const parsed = new URL(url);
    
    // Only HTTPS allowed
    if (parsed.protocol !== 'https:') {
      throw new ValidationError('Only HTTPS protocol allowed');
    }
    
    // Resolve hostname to IP
    const ip = dns.lookup(parsed.hostname);
    
    // Block private IP ranges (RFC 1918)
    if (this.isPrivateIP(ip)) {
      throw new ValidationError('Private IP addresses not allowed');
    }
    
    // Block localhost
    if (this.isLocalhost(ip)) {
      throw new ValidationError('Localhost not allowed');
    }
  }
  
  private isPrivateIP(ip: string): boolean {
    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
    return /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(ip);
  }
}
```

## Input Validation

### Domain Validation
```typescript
export function validateDomain(domain: string): string {
  // Remove whitespace
  const cleaned = domain.trim().toLowerCase();
  
  // Check length
  if (cleaned.length === 0 || cleaned.length > 253) {
    throw new ValidationError('Invalid domain length');
  }
  
  // Check format (basic)
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i.test(cleaned)) {
    throw new ValidationError('Invalid domain format');
  }
  
  return cleaned;
}
```

### IP Validation
```typescript
export function validateIP(ip: string): string {
  const cleaned = ip.trim();
  
  // IPv4
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(cleaned)) {
    const parts = cleaned.split('.').map(Number);
    if (parts.every(p => p >= 0 && p <= 255)) {
      return cleaned;
    }
  }
  
  // IPv6 (simplified)
  const ipv6Regex = /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i;
  if (ipv6Regex.test(cleaned)) {
    return cleaned;
  }
  
  throw new ValidationError('Invalid IP address');
}
```

## PII Redaction

### Automatic Redaction
```typescript
export class PIIRedactor {
  redact(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }
    
    const redacted = Array.isArray(data) ? [] : {};
    
    for (const [key, value] of Object.entries(data)) {
      if (this.isPIIField(key)) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        redacted[key] = this.redact(value);
      } else {
        redacted[key] = value;
      }
    }
    
    return redacted;
  }
  
  private isPIIField(key: string): boolean {
    const piiFields = ['email', 'phone', 'fax', 'address', 'name'];
    return piiFields.some(field => key.toLowerCase().includes(field));
  }
}
```

## Certificate Validation

```typescript
import https from 'https';

const agent = new https.Agent({
  rejectUnauthorized: true, // Strict certificate validation
  minVersion: 'TLSv1.2',     // Minimum TLS version
});

const response = await fetch(url, { agent });
```

## Security Headers

```typescript
// When implementing HTTP client
const headers = {
  'User-Agent': 'RDAPify/1.0.0',
  'Accept': 'application/rdap+json',
  // NO sensitive data in headers
};
```
