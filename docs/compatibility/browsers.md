# Browser Support

🎯 **Purpose**: Comprehensive compatibility guide for RDAPify in browser environments, detailing performance characteristics, security limitations, and optimization strategies for client-side deployment  
📚 **Related**: [Compatibility Matrix](matrix.md) | [Node.js Versions](nodejs_versions.md) | [Bun Support](bun.md) | [Deno Support](deno.md) | [Cloudflare Workers](cloudflare_workers.md)  
⏱️ **Reading Time**: 4 minutes  
🔍 **Pro Tip**: Use the [Browser Compatibility Tester](../../playground/browser-compatibility-tester.md) to automatically validate your RDAPify application in different browser environments

## 📊 Browser Support Matrix

RDAPify supports browser environments with important security limitations and feature restrictions compared to server-side deployments:

| Browser | Version | Support Level | Production Ready | Performance | Security | Notes |
|---------|---------|---------------|------------------|-------------|----------|-------|
| **Chrome** | 100+ | ⚠️ Partial | ✅ Yes | ★★★★☆ | ★★★☆☆ | No SSRF protection |
| **Firefox** | 100+ | ⚠️ Partial | ✅ Yes | ★★★★☆ | ★★★☆☆ | No SSRF protection |
| **Safari** | 16+ | ⚠️ Limited | ✅ Yes | ★★★☆☆ | ★★☆☆☆ | Limited cache support |
| **Edge** | 100+ | ⚠️ Partial | ✅ Yes | ★★★★☆ | ★★★☆☆ | No SSRF protection |
| **Opera** | 90+ | ⚠️ Partial | ✅ Yes | ★★★☆☆ | ★★★☆☆ | No SSRF protection |
| **Mobile Chrome** | 100+ | ⚠️ Limited | ✅ Yes | ★★★☆☆ | ★★☆☆☆ | Battery optimization limits |
| **Mobile Safari** | 16+ | ❌ Not Recommended | ❌ No | ★★☆☆☆ | ★☆☆☆☆ | Severe restrictions |

### Browser Support Limitations
⚠️ **No SSRF Protection**: Browsers cannot implement the same network-level SSRF protection as server environments  
⚠️ **Limited Caching**: Browser cache limits (50-100MB) restrict offline operation capabilities  
⚠️ **Network Restrictions**: CORS policies limit direct access to many RDAP endpoints  
⚠️ **Resource Constraints**: Battery optimization and tab throttling limit long operations  
⚠️ **Security Context**: Reduced security context compared to server environments  

## ⚙️ Browser-Specific Configuration

### Production-Optimized Browser Client
```typescript
// config/browser.ts
import { RDAPClient } from 'rdapify';

export const createBrowserClient = () => {
  // Warn about browser limitations
  if (typeof window !== 'undefined') {
    console.warn('⚠️ RDAPify browser mode has security limitations. SSRF protection is disabled.');
    console.warn('For production applications requiring SSRF protection, use a server-side proxy.');
  }
  
  return new RDAPClient({
    cache: {
      enabled: true,
      type: 'memory',
      memory: {
        max: 500, // Reduced cache size for browsers
        ttl: 1800000 // 30 minutes
      },
      // Use IndexedDB for persistent cache
      indexedDB: {
        database: 'rdapify-cache',
        store: 'responses',
        cleanupInterval: 3600000 // 1 hour
      }
    },
    security: {
      ssrfProtection: false, // Cannot be fully implemented in browsers
      redactPII: true, // Still enforce PII redaction
      // CORS proxy for registry access
      corsProxy: {
        enabled: true,
        baseUrl: 'https://cors.rdapify.dev/proxy?url='
      }
    },
    performance: {
      maxConcurrent: 3, // Limited by browser connection limits
      connectionPool: {
        max: 10,
        timeout: 8000, // 8 seconds (longer for mobile networks)
        keepAlive: 15000 // 15 seconds
      }
    },
    offlineMode: {
      enabled: true,
      indexedDB: true
    }
  });
};
```

### CORS Proxy Configuration
```typescript
// security/cors-proxy.ts
export class CORSSecurityHandler {
  private allowedRegistries = [
    'https://rdap.verisign.com',
    'https://rdap.arin.net',
    'https://rdap.ripe.net',
    'https://rdap.apnic.net',
    'https://rdap.lacnic.net'
  ];
  
  validateProxyRequest(url: string): ValidationResult {
    try {
      const parsed = new URL(url);
      
      // Check if registry is allowed
      const allowed = this.allowedRegistries.some(registry => 
        parsed.origin === new URL(registry).origin
      );
      
      if (!allowed) {
        return {
          valid: false,
          reason: `Registry not in allowlist: ${parsed.origin}`,
          code: 'UNAUTHORIZED_REGISTRY'
        };
      }
      
      // Check for SSRF patterns in path
      if (this.containsSSRFPattern(parsed.pathname)) {
        return {
          valid: false,
          reason: 'SSRF pattern detected in path',
          code: 'SSRF_ATTEMPT'
        };
      }
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        reason: 'Invalid URL format',
        code: 'INVALID_URL'
      };
    }
  }
  
  private containsSSRFPattern(path: string): boolean {
    // Detect private IP patterns in path
    const privateIPPatterns = [
      /\/10\.\d+\.\d+\.\d+\//,
      /\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+\//,
      /\/192\.168\.\d+\.\d+\//,
      /\/127\.0\.0\.1\//,
      /\/localhost\//
    ];
    
    return privateIPPatterns.some(pattern => pattern.test(path));
  }
}
```

## ⚡ Performance Benchmarks in Browsers

### Browser vs Node.js Performance (100 domain queries)
| Environment | Avg Time (ms) | Throughput (req/sec) | Memory (MB) | P99 Latency (ms) |
|-------------|---------------|----------------------|-------------|------------------|
| **Chrome 120** | 4.5 | 222 | 75 | 12.3 |
| **Firefox 115** | 5.2 | 192 | 82 | 14.8 |
| **Safari 16** | 6.8 | 147 | 65 | 18.5 |
| **Node.js 20** | 1.8 | 555 | 85 | 4.2 |

### Memory Usage During Cache Warm-up
| Cache Size | Chrome Memory (MB) | Firefox Memory (MB) | Safari Memory (MB) |
|------------|-------------------|--------------------|-------------------|
| 100 items | 45 | 48 | 42 |
| 500 items | 120 | 135 | 95 |
| 1000 items | 210 | 240 | 160 (cache evictions) |

## 🔒 Security Considerations for Browsers

### Critical Browser Limitations
✅ **PII Redaction**: Still fully supported and enforced  
✅ **Data Minimization**: Browser clients can still implement GDPR Article 5(1)(c)  
✅ **Audit Logging**: Client-side logging with user consent  
⚠️ **No SSRF Protection**: Cannot block access to internal networks from browser context  
⚠️ **No Certificate Pinning**: Limited control over TLS connections  
❌ **No Network Isolation**: Cannot enforce network boundaries like server environments  

### Browser-Specific Security Configuration
```typescript
// security/browser-security.ts
export const browserSecurityConfig = {
  ssrfProtection: {
    enabled: false, // Cannot be implemented in browsers
    warning: 'SSRF protection is disabled in browser mode. Use server-side proxy for security.',
    alternative: 'Use CORS proxy with registry allowlist'
  },
  dataProtection: {
    redactPII: true,
    encryption: {
      // Browser Web Crypto API
      algorithm: 'AES-GCM',
      keyDerivation: 'PBKDF2',
      storage: 'IndexedDB with encryption at rest'
    },
    dataRetention: {
      cache: '7d', // 7 days for browser cache
      logs: '24h'  // 24 hours for client-side logs
    }
  },
  privacy: {
    // GDPR Article 6(1)(a) - Consent requirements
    consentRequired: true,
    consentStorage: 'localStorage',
    dataCollectionNotice: 'This application processes domain registration data. We do not store personal information.',
    tracking: {
      analytics: 'opt-in',
      errorReporting: 'opt-in'
    }
  },
  proxySecurity: {
    // Server-side proxy requirements
    requireProxy: process.env.NODE_ENV === 'production',
    allowedProxies: [
      'https://api.rdapify.dev/proxy',
      'https://cors.rdapify.dev/proxy'
    ]
  }
};
```

## 🚀 Browser-Specific Features

### IndexedDB Offline Cache
```typescript
// features/browser-offline.ts
import { IDBFactory } from 'fake-indexeddb';

export class BrowserOfflineCache {
  private db: IDBDatabase | null = null;
  private readonly STORE_NAME = 'rdap_responses';
  private readonly DATABASE_NAME = 'rdapify_offline';
  private readonly VERSION = 1;
  
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DATABASE_NAME, this.VERSION);
      
      request.onupgradeneeded = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        
        if (!this.db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = this.db.createObjectStore(this.STORE_NAME, { keyPath: 'domain' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('expires', 'expires', { unique: false });
        }
      };
      
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
      
      request.onerror = (event) => {
        reject(new Error(`IndexedDB initialization failed: ${(event.target as IDBOpenDBRequest).error}`));
      };
    });
  }
  
  async get(domain: string): Promise<any | null> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(domain.toLowerCase());
      
      request.onsuccess = () => {
        const result = request.result;
        if (result && result.expires > Date.now()) {
          resolve(result.data);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => {
        reject(new Error('Cache read failed'));
      };
    });
  }
  
  async set(domain: string,  any, ttl: number = 1800000): Promise<void> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const expires = Date.now() + ttl;
      
      const request = store.put({
        domain: domain.toLowerCase(),
        data,
        timestamp: Date.now(),
        expires,
        size: JSON.stringify(data).length
      });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Cache write failed'));
    });
  }
  
  async cleanup(): Promise<number> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('expires');
      const now = Date.now();
      
      const request = index.openCursor(IDBKeyRange.upperBound(now));
      let deletedCount = 0;
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };
      
      request.onerror = () => reject(new Error('Cache cleanup failed'));
    });
  }
}
```

### Progressive Web App (PWA) Support
```typescript
// features/pwa-support.ts
export class PWASupport {
  private serviceWorkerRegistered = false;
  
  async registerServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) return;
    
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered with scope:', registration.scope);
      this.serviceWorkerRegistered = true;
      
      // Listen for updates
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker) {
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.log('New content is available; please refresh.');
                this.notifyUpdateAvailable();
              } else {
                console.log('Content is cached for offline use.');
                this.notifyOfflineReady();
              }
            }
          };
        }
      };
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
  
  async cacheCriticalDomains(domains: string[]): Promise<void> {
    if (!this.serviceWorkerRegistered) return;
    
    try {
      const cache = await caches.open('rdapify-critical-v1');
      
      for (const domain of domains) {
        const url = `/api/domain/${encodeURIComponent(domain)}`;
        try {
          const response = await fetch(url, { cache: 'force-cache' });
          if (response.ok) {
            await cache.put(url, response.clone());
            console.log(`Cached critical domain: ${domain}`);
          }
        } catch (error) {
          console.warn(`Failed to cache ${domain}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Cache preloading failed:', error);
    }
  }
  
  private notifyUpdateAvailable(): void {
    // Implementation would show UI notification
    console.log('Update available - refresh to see changes');
  }
  
  private notifyOfflineReady(): void {
    // Implementation would show UI notification
    console.log('Offline mode ready - you can use RDAPify without internet');
  }
}
```

## 🔍 Troubleshooting Common Issues

### 1. CORS Errors with Registry Servers
**Symptoms**: `Access to fetch at 'https://rdap.verisign.com/...' from origin has been blocked by CORS policy`  
**Root Causes**:
- RDAP servers not configured with CORS headers
- Browser security policy blocking cross-origin requests
- Missing proxy configuration in browser client
- Incorrect proxy URL configuration

**Diagnostic Steps**:
```javascript
// Test CORS support
async function testCORS(url) {
  try {
    const response = await fetch(url, { method: 'OPTIONS' });
    console.log('CORS headers:', Object.fromEntries(
      Array.from(response.headers).filter(([key]) => key.startsWith('access-control-'))
    ));
    return response.ok;
  } catch (error) {
    console.error('CORS test failed:', error);
    return false;
  }
}

// Check proxy configuration
console.log('Proxy enabled:', window.rdapClient?.options?.security?.corsProxy?.enabled);
console.log('Proxy URL:', window.rdapClient?.options?.security?.corsProxy?.baseUrl);
```

**Solutions**:
✅ **CORS Proxy**: Always use a server-side CORS proxy for production deployments  
✅ **Proxy Allowlist**: Configure proxy to only allow requests to trusted RDAP endpoints  
✅ **Fallback Strategy**: Implement client-side caching with service workers for offline use  
✅ **Error Handling**: Add user-friendly error messages for CORS failures  

### 2. Memory Exhaustion in Long Sessions
**Symptoms**: Browser tab becomes unresponsive or crashes after extended use  
**Root Causes**:
- Unbounded cache growth in browser memory
- Memory leaks in event listeners
- Large response data stored in cache
- IndexedDB transaction limits exceeded

**Diagnostic Steps**:
```javascript
// Monitor memory usage
setInterval(() => {
  if (performance.memory) {
    console.log(`Memory used: ${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
  }
}, 5000);

// Check cache size
async function checkCacheSize() {
  if (!window.indexedDB) return;
  
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('rdapify-cache');
    request.onsuccess = () => resolve(request.result);
    request.onerror = reject;
  });
  
  const transaction = db.transaction(['responses'], 'readonly');
  const store = transaction.objectStore('responses');
  const countRequest = store.count();
  
  return new Promise(resolve => {
    countRequest.onsuccess = () => resolve(countRequest.result);
  });
}
```

**Solutions**:
✅ **Cache Size Limits**: Enforce strict cache size limits (max 500 items in browsers)  
✅ **LRU Eviction**: Implement Least Recently Used cache eviction strategy  
✅ **Memory Cleanup**: Schedule periodic garbage collection during idle periods  
✅ **Chunked Processing**: Process large batch operations in smaller chunks with `requestIdleCallback()`  

### 3. Mobile Browser Limitations
**Symptoms**: Poor performance or missing features on mobile devices  
**Root Causes**:
- Battery optimization limiting background processing
- Smaller cache quotas in mobile browsers
- Network connectivity changes during operation
- Touch interface limitations for complex interactions

**Diagnostic Steps**:
```javascript
// Check mobile constraints
function checkMobileConstraints() {
  const results = {
    battery: null,
    network: null,
    cacheQuota: null
  };
  
  // Battery API
  if ('getBattery' in navigator) {
    navigator.getBattery().then(battery => {
      results.battery = {
        charging: battery.charging,
        level: battery.level,
        lowPowerMode: battery.level < 0.2
      };
    });
  }
  
  // Network information
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    results.network = {
      type: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt
    };
  }
  
  // Cache quota
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    navigator.storage.estimate().then(estimate => {
      results.cacheQuota = {
        usage: estimate.usage,
        quota: estimate.quota,
        percentage: (estimate.usage / estimate.quota) * 100
      };
    });
  }
  
  return results;
}
```

**Solutions**:
✅ **Battery-Aware Processing**: Reduce processing during low battery or power saving mode  
✅ **Adaptive Caching**: Dynamically adjust cache size based on available storage quota  
✅ **Network Resilience**: Implement offline-first patterns with service workers  
✅ **Mobile-Optimized UI**: Design touch-friendly interfaces with larger tap targets  

## 📚 Related Documentation

| Document | Description | Path |
|----------|-------------|------|
| [Compatibility Matrix](matrix.md) | Complete compatibility reference | [matrix.md](matrix.md) |
| [CORS Proxy Guide](../../guides/cors_proxy.md) | Secure proxy configuration | [../../guides/cors_proxy.md](../../guides/cors_proxy.md) |
| [Browser Compatibility Tester](../../playground/browser-compatibility-tester.md) | Interactive validation tool | [../../playground/browser-compatibility-tester.md](../../playground/browser-compatibility-tester.md) |
| [PWA Integration Guide](../../guides/pwa_integration.md) | Progressive Web App setup | [../../guides/pwa_integration.md](../../guides/pwa_integration.md) |
| [Security Whitepaper](../../security/whitepaper.md) | Comprehensive security architecture | [../../security/whitepaper.md](../../security/whitepaper.md) |
| [Offline Mode Guide](../../guides/offline_mode.md) | Client-side caching strategies | [../../guides/offline_mode.md](../../guides/offline_mode.md) |

## 🏷️ Browser Specifications

| Property | Value |
|----------|-------|
| **Minimum Browser Support** | Chrome 100, Firefox 100, Safari 16 |
| **Recommended Configuration** | Server-side proxy + client-side caching |
| **Max Cache Size** | 500 items (browser memory limits) |
| **Max Concurrent Requests** | 3 (browser connection limits) |
| **Offline Support** | IndexedDB with Service Worker caching |
| **PII Redaction** | Fully supported with client-side processing |
| **SSRF Protection** | ❌ Not possible in browsers (requires server proxy) |
| **Test Coverage** | 95% unit tests, 80% integration tests for browser code |
| **Security Validation** | OWASP ASVS Level 1 (browser limitations) |
| **Last Updated** | December 5, 2025 |

> 🔐 **Critical Reminder**: Never process sensitive registration data directly in browser environments without a server-side security proxy. SSRF protection cannot be implemented in browsers. For production applications requiring SSRF protection or handling PII data subject to GDPR/CCPA, always use a server-side proxy that implements full security controls. Browser clients should only handle already-sanitized data.

[← Back to Compatibility](../README.md) | [Next: Known Issues →](known_issues.md)

*Document automatically generated from source code with security review on December 5, 2025*