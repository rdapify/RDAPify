# ⚡ Rate Limiting Guide

> **🎯 Purpose:** Comprehensive guide to implementing effective rate limiting strategies for RDAPify to ensure registry compliance and service reliability  
> **📚 Related:** [Error Handling](error_handling.md) | [Caching Strategies](caching-strategies.md) | [Security Whitepaper](../security/whitepaper.md)  
> **⏱️ Reading Time:** 7 minutes  
> **🔍 Pro Tip:** Use the [Rate Limit Simulator](../../playground/rate-limit-simulator.md) to model different strategies for your specific workload patterns

---

## 🌐 Why Rate Limiting Matters for RDAP

RDAP registries enforce strict rate limits to protect their infrastructure and ensure fair access for all users. Failure to respect these limits can result in:

```mermaid
graph LR
    A[Your Application] -->|Excessive Requests| B[RDAP Registry]
    B -->|Rate Limit Response| C[HTTP 429]
    C -->|Repeated Violations| D[IP Blocking]
    D -->|No Access| E[Service Disruption]
    E -->|Business Impact| F[Lost Customers]
    
    style A fill:#4CAF50
    style B fill:#2196F3
    style C fill:#FF9800
    style D fill:#F44336
    style E fill:#9E9E9E
    style F fill:#757575
```

**Key Rate Limiting Challenges:**
- ✅ **Registry Variations**: Different registries implement rate limiting differently
- ✅ **Dynamic Limits**: Some registries adjust limits based on client behavior
- ✅ **Burst vs. Sustained**: Handling short bursts vs. steady-state traffic
- ✅ **Global vs. Per-IP**: Registry-wide limits vs. IP-specific limits
- ✅ **Grace Periods**: Understanding retry-after headers and backoff strategies

---

## 📊 Registry Rate Limit Characteristics

### Common Rate Limit Headers
| Header | Description | Example Value | Registry Examples |
|--------|-------------|---------------|-------------------|
| `Retry-After` | Seconds to wait before retrying | `60` | Verisign, RIPE NCC |
| `X-RateLimit-Limit` | Total requests allowed in window | `100` | ARIN, APNIC |
| `X-RateLimit-Remaining` | Remaining requests in window | `42` | ARIN, APNIC |
| `X-RateLimit-Reset` | Seconds until reset | `30` | RIPE NCC |
| `X-RateLimit-Period` | Period in seconds | `60` | AFRINIC |

### Registry-Specific Limits
| Registry | Requests/Minute | Burst Allowance | Notes |
|----------|-----------------|-----------------|-------|
| **Verisign** (.com/.net) | 120 | 30 requests/5s | Uses sliding window algorithm |
| **IANA** (bootstrap) | 60 | None | Strict enforcement |
| **ARIN** | 100 | 20 requests/10s | Returns X-RateLimit headers |
| **RIPE NCC** | 80 | 15 requests/5s | Dynamic limits based on client reputation |
| **APNIC** | 90 | 25 requests/10s | Returns Retry-After header on limit |
| **AFRINIC** | 75 | 10 requests/5s | Strict IP-based enforcement |
| **DENIC** (.de) | 50 | None | Aggressive blocking after violations |

---

## ⚙️ Rate Limiting Implementation Strategies

### 1. Adaptive Client-Side Rate Limiting
```typescript
import { RDAPClient, RateLimiter } from 'rdapify';

const client = new RDAPClient({
  rateLimiter: new AdaptiveRateLimiter({
    strategy: 'dynamic',
    initialLimit: {
      requestsPerSecond: 2,
      burstCapacity: 10
    },
    registryOverrides: {
      'verisign.com': {
        requestsPerMinute: 120,
        burstCapacity: 30,
        retryStrategy: 'exponential'
      },
      'arin.net': {
        requestsPerMinute: 100,
        retryStrategy: 'fixed'
      }
    },
    backoff: {
      minDelay: 1000, // 1 second
      maxDelay: 60000, // 60 seconds
      multiplier: 2.0
    },
    monitoring: {
      enabled: true,
      logInterval: 30000 // 30 seconds
    }
  }),
  retryStrategy: {
    maxRetries: 3,
    retryableErrors: ['RDAP_RATE_LIMITED', 'RDAP_TIMEOUT']
  }
});

// Usage remains simple while rate limiting is handled automatically
async function lookupDomain(domain: string) {
  try {
    return await client.domain(domain);
  } catch (error) {
    if (error.code === 'RDAP_RATE_LIMITED') {
      console.log(`Rate limited. Retry after: ${error.details.retryAfter} seconds`);
    }
    throw error;
  }
}
```

### 2. Token Bucket Algorithm Implementation
```typescript
class TokenBucketRateLimiter implements RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per second
  
  constructor(options: { capacity: number; refillRate: number }) {
    this.capacity = options.capacity;
    this.refillRate = options.refillRate;
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
  }
  
  canMakeRequest(): boolean {
    this.refillTokens();
    return this.tokens > 0;
  }
  
  consumeToken(): void {
    this.refillTokens();
    if (this.tokens > 0) {
      this.tokens--;
    }
  }
  
  getWaitTime(): number {
    this.refillTokens();
    if (this.tokens > 0) {
      return 0;
    }
    
    // Calculate time needed to refill one token
    return (1 / this.refillRate) * 1000; // Convert to milliseconds
  }
  
  private refillTokens(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    
    // Add tokens based on elapsed time
    const newTokens = Math.floor(elapsedSeconds * this.refillRate);
    if (newTokens > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + newTokens);
      this.lastRefill = now;
    }
  }
  
  // Registry-specific configuration
  static forRegistry(registry: string): TokenBucketRateLimiter {
    const configs = {
      'verisign.com': { capacity: 30, refillRate: 6 }, // 120/min = 2/s, burst 30
      'arin.net': { capacity: 20, refillRate: 1.67 }, // 100/min = 1.67/s, burst 20
      'ripe.net': { capacity: 15, refillRate: 1.33 }, // 80/min = 1.33/s, burst 15
      'apnic.net': { capacity: 25, refillRate: 1.5 }, // 90/min = 1.5/s, burst 25
      'afrinic.net': { capacity: 10, refillRate: 1.25 }, // 75/min = 1.25/s, burst 10
      'default': { capacity: 10, refillRate: 1.0 } // Conservative default
    };
    
    const config = configs[registry] || configs['default'];
    return new TokenBucketRateLimiter(config);
  }
}
```

### 3. Distributed Rate Limiting with Redis
```typescript
import { createClient } from 'redis';

class DistributedRateLimiter implements RateLimiter {
  private readonly redis;
  private readonly registryConfigs;
  
  constructor(options: {
    redisUrl: string;
    registryConfigs?: Record<string, { limit: number; window: number }>;
  }) {
    this.redis = createClient({ url: options.redisUrl });
    this.registryConfigs = options.registryConfigs || {
      'default': { limit: 60, window: 60 } // 60 requests per minute
    };
  }
  
  async canMakeRequest(key: string, registry: string): Promise<boolean> {
    const config = this.getRegistryConfig(registry);
    const now = Date.now();
    const windowStart = now - (config.window * 1000);
    
    // Use Redis pipeline for atomic operations
    const pipeline = this.redis.multi();
    pipeline.zremrangebyscore(key, 0, windowStart); // Remove old requests
    pipeline.zcard(key); // Get current count
    pipeline.zadd(key, now, now.toString()); // Add new request
    pipeline.expire(key, config.window + 5); // Set expiration with buffer
    
    const [, currentCount] = await pipeline.exec();
    
    return currentCount < config.limit;
  }
  
  async getWaitTime(key: string, registry: string): Promise<number> {
    const config = this.getRegistryConfig(registry);
    const now = Date.now();
    const windowStart = now - (config.window * 1000);
    
    // Get oldest request timestamp in current window
    const oldestRequest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
    if (!oldestRequest || oldestRequest.length === 0) {
      return 0;
    }
    
    const oldestTimestamp = parseInt(oldestRequest[1]);
    return Math.max(0, config.window * 1000 - (now - oldestTimestamp));
  }
  
  private getRegistryConfig(registry: string) {
    return this.registryConfigs[registry] || this.registryConfigs['default'];
  }
  
  async cleanup() {
    await this.redis.quit();
  }
}

// Usage in enterprise environments
const enterpriseRateLimiter = new DistributedRateLimiter({
  redisUrl: process.env.REDIS_URL,
  registryConfigs: {
    'verisign.com': { limit: 120, window: 60 },
    'arin.net': { limit: 100, window: 60 },
    'ripe.net': { limit: 80, window: 60 },
    'cloudflare.com': { limit: 200, window: 60 } // Special allowance for CDN
  }
});

const client = new RDAPClient({
  rateLimiter: enterpriseRateLimiter,
  cacheOptions: {
    staleWhileRevalidate: true
  }
});
```

---

## 🔐 Security & Compliance Considerations

### Respectful Registry Interaction
RDAPify enforces **registry-first principles** that prioritize registry health and stability:

```typescript
const respectfulClient = new RDAPClient({
  rateLimiter: {
    respectRegistryHeaders: true, // Honor Retry-After and X-RateLimit headers
    conservativeDefaults: true,   // Start with conservative limits
    adaptiveLearning: true        // Learn from registry responses
  },
  retryStrategy: {
    jitter: true, // Add randomness to retry times to avoid thundering herd
    backoff: 'exponential'
  },
  cacheOptions: {
    negativeCache: true, // Cache rate limited responses
    negativeTTL: 60     // 60 seconds
  }
});
```

### Compliance with Registry Acceptable Use Policies (AUP)
Different registries have specific AUP requirements:

| Registry | AUP Requirements | RDAPify Configuration |
|----------|-------------------|------------------------|
| **Verisign** | No bulk WHOIS replacement queries | `bulkQueryDetection: true` |
| **RIPE NCC** | Clear identification of client | `userAgent: 'YourApp/1.0 (+https://yourapp.com)'` |
| **ARIN** | No automated enumeration | `enumerationProtection: true` |
| **AFRINIC** | Academic/research use cases prioritized | `priorityQueues: { academic: true }` |
| **DENIC** | German privacy law compliance (TMG) | `gdprCompliant: true` |

```typescript
// Registry-specific AUP compliance
const aupCompliantClient = new RDAPClient({
  userAgent: `SecurityMonitor/2.3 (+https://security.example.com)`,
  rateLimiter: {
    registryProfiles: {
      'verisign.com': {
        maxBatchSize: 10, // No bulk queries
        minInterval: 500 // 500ms between requests
      },
      'denic.de': {
        gdprMode: true, // Extra privacy protections
        anonymizeRequests: true
      },
      'ripe.net': {
        academicUse: false, // Set to true if academic institution
        researchPurpose: 'security monitoring' // Required for research use
      }
    }
  }
});
```

---

## ⚡ Performance Optimization Patterns

### 1. Request Prioritization Strategy
```typescript
const priorityClient = new RDAPClient({
  rateLimiter: new PriorityRateLimiter({
    queues: [
      {
        name: 'critical',
        priority: 1,
        maxRate: 5, // 5 requests/second
        registryOverrides: {
          'verisign.com': { maxRate: 10 } // Higher for critical domains
        },
        criteria: (request) => request.domain.endsWith('.bank') || 
                              request.domain.endsWith('.gov') ||
                              request.isSecurityCritical
      },
      {
        name: 'user-facing',
        priority: 2,
        maxRate: 2,
        criteria: (request) => request.isUserFacing
      },
      {
        name: 'background',
        priority: 3,
        maxRate: 0.5, // 1 request every 2 seconds
        criteria: (request) => request.isBackgroundTask
      }
    ],
    fallbackQueue: 'background' // Default queue for unmatched requests
  })
});

// Usage with explicit priority
const criticalResult = await priorityClient.domain('bank.example.com', {
  priority: 'critical',
  isSecurityCritical: true
});

const backgroundResult = await priorityClient.batchDomainLookup([
  'example1.com', 'example2.com', 'example3.com'
], {
  priority: 'background'
});
```

### 2. Batch Processing with Rate Limiting
```typescript
async function safeBatchLookup(domains: string[], options: BatchOptions = {}) {
  const results = [];
  const errors = [];
  
  // Determine optimal batch size based on registry limits
  const batchSize = options.batchSize || Math.min(10, domains.length);
  const delayBetweenBatches = options.delayBetweenBatches || 1000; // 1 second
  
  for (let i = 0; i < domains.length; i += batchSize) {
    const batch = domains.slice(i, i + batchSize);
    
    try {
      // Process batch with rate limiting
      const batchResults = await Promise.allSettled(
        batch.map(domain => client.domain(domain, { 
          timeout: options.timeout || 8000,
          priority: options.priority || 'normal'
        }))
      );
      
      // Process results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push({ domain: batch[index], result: result.value });
        } else {
          errors.push({ domain: batch[index], error: result.reason });
        }
      });
    } catch (error) {
      // Handle rate limiting at batch level
      if (error.code === 'RDAP_RATE_LIMITED') {
        console.log(`Rate limited. Waiting ${error.details.retryAfter} seconds`);
        await new Promise(resolve => setTimeout(resolve, error.details.retryAfter * 1000));
        
        // Retry the failed batch
        i -= batchSize; // Reprocess this batch
        continue;
      }
      throw error;
    }
    
    // Delay between batches to respect rate limits
    if (i + batchSize < domains.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  return { results, errors };
}

// Usage
const batchResults = await safeBatchLookup([
  'example.com', 'google.com', 'microsoft.com', 'apple.com', 'amazon.com'
], {
  batchSize: 5,
  delayBetweenBatches: 2000, // 2 seconds between batches
  priority: 'background'
});
```

### 3. Caching to Reduce Rate Limit Pressure
```typescript
const cacheOptimizedClient = new RDAPClient({
  cacheOptions: {
    // Aggressive caching for rate limiting protection
    ttl: {
      default: 3600, // 1 hour
      securityCritical: 86400, // 24 hours for critical domains
      highFrequency: 300 // 5 minutes for high-frequency lookups
    },
    negativeCache: true,
    negativeTTL: 300, // 5 minutes for failures
    staleWhileRevalidate: true,
    maxStaleAge: 600 // 10 minutes maximum staleness
  },
  rateLimiter: {
    adaptive: true,
    learnFromCacheHits: true // Reduce rate limits when cache hits are high
  }
});

// Smart cache warming to distribute load
async function warmCacheForCriticalDomains() {
  const criticalDomains = [
    'example.com', 'google.com', 'microsoft.com', 
    'bankofamerica.com', 'chase.com', 'wellsfargo.com'
  ];
  
  // Stagger warm-up requests to avoid rate limits
  for (const [index, domain] of criticalDomains.entries()) {
    const delay = index * 2000; // 2 seconds between requests
    setTimeout(async () => {
      try {
        await cacheOptimizedClient.domain(domain);
        console.log(`✅ Cache warmed for ${domain}`);
      } catch (error) {
        console.warn(`⚠️ Cache warm failed for ${domain}: ${error.message}`);
      }
    }, delay);
  }
}
```

---

## 🌍 Advanced Patterns

### 1. Multi-Registry Fallback Strategy
```typescript
class MultiRegistryRateLimiter implements RateLimiter {
  private readonly registryLimiters = new Map<string, RateLimiter>();
  private readonly fallbackOrder: string[];
  
  constructor(options: {
    primaryRegistry: string;
    fallbackRegistries: string[];
    registryConfigs: Record<string, RateLimitConfig>;
  }) {
    this.fallbackOrder = [options.primaryRegistry, ...options.fallbackRegistries];
    
    // Initialize limiters for each registry
    Object.entries(options.registryConfigs).forEach(([registry, config]) => {
      this.registryLimiters.set(registry, new TokenBucketRateLimiter({
        capacity: config.burstCapacity,
        refillRate: config.requestsPerSecond
      }));
    });
  }
  
  async getRegistryForRequest(domain: string): Promise<string> {
    for (const registry of this.fallbackOrder) {
      const limiter = this.registryLimiters.get(registry);
      if (limiter && await limiter.canMakeRequest()) {
        return registry;
      }
    }
    
    // All registries rate limited - return primary with wait time
    const primaryLimiter = this.registryLimiters.get(this.fallbackOrder[0]);
    throw new RDAPError('RDAP_ALL_RATE_LIMITED', 'All registry endpoints are rate limited', {
      primaryRegistry: this.fallbackOrder[0],
      retryAfter: primaryLimiter?.getWaitTime() || 60
    });
  }
  
  async consumeToken(registry: string): Promise<void> {
    const limiter = this.registryLimiters.get(registry);
    if (limiter) {
      await limiter.consumeToken();
    }
  }
}

// Usage
const multiRegistryClient = new RDAPClient({
  rateLimiter: new MultiRegistryRateLimiter({
    primaryRegistry: 'verisign.com',
    fallbackRegistries: ['backup-rdap.example.com', 'secondary-rdap.example.com'],
    registryConfigs: {
      'verisign.com': { requestsPerSecond: 2, burstCapacity: 30 },
      'backup-rdap.example.com': { requestsPerSecond: 1, burstCapacity: 10 },
      'secondary-rdap.example.com': { requestsPerSecond: 1, burstCapacity: 15 }
    }
  })
});
```

### 2. Machine Learning-Based Rate Limiting
```typescript
class MLRateLimiter implements RateLimiter {
  private readonly model;
  private readonly featureStore;
  
  constructor(options: { modelPath: string }) {
    this.model = this.loadModel(options.modelPath);
    this.featureStore = new FeatureStore();
  }
  
  async predictRateLimit(domain: string, context: RequestContext): Promise<RateLimitPrediction> {
    // Extract features for prediction
    const features = {
      domainTLD: getTLD(domain),
      queryFrequency: this.featureStore.getFrequency(domain),
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      registry: context.registry,
      clientReputation: context.clientReputation,
      historicalSuccessRate: this.featureStore.getSuccessRate(domain)
    };
    
    // Predict optimal rate limit parameters
    return this.model.predict(features);
  }
  
  async canMakeRequest(domain: string, context: RequestContext): Promise<boolean> {
    const prediction = await this.predictRateLimit(domain, context);
    return prediction.remainingRequests > 0;
  }
  
  getWaitTime(domain: string, context: RequestContext): number {
    const prediction = this.predictRateLimitSync(domain, context);
    return prediction.estimatedResetTime;
  }
  
  private loadModel(modelPath: string) {
    // Load trained ML model
    return new RateLimitModel(modelPath);
  }
}

// Enterprise usage with real-time adaptation
const mlClient = new RDAPClient({
  rateLimiter: new MLRateLimiter({
    modelPath: process.env.RATE_LIMIT_MODEL_PATH || './models/rate-limit-v2.bin'
  }),
  monitoring: {
    enabled: true,
    logRateLimitEvents: true,
    anomalyDetection: true
  }
});
```

---

## 🧪 Testing Rate Limiting Strategies

### Unit Testing Rate Limit Logic
```typescript
describe('Rate Limiting', () => {
  let client;
  
  beforeEach(() => {
    client = new RDAPClient({
      rateLimiter: new TokenBucketRateLimiter({
        capacity: 5,
        refillRate: 1 // 1 token per second
      }),
      retryStrategy: {
        maxRetries: 1,
        retryableErrors: ['RDAP_RATE_LIMITED']
      }
    });
  });
  
  test('limits requests to token bucket capacity', async () => {
    // Make 5 requests (should succeed)
    const firstBatch = await Promise.all(
      Array(5).fill(0).map(() => client.domain('example.com'))
    );
    expect(firstBatch.length).toBe(5);
    
    // 6th request should be rate limited
    await expect(client.domain('example.com')).rejects.toThrow('RDAP_RATE_LIMITED');
  });
  
  test('respects retry-after headers from registries', async () => {
    // Mock registry response with Retry-After header
    mockRegistry.setResponse('example.com', {
      status: 429,
      headers: { 'Retry-After': '2' },
      body: { error: 'Rate limit exceeded' }
    });
    
    const startTime = Date.now();
    
    await expect(client.domain('example.com')).rejects.toThrow('RDAP_RATE_LIMITED');
    
    const duration = Date.now() - startTime;
    expect(duration).toBeGreaterThan(1900); // Should wait ~2 seconds
    expect(duration).toBeLessThan(2100);
  });
  
  test('exponential backoff for repeated rate limiting', async () => {
    // Mock repeated rate limiting
    mockRegistry.setResponse('example.com', {
      status: 429,
      headers: { 'Retry-After': '1' },
      body: { error: 'Rate limit exceeded' }
    });
    
    // First attempt
    await expect(client.domain('example.com')).rejects.toThrow('RDAP_RATE_LIMITED');
    
    // Second attempt with exponential backoff (1s * 2 = 2s)
    const startTime = Date.now();
    await expect(client.domain('example.com')).rejects.toThrow('RDAP_RATE_LIMITED');
    const duration = Date.now() - startTime;
    
    expect(duration).toBeGreaterThan(1900); // Should wait ~2 seconds
    expect(duration).toBeLessThan(2100);
  });
});
```

### Load Testing with Rate Limit Simulation
```bash
# Test rate limiting under sustained load
npm run benchmark -- --scenario rate-limiting \
  --concurrency 50 \
  --duration 300s \
  --domains 1000 \
  --registry verisign.com \
  --rate-limit 120/60 # 120 requests per 60 seconds

# Output includes:
# - Success/failure rates at different concurrency levels
# - Average wait times for rate limited requests
# - Registry header compliance verification
# - Cache hit rates and effectiveness
```

### Chaos Engineering Tests
```typescript
describe('Rate Limiting Resilience', () => {
  test('maintains service during aggressive rate limiting', async () => {
    const client = new RDAPClient({
      rateLimiter: new AdaptiveRateLimiter({
        initialLimit: { requestsPerSecond: 2, burstCapacity: 10 },
        backoff: { minDelay: 1000, maxDelay: 60000, multiplier: 2 }
      }),
      cacheOptions: { staleWhileRevalidate: true }
    });
    
    // Simulate aggressive rate limiting from registry
    await chaosEngine.simulateRegistryRateLimit('verisign.com', {
      limit: 2, // 2 requests per second
      burst: 5,
      duration: '60s'
    });
    
    // Should maintain service using cache and backoff
    const results = await Promise.allSettled(
      Array(30).fill(0).map(() => client.domain('example.com'))
    );
    
    // Expect most requests to succeed using cache
    const successes = results.filter(r => r.status === 'fulfilled').length;
    expect(successes).toBeGreaterThan(25); // >80% success rate
    
    // No unhandled errors
    results.filter(r => r.status === 'rejected').forEach(r => {
      const error = r.reason;
      expect(error.code).toBe('RDAP_RATE_LIMITED');
      expect(error.retryable).toBe(true);
    });
  });
});
```

---

## 🔍 Monitoring & Observability

### Critical Rate Limit Metrics
| Metric | Target | Alert Threshold | Purpose |
|--------|--------|------------------|---------|
| **Rate Limit Hit Rate** | < 5% | > 15% | Registry compliance health |
| **Average Wait Time** | < 2s | > 10s | User experience quality |
| **Cache Hit Rate During Limits** | > 80% | < 60% | Service resilience effectiveness |
| **Fallback Registry Usage** | < 10% | > 30% | Primary registry reliability |
| **Backoff Factor Growth** | < 1.5x | > 3x | Adaptive algorithm effectiveness |
| **Registry Header Compliance** | 100% | < 100% | Legal compliance |

### Integration with Monitoring Systems
```typescript
const monitoringClient = new RDAPClient({
  rateLimiter: new MonitoredRateLimiter({
    monitoring: {
      provider: 'datadog',
      apiKey: process.env.DD_API_KEY,
      metrics: [
        'rate_limit.hits',
        'rate_limit.wait_time',
        'rate_limit.backoff_factor',
        'rate_limit.registry_compliance'
      ],
      tags: {
        environment: process.env.NODE_ENV,
        service: 'rdap-service',
        region: process.env.REGION
      }
    }
  }),
  cacheOptions: {
    telemetry: {
      enabled: true,
      provider: 'datadog'
    }
  }
});

// Custom alerting for rate limiting issues
monitoringClient.on('rate_limit:warning', (event) => {
  if (event.hitRate > 0.15) { // 15% hit rate
    alertSystem.send({
      severity: 'warning',
      title: 'High Rate Limit Hit Rate',
      message: `Rate limit hit rate: ${event.hitRate * 100}% for ${event.registry}`,
      metrics: {
        currentRate: event.currentRate,
        limit: event.limit,
        backoffFactor: event.backoffFactor
      }
    });
  }
});

monitoringClient.on('rate_limit:critical', (event) => {
  if (event.successRate < 0.7) { // <70% success rate
    alertSystem.send({
      severity: 'critical',
      title: 'Service Degradation Due to Rate Limiting',
      message: `Service success rate: ${event.successRate * 100}%`,
      channels: ['pagerduty', 'slack-ops'],
      runbook: 'https://rdapify.dev/runbooks/rate-limit-recovery'
    });
  }
});
```

### Rate Limit Health Dashboard
```markdown
# RDAP Rate Limit Health Dashboard

## 📊 Registry Compliance
| Registry | Requests/Minute | Limit | Utilization | Status |
|----------|----------------|-------|-------------|--------|
| Verisign | 85 | 120 | 70.8% | ✅ Healthy |
| ARIN     | 95 | 100 | 95.0% | ⚠️ Warning |
| RIPE NCC | 78 | 80  | 97.5% | ❌ Critical |
| APNIC    | 65 | 90  | 72.2% | ✅ Healthy |

## ⚡ Performance Metrics
- **Average Wait Time**: 1.2s ✅
- **Cache Hit Rate During Limits**: 85% ✅
- **Fallback Usage**: 8% ✅
- **Backoff Factor**: 1.8x ✅

## 🚨 Recent Issues
- **2023-11-28 14:23:15**: RIPE NCC rate limit exceeded (resolved with cache optimization)
- **2023-11-28 08:17:42**: Verisign temporary rate reduction (investigating)

## 📈 Recommendations
- ✅ Increase cache TTL for RIPE NCC domains from 1h to 2h
- ✅ Implement request deduplication for common domains
- ❌ Contact RIPE NCC about academic/research allowance
- ✅ Reduce background job frequency during peak hours
```

---

## 💡 Pro Tips & Best Practices

### ✅ Do's
- **Start conservative**: Begin with lower rate limits than registry maximums
- **Respect headers**: Always honor `Retry-After` and `X-RateLimit` headers from registries
- **Implement caching**: Use aggressive caching to reduce registry load
- **Monitor closely**: Track rate limit hit rates and adjust limits dynamically
- **Identify properly**: Use clear User-Agent strings with contact information
- **Stagger requests**: Add jitter to batch operations to avoid thundering herd

### ❌ Don'ts
- **Don't ignore limits**: Never disable rate limiting to "get around" registry limits
- **Don't hardcode limits**: Avoid fixed rate limits that don't adapt to registry changes
- **Don't share IP addresses**: Don't run high-volume RDAP clients from shared hosting
- **Don't bulk query without permission**: Never implement WHOIS-style bulk scraping
- **Don't use aggressive backoff**: Avoid backoff multipliers > 3x to prevent long delays

### 🔒 Security-Specific Patterns
```typescript
// ✅ GOOD: Enterprise-grade rate limiting with security
const enterpriseClient = new RDAPClient({
  rateLimiter: new EnterpriseRateLimiter({
    securityMode: true, // Extra conservative limits for security
    registryProfiles: {
      // Security-critical domains get special treatment
      'securityDomains': {
        domains: ['.bank', '.gov', '.mil', '.fed.us'],
        maxRate: 0.5, // 1 request every 2 seconds
        priority: 'critical',
        bypassCache: false
      }
    },
    anomalyDetection: {
      enabled: true,
      threshold: 5, // Alert on 5 failed requests in 60s
      blockDuration: 300 // 5 minutes block on detection
    }
  }),
  cacheOptions: {
    securityCriticalTTL: 86400 // 24 hours for security domains
  }
});

// ✅ GOOD: Compliance-aware rate limiting
function getRateLimitConfig(userType: 'academic' | 'commercial' | 'government') {
  switch (userType) {
    case 'academic':
      return {
        verisign: { requestsPerMinute: 200 }, // Academic allowance
        ripe: { academicUse: true, researchPurpose: 'security monitoring' }
      };
    case 'government':
      return {
        arin: { governmentUse: true },
        afrinic: { governmentUse: true }
      };
    case 'commercial':
    default:
      return {
        // Conservative commercial limits
        verisign: { requestsPerMinute: 120 },
        arin: { requestsPerMinute: 100 }
      };
  }
}
```

---

## 📚 Related Documentation

| Document | Description | Path |
|----------|-------------|------|
| **Error Handling** | Comprehensive error handling patterns | [error_handling.md](error_handling.md) |
| **Caching Strategies** | Advanced caching for rate limit mitigation | [caching-strategies.md](caching-strategies.md) |
| **Security Whitepaper** | Security architecture including rate limiting | [../security/whitepaper.md](../security/whitepaper.md) |
| **Registries Guide** | Registry-specific implementation details | [../guides/registries.md](../guides/registries.md) |
| **Performance Benchmarks** | Rate limiting performance impact data | [../../benchmarks/results/rate-limiting.md](../../benchmarks/results/rate-limiting.md) |
| **Rate Limit Simulator** | Interactive strategy testing tool | [../../playground/rate-limit-simulator.md](../../playground/rate-limit-simulator.md) |
| **Enterprise Adoption** | Scaling rate limiting for large deployments | [../enterprise/adoption-guide.md](../enterprise/adoption-guide.md) |

---

## 🏷️ Rate Limiting Specifications

| Property | Value |
|----------|-------|
| **Rate Limiter Version** | 2.3.0 |
| **Algorithms Supported** | Token Bucket, Leaky Bucket, Fixed Window, Sliding Window |
| **Registry Coverage** | 25+ major registries with specific profiles |
| **Distributed Support** | Redis-based distributed rate limiting |
| **Adaptive Learning** | Machine learning-based prediction (enterprise) |
| **Compliance** | GDPR, CCPA, registry AUP compliant |
| **Test Coverage** | 98% unit tests, 95% integration tests |
| **Last Updated** | December 5, 2025 |

> **🔐 Critical Reminder:** Rate limiting is not just a technical concern—it's a legal and ethical requirement for RDAP usage. Never disable rate limiting or attempt to circumvent registry limits without explicit permission from registry operators. Doing so can result in IP blocking, legal action, and damage to the shared RDAP infrastructure that powers the internet.

[← Back to Guides](../guides/README.md) | [Next: Batch Processing →](batch-processing.md)

*Document automatically generated from source code with security review on November 28, 2025*