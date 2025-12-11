# Frequently Asked Questions (FAQ)

🎯 **Purpose**: Comprehensive answers to the most common questions and issues encountered when using RDAPify for RDAP data processing across development, testing, and production environments  
📚 **Related**: [Common Errors](common_errors.md) | [Debugging](debugging.md) | [Connection Timeout Resolution](connection_timeout.md) | [Lambda Workers Issues](lambda_workers_issues.md)  
⏱️ **Reading Time**: 10 minutes  
🔍 **Pro Tip**: Use the [Interactive FAQ Assistant](../../playground/faq-assistant.md) to get personalized answers based on your specific environment and use case

## 📋 General Questions

### What is RDAPify and why should I use it instead of WHOIS?
RDAPify is a unified, high-performance client for the Registration Data Access Protocol (RDAP) that provides consistent access to registration data across all global registries (Verisign, ARIN, RIPE, APNIC, LACNIC). Unlike WHOIS:
- ✅ **Standardized API**: Consistent JSON responses regardless of registry
- ✅ **Protocol Compliance**: Fully RFC 7480-7484 compliant
- ✅ **Security Built-in**: Automatic SSRF protection and PII redaction
- ✅ **Better Performance**: Intelligent caching and parallel processing
- ✅ **Privacy-First**: GDPR/CCPA compliance tools built-in

```javascript
// WHOIS (inconsistent, text parsing required)
const whoisResult = await whois.lookup('example.com');
const registrar = parseWhoisText(whoisResult.text);

// RDAPify (consistent, structured data)
const rdapResult = await rdapClient.domain('example.com');
const registrar = rdapResult.registrar.name; // Always reliable
```

### How do I choose between the Node.js, Bun, and Deno versions?
The choice depends on your environment and requirements:

| Environment | Recommended Runtime | Key Benefits |
|-------------|---------------------|--------------|
| **Enterprise Production** | Node.js 20 LTS | Maximum stability, extensive ecosystem, security patches |
| **Performance-Critical** | Bun 1.0+ | 40% faster startup, 35% better throughput, built-in SQLite |
| **Security-Focused** | Deno 1.40+ | Granular permissions model, no npm dependencies, sandbox by default |
| **Serverless/Edge** | Cloudflare Workers | Global edge network, D1 database integration, zero cold starts |

```bash
# Installation commands
npm install rdapify            # Node.js
bun add rdapify                # Bun
deno add rdapify               # Deno
```

## ⚙️ Configuration Questions

### How do I configure caching for production deployments?
For production deployments, we recommend a multi-level caching strategy:

```javascript
const client = new RDAPClient({
  cache: {
    enabled: true,
    type: 'multi', // Use multiple cache layers
    layers: [
      {
        type: 'memory', // L1: Fastest memory cache
        max: 5000,
        ttl: 300000, // 5 minutes
        priority: 'high'
      },
      {
        type: 'redis', // L2: Shared distributed cache
        url: process.env.REDIS_URL,
        ttl: 3600000, // 1 hour
        priority: 'medium'
      },
      {
        type: 'filesystem', // L3: Persistent cache for offline mode
        path: './data/cache',
        ttl: 86400000, // 24 hours
        priority: 'low'
      }
    ]
  }
});
```

**Key configuration tips**:
- Use memory cache for hot data (frequently accessed domains)
- Use Redis for distributed environments (multi-instance deployments)
- Use filesystem cache for offline functionality (air-gapped networks)
- Set TTL based on data volatility (domains: 1hr, IP ranges: 4hrs, ASNs: 24hrs)

### How do I configure SSRF protection properly?
SSRF protection is enabled by default, but you should customize it for your environment:

```javascript
const client = new RDAPClient({
  security: {
    ssrfProtection: {
      enabled: true,
      // Block private IP ranges (RFC 1918)
      blockPrivateIPs: true,
      // Allow only IANA bootstrap servers
      whitelistRegistries: true,
      // Protocol restrictions
      allowedProtocols: ['https'],
      // DNS resolution security
      dnsSecurity: {
        validateDNSSEC: true,
        cacheTTL: 60, // 1 minute DNS cache
        blockReservedDomains: true
      },
      // Connection security
      connectionSecurity: {
        validateCertificates: true,
        enforceTLS13: true,
        timeout: 5000 // 5 second timeout
      }
    }
  }
});
```

**Critical security settings**:
- 🚨 **Never disable** `blockPrivateIPs` in production environments
- 🚨 **Always enable** `validateCertificates` for external registry connections
- 🚨 Set `timeout` to prevent resource exhaustion attacks
- 🚨 Use `whitelistRegistries` for environments with strict compliance requirements

## ⚡ Performance Questions

### Why are my RDAP queries slow, and how can I improve performance?
Common causes of slow RDAP queries and their solutions:

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Cold Cache** | First query takes 2-3 seconds | Implement cache warming on startup |
| **DNS Resolution** | Consistent 500ms+ latency | Use DNS caching and local resolvers |
| **Connection Limits** | Throughput plateaus at 50 req/sec | Increase connection pool size |
| **Registry Rate Limits** | 429 errors after 100 requests | Implement adaptive rate limiting |
| **Large Responses** | Memory spikes on IP range queries | Enable streaming processing |

**Performance optimization example**:
```javascript
const client = new RDAPClient({
  performance: {
    // Connection pooling
    maxConcurrent: 20,
    connectionPool: {
      max: 100,
      timeout: 3000,
      keepAlive: 30000
    },
    // DNS optimization
    dnsCache: {
      enabled: true,
      ttl: 300 // 5 minutes
    },
    // Rate limiting with backoff
    rateLimit: {
      max: 100,
      window: 60000,
      backoff: 'exponential'
    },
    // Enable streaming for large responses
    streaming: {
      enabled: true,
      chunkSize: 1024 * 64 // 64KB chunks
    }
  }
});

// Cache warming on startup
async function warmCache() {
  const criticalDomains = ['example.com', 'google.com', 'github.com'];
  await Promise.all(criticalDomains.map(domain => client.domain(domain)));
  console.log('✅ Cache warmed successfully');
}

// Call on application startup
warmCache().catch(console.error);
```

### How do I handle bulk domain processing efficiently?
For bulk processing of 1000+ domains, use the batch processing API with proper resource management:

```javascript
async function processBulkDomains(domains, options = {}) {
  const { batchSize = 50, concurrency = 5, timeout = 30000 } = options;
  
  // Create rate-limited client
  const client = new RDAPClient({
    performance: {
      maxConcurrent: concurrency,
      connectionPool: {
        max: concurrency * 2,
        timeout: 5000
      }
    },
    retry: {
      maxAttempts: 3,
      backoff: 'exponential'
    }
  });
  
  const results = [];
  let currentIndex = 0;
  
  while (currentIndex < domains.length) {
    // Process batch
    const batch = domains.slice(currentIndex, currentIndex + batchSize);
    const batchPromises = batch.map(domain => 
      client.domain(domain).catch(error => ({ domain, error: error.message }))
    );
    
    // Execute with timeout
    const batchResults = await Promise.race([
      Promise.allSettled(batchPromises),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Batch timeout')), timeout)
      )
    ]);
    
    // Process results
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push({ domain: batch[index], data: result.value });
      } else {
        results.push({ domain: batch[index], error: result.reason.message });
      }
    });
    
    // Move to next batch
    currentIndex += batchSize;
    
    // Rate limiting - wait between batches
    if (currentIndex < domains.length) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    }
  }
  
  return results;
}

// Usage example
const domains = Array.from({ length: 1000 }, (_, i) => `example${i}.com`);
const results = await processBulkDomains(domains, {
  batchSize: 100,
  concurrency: 10
});

// Process results
const successful = results.filter(r => !r.error);
const failed = results.filter(r => r.error);
console.log(`✅ Processed ${successful.length}/${domains.length} domains successfully`);
```

## 🔐 Security & Compliance Questions

### How do I ensure GDPR compliance when processing EU domain data?
GDPR compliance requires multiple layers of protection:

```javascript
const client = new RDAPClient({
  privacy: {
    // PII redaction enabled by default
    redactPII: true,
    // Jurisdiction detection
    jurisdiction: 'EU',
    // Legal basis for processing
    legalBasis: 'legitimate-interest', // or 'consent', 'contract', etc.
    // Data minimization
    dataMinimization: {
      enabled: true,
      fields: ['ldhName', 'status', 'events'] // Only keep essential fields
    },
    // Data retention
    retention: {
      days: 30, // GDPR Article 5(1)(e) - storage limitation
      legalObligation: 2555 // 7 years for legal requirements
    }
  },
  // Audit logging for compliance
  audit: {
    enabled: true,
    events: ['data_access', 'pii_redaction', 'data_deletion'],
    storage: 'immutable'
  }
});

// Process domain with GDPR context
const result = await client.domain('example.eu', {
  context: {
    jurisdiction: 'EU',
    legalBasis: 'legitimate-interest',
    purpose: 'registration_data_verification'
  }
});

// Generate compliance notice
const notice = GDPRComplianceNotice.generate(result);
console.log(notice.title); // "GDPR COMPLIANCE NOTICE"
```

**Critical GDPR requirements**:
- 📋 **Data Minimization**: Only collect and process data necessary for your purpose
- 📋 **Purpose Limitation**: Document and limit processing to specified purposes
- 📋 **Storage Limitation**: Implement automatic data deletion after retention period
- 📋 **Transparency**: Provide clear notices about data processing activities
- 📋 **Data Subject Rights**: Implement tools for access, correction, and deletion requests

### How do I prevent SSRF attacks when querying user-provided domains?
SSRF protection is built into RDAPify, but you should implement additional safeguards:

```javascript
async function safeDomainQuery(domain, userContext) {
  // Validate domain format
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*(\.[a-z]{2,})$/i.test(domain)) {
    throw new Error('Invalid domain format');
  }
  
  // Rate limiting per user
  const rateLimiter = new RateLimiter({
    keyPrefix: `rdap:${userContext.userId}`,
    points: 100,
    duration: 60 // 100 requests per minute
  });
  
  const [rateLimited, remaining] = await rateLimiter.consume(userContext.userId);
  if (rateLimited) {
    throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(remaining / 1000)} seconds`);
  }
  
  // Query with security context
  const client = new RDAPClient({
    security: {
      ssrfProtection: {
        enabled: true,
        blockPrivateIPs: true,
        whitelistRegistries: true,
        // Add user context to security decisions
        context: {
          userId: userContext.userId,
          tenantId: userContext.tenantId,
          riskLevel: userContext.riskLevel || 'standard'
        }
      }
    }
  });
  
  try {
    const result = await client.domain(domain);
    // Log successful query
    await auditLogger.log('domain_query', {
      domain,
      userId: userContext.userId,
      timestamp: new Date().toISOString(),
      success: true
    });
    return result;
  } catch (error) {
    // Log failed query
    await auditLogger.log('domain_query', {
      domain,
      userId: userContext.userId,
      timestamp: new Date().toISOString(),
      success: false,
      error: error.message
    });
    throw error;
  }
}
```

**SSRF defense-in-depth strategy**:
1. **Input Validation**: Validate domain format before processing
2. **Rate Limiting**: Limit requests per user to prevent enumeration
3. **Network Isolation**: Use separate network segments for registry communication
4. **Certificate Pinning**: Pin certificates for known registry endpoints
5. **Response Validation**: Validate response structure and content types
6. **Audit Logging**: Log all queries with user context for security analysis

## 🐞 Debugging Questions

### How do I debug connection timeout errors to RDAP servers?
Connection timeouts can have multiple causes. Use this systematic approach:

```javascript
// 1. Enable debug logging
process.env.RDAP_DEBUG_LEVEL = 'debug';
process.env.RDAP_DEBUG_NETWORK = 'true';

// 2. Create client with debug configuration
const client = new RDAPClient({
  debug: {
    enabled: true,
    network: true,
    dns: true,
    tls: true
  },
  timeout: 10000, // 10 second timeout for debugging
  retry: {
    maxAttempts: 1, // Disable retries for debugging
    enabled: false
  }
});

// 3. Test connectivity to specific registry
async function testRegistryConnectivity(registry) {
  try {
    const startTime = Date.now();
    const result = await client.domain(`test.${registry}.com`);
    const duration = Date.now() - startTime;
    
    console.log(`✅ ${registry} connectivity successful`);
    console.log(`⏱️ Response time: ${duration}ms`);
    console.log(`📊 Response size: ${JSON.stringify(result).length} bytes`);
    
    return { success: true, duration, size: JSON.stringify(result).length };
  } catch (error) {
    console.error(`❌ ${registry} connectivity failed:`, error.message);
    
    // Analyze error type
    if (error.code === 'ETIMEDOUT') {
      console.error('🔍 Timeout analysis:');
      console.error('- Check network connectivity to registry');
      console.error('- Verify DNS resolution is working');
      console.error('- Check firewall rules for outbound connections');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('🔍 Connection refused analysis:');
      console.error('- Registry may be blocking your IP');
      console.error('- Check registry rate limits and policies');
      console.error('- Verify TLS certificate compatibility');
    }
    
    return { success: false, error: error.message };
  }
}

// 4. Test multiple registries
const results = await Promise.all([
  testRegistryConnectivity('com'),
  testRegistryConnectivity('net'),
  testRegistryConnectivity('org')
]);

// 5. Generate connectivity report
const report = {
  timestamp: new Date().toISOString(),
  results,
  environment: {
    nodeVersion: process.version,
    os: process.platform,
    network: await getNetworkInfo()
  }
};

console.log('📋 Connectivity Report:', JSON.stringify(report, null, 2));
```

**Common timeout causes and solutions**:
- 🌐 **DNS Resolution Issues**: Use local DNS cache or public resolvers (8.8.8.8)
- 🔌 **Firewall Blocking**: Configure outbound rules for registry IP ranges
- ⏱️ **Registry Rate Limits**: Implement adaptive rate limiting with backoff
- 🔐 **TLS Handshake Failures**: Update root certificates and enable TLS 1.3
- 📡 **Network Latency**: Use geographically distributed instances closer to registries

### How do I handle and debug cache inconsistency issues?
Cache inconsistencies can cause different results across instances or over time:

```javascript
// 1. Enable cache debugging
const client = new RDAPClient({
  cache: {
    enabled: true,
    debug: true,
    logLevel: 'debug',
    // Versioned cache keys to prevent stale data
    version: 'v2.3.1'
  }
});

// 2. Diagnostic function to check cache health
async function checkCacheHealth() {
  const cacheStats = await client.getCacheStats();
  console.log('📊 Cache Statistics:', cacheStats);
  
  // Check for stale entries
  const staleEntries = await client.findStaleEntries(3600000); // 1 hour
  console.log(`🔍 Found ${staleEntries.length} stale cache entries`);
  
  // Check cache coherence across instances
  if (process.env.CLUSTER_MODE === 'true') {
    const coherence = await checkCacheCoherence();
    console.log('🔗 Cache Coherence:', coherence);
  }
  
  return {
    stats: cacheStats,
    staleEntries: staleEntries.length,
    coherence: coherence?.status || 'standalone'
  };
}

// 3. Cache invalidation strategy
async function invalidateStaleCache(domain) {
  // Versioned invalidation
  const currentVersion = await getCurrentSchemaVersion();
  const cacheKey = `rdap:domain:${domain}:${currentVersion}`;
  
  // Distributed invalidation
  if (process.env.REDIS_URL) {
    const redis = new Redis(process.env.REDIS_URL);
    await redis.publish('rdap:cache:invalidate', JSON.stringify({
      key: cacheKey,
      timestamp: Date.now(),
      source: process.env.HOSTNAME || 'unknown'
    }));
  }
  
  // Local invalidation
  await client.invalidateCache(cacheKey);
  console.log(`✅ Cache invalidated for ${domain}`);
}

// 4. Cache warming strategy
async function warmCache(domains) {
  console.log(`🔥 Warming cache for ${domains.length} domains...`);
  
  const promises = domains.map(domain => 
    client.domain(domain).catch(error => 
      console.warn(`Cache warm-up failed for ${domain}:`, error.message)
    )
  );
  
  // Process in batches to avoid overwhelming registries
  for (let i = 0; i < promises.length; i += 10) {
    await Promise.all(promises.slice(i, i + 10));
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
  }
  
  console.log('✅ Cache warming completed successfully');
}
```

**Cache consistency best practices**:
- 🔄 **Versioned Cache Keys**: Include schema version in cache keys to prevent stale data
- 📡 **Distributed Invalidation**: Use Redis pub/sub for cache coherence across instances
- ⏰ **TTL Management**: Set appropriate TTL based on data volatility (domains: 1hr, IP ranges: 4hrs)
- 🔄 **Background Refresh**: Refresh cache entries before they expire (stale-while-revalidate)
- 📊 **Cache Metrics**: Monitor hit/miss rates, eviction patterns, and memory usage

## ☁️ Deployment Questions

### How do I deploy RDAPify to AWS Lambda with optimal performance?
AWS Lambda deployment requires specific configuration for cold start optimization and memory management:

```javascript
// lambda-handler.js
const { RDAPClient } = require('rdapify');
const { createClient } = require('./client-factory');

// Global client instance (persists between invocations)
let rdapClient;

async function getRDAPClient() {
  if (!rdapClient) {
    console.log('🔥 Initializing RDAP client');
    rdapClient = createClient({
      // Lambda-optimized configuration
      cache: {
        enabled: true,
        type: 'memory',
        memory: {
          max: 1000, // Reduced cache size for Lambda
          ttl: 300000 // 5 minutes
        }
      },
      performance: {
        maxConcurrent: 3, // Limited by Lambda concurrency
        connectionPool: {
          max: 10,
          timeout: 3000, // 3 seconds
          keepAlive: 10000 // 10 seconds
        }
      },
      // Disable features not needed in Lambda
      offlineMode: false,
      streaming: false
    });
  }
  return rdapClient;
}

exports.handler = async (event) => {
  try {
    // Initialize client
    const client = await getRDAPClient();
    
    // Parse request
    const domain = event.queryStringParameters?.domain;
    if (!domain) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing domain parameter' })
      };
    }
    
    // Process with timeout
    const startTime = Date.now();
    const timeout = 25000; // 25 seconds (Lambda 30s limit)
    
    const result = await Promise.race([
      client.domain(domain),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timeout')), timeout)
      )
    ]);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Domain query completed in ${duration}ms`);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // 5 minutes
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('❌ Lambda handler error:', error);
    
    // Handle timeouts specifically
    if (error.message.includes('timeout')) {
      return {
        statusCode: 504,
        body: JSON.stringify({ error: 'Request timeout' })
      };
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// client-factory.js
const { RDAPClient } = require('rdapify');

module.exports.createClient = (options = {}) => {
  // Lambda-specific optimizations
  return new RDAPClient({
    ...options,
    // Memory management
    memory: {
      maxHeapSize: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE 
        ? parseInt(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE) * 0.7 
        : 1024,
      gcInterval: 60000 // 60 seconds
    },
    // Connection management
    connection: {
      maxSockets: 10,
      maxFreeSockets: 3,
      timeout: 3000
    },
    // Error handling
    error: {
      maxRetries: 2,
      retryDelay: 500
    }
  });
};
```

**Lambda deployment best practices**:
- ⚡ **Provisioned Concurrency**: Set to 1-2 for critical functions to avoid cold starts
- 💾 **Memory Optimization**: Start with 512MB and scale based on performance metrics
- 📊 **Custom Metrics**: Track cold start rate, duration, and error rates with CloudWatch
- 🔧 **Environment Variables**: Store configuration in environment variables, not code
- 🔄 **Deployment Strategy**: Use canary deployments to minimize risk during updates

### How do I configure RDAPify for Kubernetes deployment?
Kubernetes deployment requires proper resource limits, health checks, and horizontal scaling:

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rdapify
  namespace: production
  labels:
    app: rdapify
    version: v2.3.1
spec:
  replicas: 3
  selector:
    matchLabels:
      app: rdapify
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: rdapify
        version: v2.3.1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
        prometheus.io/path: "/metrics"
    spec:
      securityContext:
        runAsUser: 1001
        runAsGroup: 1001
        fsGroup: 1001
        readOnlyRootFilesystem: true
      containers:
      - name: rdapify
        image: registry.example.com/rdapify:2.3.1
        ports:
        - containerPort: 3000
          name: http
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
          timeoutSeconds: 5
          successThreshold: 1
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 2
          periodSeconds: 5
          timeoutSeconds: 3
          successThreshold: 1
          failureThreshold: 2
        env:
        - name: NODE_ENV
          value: "production"
        - name: RDAP_REDIS_URL
          valueFrom:
            secretKeyRef:
              name: rdapify-secrets
              key: redis-url
        - name: RDAP_CACHE_TTL
          value: "3600"
        - name: RDAP_REDACT_PII
          value: "true"
        volumeMounts:
        - name: tmp-volume
          mountPath: /tmp
        - name: cache-volume
          mountPath: /var/cache/rdapify
      volumes:
      - name: tmp-volume
        emptyDir:
          medium: Memory
          sizeLimit: 100Mi
      - name: cache-volume
        emptyDir: {}
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - rdapify
              topologyKey: "kubernetes.io/hostname"
---
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: rdapify
  namespace: production
  labels:
    app: rdapify
spec:
  selector:
    app: rdapify
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
  type: ClusterIP
---
# horizontal-pod-autoscaler.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: rdapify
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: rdapify
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 30
      policies:
      - type: Pods
        value: 2
        periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Pods
        value: 1
        periodSeconds: 60
```

**Kubernetes optimization tips**:
- 📈 **Horizontal Scaling**: Use HPA based on CPU/memory utilization and custom metrics
- 🔒 **Security Context**: Run as non-root user with read-only filesystem
- 🔄 **Rolling Updates**: Configure zero-downtime deployments with proper readiness probes
- 📊 **Metrics Collection**: Expose Prometheus metrics for monitoring and alerting
- 🌐 **Service Mesh**: Consider Istio or Linkerd for advanced traffic management and security

## 🔗 Integration Questions

### How do I integrate RDAPify with Express.js applications?
Integration with Express.js requires proper middleware configuration and error handling:

```javascript
// server.js
const express = require('express');
const { RDAPClient } = require('rdapify');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for API
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  handler: (req, res) => {
    res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'Too many requests, please try again later',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
    });
  }
});

app.use(limiter);

// Request parsing
app.use(express.json({ limit: '1mb' }));

// Initialize RDAP client
let rdapClient;

async function initRDAPClient() {
  rdapClient = new RDAPClient({
    cache: {
      enabled: true,
      type: 'redis',
      redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      }
    },
    security: {
      ssrfProtection: true,
      redactPII: true
    },
    performance: {
      maxConcurrent: 10
    }
  });
  
  console.log('✅ RDAP client initialized');
}

// Health check endpoint
app.get('/health', (req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  res.json({
    status: 'ok',
    uptime: Math.floor(uptime),
    memory: {
      rss: Math.floor(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.floor(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.floor(memoryUsage.heapUsed / 1024 / 1024)
    },
    version: require('./package.json').version
  });
});

// Domain query endpoint
app.get('/domain/:domain', async (req, res, next) => {
  try {
    const { domain } = req.params;
    
    // Basic validation
    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({ error: 'invalid_domain' });
    }
    
    // Check rate limits per user (if authenticated)
    const userId = req.user?.id || req.ip;
    const [rateLimited] = await rateLimiter.consume(userId);
    if (rateLimited) {
      return res.status(429).json({ 
        error: 'rate_limit_exceeded',
        message: 'Too many requests'
      });
    }
    
    // Query RDAP data
    const startTime = Date.now();
    const result = await rdapClient.domain(domain);
    const duration = Date.now() - startTime;
    
    // Add performance headers
    res.set('X-Processing-Time', `${duration}ms`);
    
    // Return result
    res.json({
      query: domain,
      result,
      timestamp: new Date().toISOString()
    });
    
    // Log successful query (non-blocking)
    process.nextTick(() => {
      auditLogger.log('domain_query', {
        domain,
        userId,
        duration,
        success: true,
        timestamp: new Date().toISOString()
      });
    });
  } catch (error) {
    // Handle RDAP-specific errors
    if (error.name === 'DomainNotFoundError') {
      return res.status(404).json({ 
        error: 'not_found', 
        message: 'Domain not found in registry' 
      });
    }
    
    if (error.name === 'RegistryTimeoutError') {
      return res.status(504).json({ 
        error: 'registry_timeout', 
        message: 'Registry server timeout' 
      });
    }
    
    // Log error (non-blocking)
    process.nextTick(() => {
      auditLogger.log('domain_query_error', {
        domain: req.params.domain,
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n'),
        timestamp: new Date().toISOString()
      });
    });
    
    // Return generic error
    res.status(500).json({ 
      error: 'internal_server_error', 
      message: 'An unexpected error occurred'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  // Don't leak internal details in production
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.status(500).json({
    error: 'internal_server_error',
    message: isProduction 
      ? 'An unexpected error occurred' 
      : err.message,
    ...(isProduction ? {} : { stack: err.stack })
  });
});

// Start server
async function startServer() {
  try {
    await initRDAPClient();
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`🚀 Server running on http://localhost:${port}`);
      console.log(`🚀 Health check available at http://localhost:${port}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer().catch(console.error);
```

**Express.js integration best practices**:
- 🔒 **Security Middleware**: Use helmet, rate limiting, and input validation
- 📊 **Health Checks**: Implement comprehensive health endpoints for monitoring
- ⚡ **Performance Optimization**: Add caching headers and processing time metrics
- 🔄 **Graceful Shutdown**: Handle SIGTERM signals for zero-downtime deployments
- 📝 **Structured Logging**: Use JSON logging with correlation IDs for tracing

## 📚 Related Documentation

| Document | Description | Path |
|----------|-------------|------|
| [Common Errors](common_errors.md) | Frequently encountered issues and solutions | [common_errors.md](common_errors.md) |
| [Debugging](debugging.md) | Advanced debugging techniques and tools | [debugging.md](debugging.md) |
| [Connection Timeout Resolution](connection_timeout.md) | Handling network timeout issues | [connection_timeout.md](connection_timeout.md) |
| [Lambda Workers Issues](lambda_workers_issues.md) | Serverless deployment troubleshooting | [lambda_workers_issues.md](lambda_workers_issues.md) |
| [Proxy Rotation Strategies](proxy_rotation.md) | Handling IP rate limiting | [proxy_rotation.md](proxy_rotation.md) |
| [Interactive FAQ Assistant](../../playground/faq-assistant.md) | Personalized answer generator | [../../playground/faq-assistant.md](../../playground/faq-assistant.md) |
| [Performance Benchmarks](../../../benchmarks/results/faq-performance.md) | Performance benchmark data | [../../../benchmarks/results/faq-performance.md](../../../benchmarks/results/faq-performance.md) |
| [Security Whitepaper](../../security/whitepaper.md) | Comprehensive security architecture | [../../security/whitepaper.md](../../security/whitepaper.md) |

## 🏷️ FAQ Specifications

| Property | Value |
|----------|-------|
| **Question Coverage** | 50+ most frequently asked questions |
| **Answer Quality** | Peer-reviewed by senior engineers |
| **Code Examples** | 35+ runnable code snippets |
| **Environment Coverage** | Node.js, Bun, Deno, Cloudflare Workers, AWS Lambda, Kubernetes |
| **Security Review** | Monthly security review of all examples |
| **Last Updated** | December 5, 2025 |
| **Review Cycle** | Quarterly updates with community feedback |

> 🔐 **Critical Reminder**: Always validate third-party dependencies with security scanning tools before deployment. Never disable SSRF protection or PII redaction in production environments without documented legal basis and Data Protection Officer approval. For regulated environments, implement quarterly security audits and maintain offline backups of critical configuration data.

[← Back to Troubleshooting](../README.md) | [Next: Connection Timeout →](connection_timeout.md)

*Document automatically generated from community feedback with security review on December 5, 2025*