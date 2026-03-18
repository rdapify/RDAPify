# Known Issues and Limitations

🎯 **Purpose**: Comprehensive documentation of known compatibility issues, limitations, and workarounds for RDAPify across different environments, registries, and versions to help developers anticipate and resolve problems  
📚 **Related**: [Compatibility Matrix](matrix.md) | [Node.js Versions](nodejs_versions.md) | [Bun Support](bun.md) | [Deno Support](deno.md) | [Cloudflare Workers](cloudflare_workers.md)  
⏱️ **Reading Time**: 6 minutes  
🔍 **Pro Tip**: Use the [Issue Diagnosis Tool](../../playground/issue-diagnosis-tool.md) to automatically identify and suggest solutions for compatibility problems in your environment

## 📋 Issue Classification System

RDAPify uses a standardized classification system to categorize known issues by severity and impact:

| Severity Level | Impact | Resolution Timeline | User Action Required |
|----------------|--------|---------------------|----------------------|
| **🔴 Critical** | System unusable, security vulnerability | Immediate (&lt;72 hours) | Stop using affected feature |
| **🟠 High** | Major functionality affected | Short-term (&lt;2 weeks) | Apply workaround immediately |
| **🟡 Medium** | Moderate impact on usability | Medium-term (&lt;1 month) | Apply workaround when convenient |
| **🟢 Low** | Minor inconvenience or edge case | Long-term (future releases) | No immediate action required |
| **🔵 Informational** | Documentation or clarification needed | Ongoing | None |

## 🔥 Critical Known Issues

### 1. AFRINIC Registry Unstable API Endpoints

**Severity**: 🔴 Critical  
**Status**: ⚠️ Monitoring  
**Affected Versions**: All versions  
**Affected Environments**: All environments  
**Registry Impact**: AFRINIC (Africa)  

**Description**:  
AFRINIC's RDAP endpoints experience frequent downtime and return inconsistent responses. The registry has acknowledged infrastructure limitations but has not provided a timeline for resolution.

**Symptoms**:
- High error rates (15-25%) when querying AFRINIC resources
- Intermittent 502/503 errors from AFRINIC RDAP servers
- Missing or incomplete registration data in responses

**Workaround**:
```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  retry: {
    maxAttempts: 5,
    backoff: 'exponential',
    maxDelay: 10000 // 10 second maximum delay
  },
  timeout: 15000, // 15 second timeout
  fallbackRegistries: [
    {
      registry: 'afrinic',
      fallbacks: [
        { url: 'https://rdap.afrinic.net/rdap/', priority: 1 },
        { url: 'https://afrinic-rest-legacy.afrinic.net/rest/', priority: 2 }
      ]
    }
  ]
});

// Implement circuit breaker pattern
let afrinicFailures = 0;
const MAX_FAILURES = 3;

async function queryWithCircuitBreaker(domain: string): Promise<any> {
  if (afrinicFailures >= MAX_FAILURES) {
    throw new Error('AFRINIC circuit breaker open - service unavailable');
  }
  
  try {
    const result = await client.domain(domain);
    afrinicFailures = 0; // Reset failures on success
    return result;
  } catch (error) {
    afrinicFailures++;
    throw error;
  }
}
```

**Resolution Status**:  
AFRINIC has acknowledged the issue and is working on infrastructure improvements. RDAPify maintains active communication with AFRINIC technical team and will update this documentation when improvements are deployed.

### 2. Node.js 16.x Memory Leak in Cache Module

**Severity**: 🔴 Critical  
**Status**: 🟢 Fixed in v2.4.0+  
**Affected Versions**: v2.0.0 - v2.3.9  
**Affected Environments**: Node.js 16.x only  
**Registry Impact**: All registries  

**Description**:  
A memory leak exists in the cache module when running on Node.js 16.x environments. The leak occurs due to improper cleanup of cache entries during high-volume operations.

**Symptoms**:
- Memory usage steadily increases during batch processing
- Process crashes with "Out of Memory" after 4-6 hours of operation
- Performance degradation over time

**Workaround** (for versions < v2.4.0):
```typescript
import { RDAPClient } from 'rdapify';

// Implement aggressive cache cleanup
const client = new RDAPClient({
  cache: {
    enabled: true,
    type: 'memory',
    memory: {
      max: 5000, // Reduce cache size
      ttl: 300000, // 5 minute TTL
      cleanupInterval: 300000 // 5 minute cleanup
    }
  },
  performance: {
    maxConcurrent: 5 // Reduce concurrency to limit memory pressure
  }
});

// Manual cache cleanup every 5 minutes
setInterval(() => {
  client.clearCache();
  console.log('Cache manually cleared to prevent memory leak');
}, 300000);
```

**Resolution**:  
This issue was resolved in RDAPify v2.4.0 with a complete rewrite of the cache module using WeakRefs for Node.js 16+ environments. Users on Node.js 16.x should upgrade to v2.4.0 or newer, or migrate to Node.js 18+ which is not affected by this issue.

## 🟠 High Priority Issues

### 1. Cloudflare Workers KV Cache Size Limitations

**Severity**: 🟠 High  
**Status**: ⚠️ Known limitation  
**Affected Versions**: All versions  
**Affected Environments**: Cloudflare Workers  
**Registry Impact**: All registries  

**Description**:  
Cloudflare Workers KV storage has a 25MB limit per value, which can be exceeded when caching large RDAP responses for certain domain portfolios or IP ranges.

**Symptoms**:
- Cache write failures with "KV PUT operation failed: key too large" errors
- Performance degradation when KV operations fail and fall back to registry queries
- Inconsistent caching behavior for large responses

**Workaround**:
```typescript
// config/cloudflare-workers.ts
import { RDAPClient } from 'rdapify';

export const createCloudflareClient = (env: Env) => {
  return new RDAPClient({
    cache: {
      enabled: true,
      type: 'kv-chunked', // Use chunked KV strategy
      kv: {
        namespace: env.RDAP_CACHE,
        ttl: 1800000, // 30 minutes
        maxChunkSize: 24 * 1024 * 1024, // 24MB chunks
        maxChunksPerKey: 4
      }
    },
    performance: {
      maxConcurrent: 3, // Reduce concurrency for Cloudflare
      connectionPool: {
        max: 8,
        timeout: 2000
      }
    }
  });
};

// Chunked cache implementation
class ChunkedKVCacher {
  async set(key: string, value: any, ttl: number): Promise<void> {
    const jsonString = JSON.stringify(value);
    const chunks = this.chunkString(jsonString);
    
    // Store chunk metadata
    await this.kv.put(`${key}:meta`, JSON.stringify({
      chunkCount: chunks.length,
      totalSize: jsonString.length,
      timestamp: Date.now(),
      expires: Date.now() + ttl
    }), { expirationTtl: Math.floor(ttl / 1000) });
    
    // Store chunks
    await Promise.all(
      chunks.map((chunk, index) => 
        this.kv.put(`${key}:chunk:${index}`, chunk, { expirationTtl: Math.floor(ttl / 1000) })
      )
    );
  }
  
  async get(key: string): Promise<any | null> {
    const metaString = await this.kv.get(`${key}:meta`);
    if (!metaString) return null;
    
    const meta = JSON.parse(metaString);
    if (meta.expires < Date.now()) {
      await this.delete(key);
      return null;
    }
    
    // Get all chunks
    const chunks = await Promise.all(
      Array(meta.chunkCount).fill(0).map((_, index) => 
        this.kv.get(`${key}:chunk:${index}`)
      )
    );
    
    // Reconstruct value
    const jsonString = chunks.join('');
    return JSON.parse(jsonString);
  }
  
  private chunkString(str: string, chunkSize: number = 24 * 1024 * 1024): string[] {
    const chunks = [];
    for (let i = 0; i < str.length; i += chunkSize) {
      chunks.push(str.substring(i, i + chunkSize));
    }
    return chunks;
  }
}
```

**Resolution Status**:  
This is a platform limitation of Cloudflare Workers. RDAPify has implemented chunked caching as a workaround (available in v2.3.5+). Cloudflare is investigating increasing KV value size limits for enterprise customers.

### 2. Safari 16 Browser CORS Limitations

**Severity**: 🟠 High  
**Status**: ⚠️ Browser limitation  
**Affected Versions**: v2.0.0+  
**Affected Environments**: Safari 16 on iOS and macOS  
**Registry Impact**: All registries when used in browser  

**Description**:  
Safari 16 has stricter CORS policy enforcement compared to other browsers, blocking many RDAP endpoints that don't include proper CORS headers in their responses.

**Symptoms**:
- CORS errors when making direct RDAP requests from Safari
- "Cannot use import statement outside a module" errors in Safari console
- Features working in Chrome/Firefox but failing in Safari

**Workaround**:
```javascript
// browser/client.js
import { RDAPClient } from 'rdapify';

// Always use proxy in Safari
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

export const createBrowserClient = () => {
  return new RDAPClient({
    security: {
      // Safari requires proxy for all requests
      corsProxy: {
        enabled: isSafari || process.env.NODE_ENV === 'production',
        baseUrl: 'https://cors.rdapify.dev/proxy?url='
      }
    },
    cache: {
      enabled: true,
      type: 'indexeddb' // Safari has better IndexedDB support than Cache API
    }
  });
};

// Proxy validation for Safari
export const validateProxyConfig = (config) => {
  if (isSafari && !config.security?.corsProxy?.enabled) {
    console.warn('⚠️ Safari requires CORS proxy for RDAP requests. Enabling proxy automatically.');
    config.security = config.security || {};
    config.security.corsProxy = {
      enabled: true,
      baseUrl: config.security.corsProxy?.baseUrl || 'https://cors.rdapify.dev/proxy?url='
    };
  }
  return config;
};
```

**Resolution Status**:  
This is a browser limitation that cannot be fixed in RDAPify. The recommended approach is to always use a CORS proxy when deploying to Safari browsers. RDAPify provides a built-in proxy configuration to handle this automatically.

## 🟡 Medium Priority Issues

### 1. Windows Path Limitations in Development Environments

**Severity**: 🟡 Medium  
**Status**: ⚠️ Platform limitation  
**Affected Versions**: v2.0.0+  
**Affected Environments**: Windows development environments  
**Registry Impact**: None (development only)  

**Description**:  
Windows has a 260-character path length limit that can be exceeded when installing RDAPify dependencies in deeply nested project directories.

**Symptoms**:
- `npm install` failures with "path too long" errors
- Missing files in node_modules after installation
- Test failures due to missing dependencies

**Workaround**:
```bash
# Solution 1: Enable long paths in Windows
# Run PowerShell as Administrator:
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1

# Solution 2: Install in a shallow directory
mkdir C:\rdapify-project
cd C:\rdapify-project
npm install rdapify

# Solution 3: Use npm configuration to reduce path depth
npm config set cache C:\npm-cache
npm config set prefix C:\npm-global
npm install -g rdapify
```

**Resolution Status**:  
This is a Windows platform limitation. While Windows 10+ supports long paths when enabled, many tools still have issues. RDAPify has reduced dependency depth in v2.3.0+ to minimize this issue.

### 2. Docker Alpine Linux DNS Resolution Issues

**Severity**: 🟡 Medium  
**Status**: ⚠️ Environment limitation  
**Affected Versions**: v2.0.0+  
**Affected Environments**: Docker containers using Alpine Linux base images  
**Registry Impact**: All registries  

**Description**:  
Alpine Linux's musl libc has different DNS resolution behavior compared to glibc, causing intermittent DNS failures when resolving RDAP server hostnames.

**Symptoms**:
- Intermittent "getaddrinfo EAI_AGAIN" errors when resolving registry domains
- Inconsistent connectivity to RDAP endpoints
- Connection timeouts that resolve after container restart

**Workaround**:
```dockerfile
# Dockerfile with DNS fixes
FROM node:20-alpine

# Fix DNS resolution issues
RUN apk add --no-cache bind-tools && \
    echo 'options rotate timeout:1 attempts:2' >> /etc/resolv.conf && \
    echo 'nameserver 8.8.8.8' >> /etc/resolv.conf && \
    echo 'nameserver 8.8.4.4' >> /etc/resolv.conf

# Alternative: Use glibc-based image
# FROM node:20-slim

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build

USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

```bash
# docker-compose.yml with DNS configuration
version: '3.8'
services:
  rdapify:
    build: .
    dns:
      - 8.8.8.8
      - 8.8.4.4
    dns_search:
      - .
    environment:
      NODE_OPTIONS: --dns-result-order=ipv4first
    # ... rest of configuration
```

**Resolution Status**:  
This is an Alpine Linux limitation. RDAPify recommends using the `node:20-slim` base image for production deployments to avoid DNS issues. For environments requiring Alpine, the DNS configuration workarounds above are effective.

## 🟢 Low Priority Issues

### 1. TypeScript 4.x Type Inference Limitations

**Severity**: 🟢 Low  
**Status**: ⚠️ TypeScript limitation  
**Affected Versions**: v2.0.0+  
**Affected Environments**: TypeScript 4.x projects  
**Registry Impact**: None (development only)  

**Description**:  
TypeScript 4.x has limitations in type inference for complex generic types used in RDAPify's response normalization system.

**Symptoms**:
- TypeScript compiler errors about "type instantiation is excessively deep"
- IDE performance degradation when working with RDAPify types
- Need for explicit type assertions in some scenarios

**Workaround**:
```typescript
// tsconfig.json adjustments
{
  "compilerOptions": {
    "strict": true,
    "target": "es2020",
    "module": "esnext",
    "moduleResolution": "node",
    "skipLibCheck": true, // Skip type checking of declaration files
    "types": ["node"], // Explicitly specify types to include
    
    // Reduce type complexity
    "noImplicitAny": false, // Temporarily disable for complex types
    "strictNullChecks": false // Temporarily disable for complex types
  }
}

// Alternative: Use type assertions
import { RDAPClient, DomainResponse } from 'rdapify';

const client = new RDAPClient();
const result = await client.domain('example.com') as DomainResponse;

// Or create simplified type definitions
interface SimplifiedDomain {
  domain: string;
  registrar: string;
  status: string[];
  nameservers: string[];
}
```

**Resolution Status**:  
This issue is resolved in TypeScript 5.0+ which has improved type inference capabilities. RDAPify v2.4.0+ includes TypeScript 5.x type definitions that work correctly across all supported versions.

## 🔵 Informational Notes

### 1. Registry Data Accuracy and Timeliness

**Severity**: 🔵 Informational  
**Status**: 📊 Registry-dependent  
**Affected Versions**: All versions  
**Affected Environments**: All environments  
**Registry Impact**: All registries  

**Description**:  
RDAPify provides access to registry data but cannot guarantee the accuracy, completeness, or timeliness of the underlying data. Registry operators have varying update policies and data quality standards.

**Key Considerations**:
- **Data Timeliness**: Changes to domain registrations may take 24-48 hours to appear in RDAP responses
- **Data Completeness**: Some registries redact or omit certain fields for privacy or policy reasons
- **Data Accuracy**: Registry data may contain errors or inconsistencies beyond RDAPify's control
- **Registry Policies**: Each registry has different policies for data retention and availability

**Best Practices**:
```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  dataQuality: {
    // Set expectations for data freshness
    maxDataAge: 86400000, // 24 hours in milliseconds
    
    // Handle missing data gracefully
    missingDataStrategy: 'fallback-to-previous' | 'return-partial' | 'error',
    
    // Validate data consistency
    validation: {
      requireRegistrationDate: true,
      requireExpirationDate: true,
      requireNameservers: false
    }
  }
});

async function getDomainWithValidation(domain: string) {
  try {
    const result = await client.domain(domain);
    
    // Check data freshness
    const lastUpdated = result.events?.find(e => e.eventAction === 'last updated')?.eventDate;
    if (lastUpdated && Date.now() - new Date(lastUpdated).getTime() > 86400000) {
      console.warn(`Data for ${domain} may be stale (last updated: ${lastUpdated})`);
    }
    
    return result;
  } catch (error) {
    // Handle data quality issues separately from network errors
    if (error.code === 'DATA_QUALITY_ISSUE') {
      console.warn(`Data quality issue for ${domain}: ${error.message}`);
      return null; // Or fallback to cached data
    }
    throw error;
  }
}
```

**Recommendations**:  
- Implement client-side validation of critical data points
- Use cache headers to understand data freshness
- Maintain local data quality metrics to identify problematic registries
- Set client expectations about data limitations in user interfaces

## 🔍 Troubleshooting Common Issues

### 1. Diagnosing Environment-Specific Issues
**Symptoms**: Application works in development but fails in production  
**Diagnostic Steps**:
```bash
# 1. Check environment compatibility
npx rdapify doctor --env production

# 2. Verify registry connectivity from production environment
npx rdapify test-connectivity --registries verisign,arin,ripe --env production

# 3. Check for missing dependencies in production
npx rdapify check-dependencies --env production

# 4. Validate configuration differences
diff <(npx rdapify config-dump --env development) <(npx rdapify config-dump --env production)
```

**Solutions**:
✅ **Environment Parity**: Use Docker containers to ensure identical environments across development and production  
✅ **Configuration Management**: Use environment variables and configuration files instead of hard-coded values  
✅ **Feature Flags**: Implement feature flags to disable problematic features in specific environments  
✅ **Progressive Enhancement**: Design core functionality to work even when advanced features are unavailable  

### 2. Debugging Registry-Specific Failures
**Symptoms**: Application works for some domains but fails for others  
**Diagnostic Steps**:
```bash
# 1. Identify failing registry
npx rdapify registry-lookup --domain example.af --verbose

# 2. Test direct registry connectivity
curl -v "https://rdap.afrinic.net/rdap/domain/example.af"

# 3. Compare working vs non-working responses
npx rdapify compare-responses --working example.com --failing example.af

# 4. Enable debug logging for specific registry
RDAP_DEBUG_REGISTRY=afrinic node app.js
```

**Solutions**:
✅ **Registry-Specific Adapters**: Implement custom adapters for problematic registries  
✅ **Circuit Breakers**: Isolate failing registries to prevent cascading failures  
✅ **Fallback Strategies**: Implement multiple fallback endpoints for critical registries  
✅ **Feature Detection**: Dynamically adjust behavior based on registry capabilities  

## 📚 Related Documentation

| Document | Description | Path |
|----------|-------------|------|
| [Compatibility Matrix](matrix.md) | Complete compatibility reference | [matrix.md](matrix.md) |
| [Registry Status](../guides/registry_status.md) | Real-time registry availability dashboard | [../guides/registry_status.md](../guides/registry_status.md) |
| [Issue Diagnosis Tool](../../playground/issue-diagnosis-tool.md) | Interactive troubleshooting assistant | [../../playground/issue-diagnosis-tool.md](../../playground/issue-diagnosis-tool.md) |
| [Performance Troubleshooting](../troubleshooting/performance.md) | Performance issue diagnosis guide | [../troubleshooting/performance.md](../troubleshooting/performance.md) |
| [Error Handling Guide](../guides/error_handling.md) | Comprehensive error handling strategies | [../guides/error_handling.md](../guides/error_handling.md) |
| [Community Support](../../community/support.md) | Getting help from community and maintainers | [../../community/support.md](../../community/support.md) |

## 🏷️ Issue Tracking Specifications

| Property | Value |
|----------|-------|
| **Issue Tracking System** | GitHub Issues with labels and milestones |
| **Security Vulnerability Process** | Responsible disclosure via security@rdapify.com |
| **Issue Response Time** | Critical: &lt;24 hours, High: &lt;72 hours, Medium: &lt;1 week |
| **Fix Prioritization** | Security > Data Integrity > Availability > Performance > Features |
| **Version Support** | Current + 2 previous minor versions receive bug fixes |
| **End-of-Life Policy** | 6 months notice before deprecating environment support |
| **Changelog Updates** | All issues fixed in a release documented in CHANGELOG.md |
| **Last Updated** | December 5, 2025 |

> 🔐 **Critical Reminder**: Always check this documentation before reporting new issues. Many environment-specific problems have documented workarounds. For security-related issues, never discuss details publicly - contact security@rdapify.com directly using PGP encryption. Regularly update RDAPify to receive fixes for known issues, and implement the recommended workarounds for unresolved limitations in your environment.

[← Back to Compatibility](../README.md) | [Next: Node.js Versions →](nodejs_versions.md)

*Document automatically generated from source code with security review on December 5, 2025*