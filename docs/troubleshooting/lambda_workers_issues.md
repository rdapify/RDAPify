# Lambda Workers Issues Troubleshooting

🎯 **Purpose**: Comprehensive guide to diagnosing and resolving issues specific to AWS Lambda deployments of RDAPify with practical troubleshooting techniques, performance optimization strategies, and compliance-aware configurations  
📚 **Related**: [Common Errors](common_errors.md) | [Debugging](debugging.md) | [Connection Timeout Resolution](connection_timeout.md) | [Proxy Rotation](proxy_rotation.md)  
⏱️ **Reading Time**: 7 minutes  
🔍 **Pro Tip**: Use the [Lambda Performance Inspector](../../playground/lambda-inspector.md) to automatically analyze your Lambda configuration and identify optimization opportunities

## 📋 Lambda-Specific Error Classification

AWS Lambda deployments introduce unique challenges for RDAPify applications due to the serverless execution model's constraints and behaviors:

| Error Category | Lambda-Specific Causes | Impact | Detection Difficulty |
|----------------|------------------------|--------|----------------------|
| **Cold Start Failures** | Large deployment packages, VPC initialization, registry bootstrap | High latency on first invocation | Medium |
| **Memory Exhaustion** | Cache sizing issues, large batch processing | Function crashes, data loss | High |
| **Timeout Errors** | Network latency to registries, large response processing | Partial data, retry storms | Medium |
| **VPC Configuration** | Security group misconfiguration, NAT gateway limits | Connection failures, timeouts | High |
| **Concurrent Execution Limits** | AWS account limits, burst capacity exhaustion | Throttled requests, failed operations | Low |
| **Temporary Storage Limits** | `/tmp` directory overflow, cache persistence issues | Function crashes, data corruption | Medium |

## 🔥 Critical Lambda Issues

### 1. Cold Start Timeouts with Registry Bootstrap

**Symptoms**:
```log
2025-12-05T14:30:22.123Z ERROR TimeoutError: Connection timed out after 10000ms
    at Timeout.<anonymous> (/var/task/node_modules/rdapify/dist/network/connection.js:124:16)
    at listOnTimeout (internal/timers.js:554:17)
    at processTimers (internal/timers.js:497:7) {
  name: 'TimeoutError',
  registry: 'verisign',
  domain: 'example.com'
}
```

**Root Causes**:
- IANA bootstrap initialization during cold start exceeding Lambda timeout
- VPC cold start adding 8-10 seconds to initialization time
- Large deployment package size delaying module loading
- Registry DNS resolution during initialization phase

**Diagnostic Steps**:
```bash
# Check Lambda initialization time in CloudWatch Logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/rdapify-prod \
  --start-time $(date -d '1 hour ago' +%s000) \
  --filter-pattern '"INIT_START" OR "INIT_END"' \
  --query 'events[*].{timestamp:timestamp,message:message}' \
  --output table

# Measure bootstrap initialization time
aws lambda invoke \
  --function-name rdapify-prod \
  --payload '{"domain": "example.com", "debug": {"bootstrap": true}}' \
  output.json
```

**Solutions**:
✅ **Pre-Warmed Bootstrap Cache**:
```javascript
// lib/bootstrap-cache.js
const bootstrapCache = {
  data: null,
  timestamp: 0,
  ttl: 300000, // 5 minutes
  
  async get() {
    if (this.data && Date.now() - this.timestamp < this.ttl) {
      console.log('✅ Returning cached bootstrap data');
      return this.data;
    }
    
    console.log('🔄 Fetching fresh bootstrap data');
    this.data = await fetchIANABootstrap();
    this.timestamp = Date.now();
    return this.data;
  },
  
  async initialize() {
    // Force initialization during deployment
    await this.get();
    console.log('🚀 Bootstrap cache pre-warmed');
  }
};

// Initialize cache during Lambda deployment
if (process.env.NODE_ENV === 'production') {
  bootstrapCache.initialize().catch(console.error);
}

module.exports = bootstrapCache;
```

✅ **Initialization Guard Pattern**:
```javascript
// handlers/domain.js
const bootstrapCache = require('../lib/bootstrap-cache');
let isInitialized = false;
let initializationPromise = null;

async function ensureInitialized() {
  if (isInitialized) return;
  
  if (initializationPromise) {
    return initializationPromise;
  }
  
  initializationPromise = bootstrapCache.get()
    .then(() => {
      isInitialized = true;
      initializationPromise = null;
      console.log('✅ RDAPify client initialized');
    });
  
  return initializationPromise;
}

exports.handler = async (event) => {
  try {
    // Start initialization in background
    const initPromise = ensureInitialized();
    
    // Process request while initialization continues
    const domain = event.queryStringParameters?.domain;
    
    if (!domain) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing domain parameter' })
      };
    }
    
    // Wait for initialization to complete before processing
    await initPromise;
    
    // Process domain query
    const result = await global.rdapClient.domain(domain);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('❌ Lambda handler error:', error);
    
    // Return meaningful error with initialization status
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'internal_server_error',
        message: 'Failed to process request',
        initializationStatus: isInitialized ? 'complete' : 'in_progress'
      })
    };
  }
};

// Initialize client during Lambda import phase
global.rdapClient = new RDAPClient({
  cache: {
    enabled: true,
    type: 'memory',
    memory: {
      max: 500, // Limited cache size for Lambda
      ttl: 300000 // 5 minutes
    }
  },
  performance: {
    maxConcurrent: 3, // Limited by Lambda concurrency
    connectionPool: {
      max: 10,
      timeout: 3000
    }
  }
});
```

## ⚡ Performance Optimization Patterns

### 1. Memory Management Strategies
```javascript
// lib/memory-optimizer.js
const { performance } = require('perf_hooks');

class LambdaMemoryOptimizer {
  constructor(options = {}) {
    this.options = {
      maxHeapSize: options.maxHeapSize || 384 * 1024 * 1024, // 384MB default
      gcInterval: options.gcInterval || 60000, // 60 seconds
      cacheSizeMultiplier: options.cacheSizeMultiplier || 0.3,
      enableHeapSnapshots: options.enableHeapSnapshots || false
    };
    
    this.gcTimer = null;
    this.heapSnapshots = [];
    this.lastGcTime = 0;
  }
  
  initialize() {
    // Set Node.js memory limits
    process.env.NODE_OPTIONS = `--max-old-space-size=${this.options.maxHeapSize / 1024 / 1024}`;
    
    // Start garbage collection timer
    this.startGcTimer();
    
    // Monitor memory usage
    this.monitorMemory();
    
    console.log(`Intialized LambdaMemoryOptimizer with ${this.options.maxHeapSize / 1024 / 1024}MB heap limit`);
  }
  
  startGcTimer() {
    this.gcTimer = setInterval(() => {
      if (Date.now() - this.lastGcTime > this.options.gcInterval) {
        this.forceGc();
      }
    }, this.options.gcInterval);
  }
  
  forceGc() {
    if (typeof global.gc === 'function') {
      console.log(`🧹 Forcing garbage collection at ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB`);
      const start = performance.now();
      global.gc();
      const duration = performance.now() - start;
      console.log(`✅ GC completed in ${duration.toFixed(1)}ms, heap: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB`);
      this.lastGcTime = Date.now();
      
      // Take heap snapshot if enabled
      if (this.options.enableHeapSnapshots) {
        this.takeHeapSnapshot();
      }
    }
  }
  
  takeHeapSnapshot() {
    try {
      // This would require heap snapshot API in production
      // For now, log memory usage pattern
      const usage = process.memoryUsage();
      this.heapSnapshots.push({
        timestamp: Date.now(),
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        rss: usage.rss,
        external: usage.external
      });
      
      // Keep only last 10 snapshots
      if (this.heapSnapshots.length > 10) {
        this.heapSnapshots.shift();
      }
      
      console.log(`📸 Heap snapshot taken: ${usage.heapUsed / 1024 / 1024}MB used`);
    } catch (error) {
      console.warn('Heap snapshot failed:', error.message);
    }
  }
  
  monitorMemory() {
    const interval = setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedMB = usage.heapUsed / 1024 / 1024;
      const heapLimitMB = this.options.maxHeapSize / 1024 / 1024;
      
      console.log(`📊 Memory usage: ${heapUsedMB.toFixed(2)}/${heapLimitMB}MB (${(heapUsedMB / heapLimitMB * 100).toFixed(1)}%)`);
      
      // Trigger GC if approaching limit
      if (heapUsedMB > heapLimitMB * 0.8) {
        console.warn(`MemoryWarning Memory threshold exceeded: ${heapUsedMB.toFixed(2)}/${heapLimitMB}MB`);
        this.forceGc();
      }
      
      // Emergency shutdown if critically high
      if (heapUsedMB > heapLimitMB * 0.95) {
        console.error(`🚨 CRITICAL: Memory usage ${heapUsedMB.toFixed(2)}/${heapLimitMB}MB - triggering emergency shutdown`);
        clearInterval(interval);
        process.exit(1);
      }
    }, 30000); // Every 30 seconds
    
    // Clean up on Lambda shutdown
    process.on('SIGTERM', () => {
      console.log('🛑 Memory monitor stopping');
      clearInterval(interval);
      if (this.gcTimer) clearInterval(this.gcTimer);
    });
  }
  
  optimizeCacheConfig(baseConfig) {
    return {
      ...baseConfig,
      cache: {
        ...baseConfig.cache,
        memory: {
          ...(baseConfig.cache?.memory || {}),
          max: Math.floor(500 * this.options.cacheSizeMultiplier),
          ttl: 300000
        }
      }
    };
  }
}

module.exports = LambdaMemoryOptimizer;
```

```javascript
// Lambda handler with memory optimization
const LambdaMemoryOptimizer = require('./lib/memory-optimizer');

// Initialize memory optimizer first
const memoryOptimizer = new LambdaMemoryOptimizer({
  maxHeapSize: 256 * 1024 * 1024, // 256MB for Lambda
  gcInterval: 30000,
  cacheSizeMultiplier: 0.2 // Reduce cache size for memory-constrained environment
});

memoryOptimizer.initialize();

// Create optimized RDAP client
const optimizedConfig = memoryOptimizer.optimizeCacheConfig({
  cache: {
    enabled: true,
    type: 'memory',
    memory: {
      max: 1000,
      ttl: 300000
    }
  },
  performance: {
    maxConcurrent: 3,
    connectionPool: {
      max: 8,
      timeout: 3000
    }
  }
});

global.rdapClient = new RDAPClient(optimizedConfig);

exports.handler = async (event) => {
  try {
    // Lambda-specific memory monitoring
    const before = process.memoryUsage();
    
    const result = await global.rdapClient.domain(event.domain);
    
    const after = process.memoryUsage();
    const heapDiff = (after.heapUsed - before.heapUsed) / 1024 / 1024;
    
    console.log(`📈 Memory delta: ${heapDiff.toFixed(2)}MB for domain ${event.domain}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Lambda handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

## 🔒 Security and Compliance Considerations

### 1. Lambda Execution Environment Hardening
```yaml
# serverless.yml with security hardening
service: rdapify-lambda

provider:
  name: aws
  runtime: nodejs20.x
  memorySize: 512
  timeout: 15 # 15 seconds maximum
  iamRoleStatements:
    - Effect: Allow
      Action:
        - logs:CreateLogGroup
        - logs:CreateLogStream
        - logs:PutLogEvents
      Resource: arn:aws:logs:${aws:region}:${aws:accountId}:log-group:/aws/lambda/rdapify-*
    
    - Effect: Allow
      Action:
        - ssm:GetParameter
        - kms:Decrypt
      Resource:
        - arn:aws:ssm:${aws:region}:${aws:accountId}:parameter/rdapify/*
        - arn:aws:kms:${aws:region}:${aws:accountId}:key/* # Specific KMS keys only

  environment:
    NODE_ENV: production
    # Security settings
    RDAP_SSRF_PROTECTION: true
    RDAP_REDACT_PII: true
    RDAP_VALIDATE_CERTIFICATES: true
    # Compliance settings
    DATA_RETENTION_DAYS: 30
    LEGAL_BASIS: legitimate-interest
    # Performance settings
    CACHE_SIZE: 500
    MAX_CONCURRENT: 3
  
  vpc:
    securityGroupIds:
      - sg-0123456789abcdef0 # Registry access security group
    subnetIds:
      - subnet-0123456789abcdef0
      - subnet-0123456789abcdef1
      - subnet-0123456789abcdef2

  # Enable Lambda SnapStart for Java functions (Node.js coming soon)
  snapStart:
    applyOn: PublishedVersions

functions:
  domain:
    handler: handlers/domain.handler
    events:
      - http:
          path: /domain/{domain}
          method: get
          cors: true
    reservedConcurrency: 50 # Critical for predictable performance
    tracing: Active # Enable X-Ray tracing
    
    # Lambda Layers for shared dependencies
    layers:
      - arn:aws:lambda:${aws:region}:${aws:accountId}:layer:rdapify-deps:1
      - arn:aws:lambda:${aws:region}:${aws:accountId}:layer:security-tools:2

package:
  patterns:
    - '!node_modules/**'
    - '!test/**'
    - '!docs/**'
    - 'dist/**'
    - 'package.json'
    - 'node_modules/.bin/*' # Only include necessary binaries

custom:
  # Serverless Offline configuration for local testing
  serverless-offline:
    httpPort: 3001
    stageVariables:
      NODE_ENV: development
  
  # Layer configuration
  layers:
    dependencies:
      path: layers/dependencies
      compatibleRuntimes:
        - nodejs20.x
      licenseInfo: 'MIT'
      description: 'RDAPify shared dependencies'
    
    security-tools:
      path: layers/security-tools
      compatibleRuntimes:
        - nodejs20.x
      licenseInfo: 'MIT'
      description: 'Security tools and libraries'

# Critical: Enable Lambda Insights for performance monitoring
plugins:
  - serverless-lambda-insights
  - serverless-pseudo-parameters
```

### 2. GDPR-Compliant Data Handling in Lambda
```javascript
// lib/gdpr-compliance.js
class GDPRComplianceLayer {
  constructor(options = {}) {
    this.options = {
      dataRetentionDays: options.dataRetentionDays || 30,
      legalBasis: options.legalBasis || 'legitimate-interest',
      jurisdiction: options.jurisdiction || 'global',
      dpoContact: options.dpoContact || 'dpo@organization.com'
    };
    
    // Initialize compliance logging
    this.setupComplianceLogging();
  }
  
  setupComplianceLogging() {
    // Create compliance log stream
    this.complianceLogStream = new Writable({
      write(chunk, encoding, callback) {
        // Send to CloudWatch with compliance tag
        console.log(`[COMPLIANCE] ${chunk.toString()}`);
        callback();
      }
    });
  }
  
  async processDomainQuery(domain, context) {
    const start = Date.now();
    const requestId = `gdpr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    try {
      // Log GDPR processing event
      this.logGDPRProcessing(requestId, domain, context);
      
      // Apply GDPR context to RDAP query
      const result = await global.rdapClient.domain(domain, {
        context: {
          ...context,
          gdpr: {
            enabled: true,
            legalBasis: this.options.legalBasis,
            dataRetentionDays: this.options.dataRetentionDays,
            jurisdiction: this.options.jurisdiction
          }
        }
      });
      
      // Log successful processing
      this.logGDPRSuccess(requestId, domain, result, Date.now() - start);
      
      return result;
    } catch (error) {
      // Log processing failure
      this.logGDPRFailure(requestId, domain, error, Date.now() - start);
      throw error;
    }
  }
  
  logGDPRProcessing(requestId, domain, context) {
    const logEntry = {
      eventType: 'data_processing_started',
      timestamp: new Date().toISOString(),
      requestId,
      domain,
      legalBasis: this.options.legalBasis,
      jurisdiction: this.options.jurisdiction,
      retentionPeriod: `${this.options.dataRetentionDays} days`,
      context: {
        clientIp: context.clientIp,
        userAgent: context.userAgent,
        tenantId: context.tenantId
      }
    };
    
    this.complianceLogStream.write(JSON.stringify(logEntry) + '\n');
  }
  
  logGDPRSuccess(requestId, domain, result, duration) {
    const logEntry = {
      eventType: 'data_processing_completed',
      timestamp: new Date().toISOString(),
      requestId,
      domain,
      duration: `${duration}ms`,
      dataCategoriesProcessed: this.identifyDataCategories(result),
      retentionTimestamp: new Date(Date.now() + this.options.dataRetentionDays * 86400000).toISOString(),
      legalBasis: this.options.legalBasis
    };
    
    this.complianceLogStream.write(JSON.stringify(logEntry) + '\n');
  }
  
  logGDPRFailure(requestId, domain, error, duration) {
    const logEntry = {
      eventType: 'data_processing_failed',
      timestamp: new Date().toISOString(),
      requestId,
      domain,
      duration: `${duration}ms`,
      error: {
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR'
      },
      legalBasis: this.options.legalBasis,
      remediationRequired: this.requiresRemediation(error)
    };
    
    this.complianceLogStream.write(JSON.stringify(logEntry) + '\n');
  }
  
  identifyDataCategories(result) {
    const categories = [];
    
    if (result.entities?.some(e => e.roles?.includes('registrant'))) {
      categories.push('registrant_data');
    }
    
    if (result.events?.some(e => e.eventAction === 'registration')) {
      categories.push('registration_data');
    }
    
    if (result.nameservers?.length > 0) {
      categories.push('dns_data');
    }
    
    return categories;
  }
  
  requiresRemediation(error) {
    return error.message.includes('SSRF') || 
           error.message.includes('PII') ||
           error.code === 'DATA_QUALITY_ISSUE';
  }
  
  generateComplianceReport(context) {
    return {
      timestamp: new Date().toISOString(),
      jurisdiction: this.options.jurisdiction,
      legalBasis: this.options.legalBasis,
      retentionPeriod: `${this.options.dataRetentionDays} days`,
      dpoContact: this.options.dpoContact,
      applicableRegulations: ['GDPR', 'CCPA'].filter(reg => 
        this.options.jurisdiction === 'EU' || this.options.jurisdiction === 'US-CA'
      ),
      dataProcessingPurpose: context.purpose || 'domain_registration_verification',
      dataMinimizationApplied: true,
      reportId: `gdpr-report-${Date.now()}`
    };
  }
}

module.exports = GDPRComplianceLayer;
```

## 🔍 Troubleshooting Common Lambda Issues

### 1. VPC Cold Start Problems
**Symptoms**: Initial Lambda invocation takes 10-15 seconds, then subsequent calls are fast  
**Root Causes**:
- VPC attachment requiring ENI creation
- Security group rules blocking DNS resolution
- NAT gateway throttling during initialization
- DNS resolution timeouts for registry endpoints

**Diagnostic Steps**:
```bash
# Check VPC attachment time in CloudWatch Logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/rdapify-prod \
  --start-time $(date -d '1 hour ago' +%s000) \
  --filter-pattern '"Task timed out"' \
  --query 'events[*].message' \
  --output text

# Test VPC connectivity from Lambda
aws lambda invoke \
  --function-name rdapify-prod \
  --payload '{"test": "vpc-connectivity"}' \
  output.json

# Analyze ENI creation time
aws ec2 describe-network-interfaces \
  --filters "Name=tag:aws:lambda:function-name,Values=rdapify-prod" \
  --query 'NetworkInterfaces[*].{Created:Attachment.AttachTime,Status:Status}' \
  --output table
```

**Solutions**:
✅ **Provisioned Concurrency**:
```yaml
# serverless.yml with provisioned concurrency
functions:
  domain:
    handler: handlers/domain.handler
    provisionedConcurrency: 1 # Start with 1, scale based on traffic
    events:
      - http:
          path: /domain/{domain}
          method: get
          cors: true
```

✅ **VPC-Less Architecture with PrivateLink**:
```yaml
# serverless.yml with VPC-Less architecture
provider:
  vpc: false # Disable VPC attachment
  
  environment:
    USE_PRIVATELINK: true
    RDAP_ENDPOINTS:
      verisign: vpce-0123456789abcdef0-12345678.rdap.vpce.amazonaws.com
      arin: vpce-0123456789abcdef0-12345678.arin.vpce.amazonaws.com
      ripe: vpce-0123456789abcdef0-12345678.ripe.vpce.amazonaws.com
```

### 2. Memory Exhaustion During Batch Processing
**Symptoms**: Lambda function crashes with "out of memory" error after processing 50-100 domains  
**Root Causes**:
- Large in-memory cache growing without bounds
- Memory leaks in event loop handlers
- Inefficient batch processing algorithm
- Missing memory cleanup between invocations

**Diagnostic Steps**:
```bash
# Monitor memory usage in CloudWatch
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name MemoryUtilization \
  --dimensions Name=FunctionName,Value=rdapify-prod \
  --start-time $(date -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --period 300 \
  --statistics Average,Maximum

# Enable Lambda Insights for detailed memory analysis
aws lambda update-function-configuration \
  --function-name rdapify-prod \
  --layers arn:aws:lambda:${aws:region}:580247275435:layer:LambdaInsightsExtension:14
```

**Solutions**:
✅ **Stream-Based Batch Processing**:
```javascript
// handlers/batch-domains.js
const { Readable, pipeline } = require('stream');
const { promisify } = require('util');
const { RDAPClient } = require('rdapify');

const pipelineAsync = promisify(pipeline);
const client = new RDAPClient({
  cache: {
    enabled: true,
    type: 'memory',
    memory: {
      max: 200, // Reduced cache size for Lambda
      ttl: 300000
    }
  },
  performance: {
    maxConcurrent: 2, // Conservative concurrency for Lambda
    connectionPool: {
      max: 5,
      timeout: 3000
    }
  }
});

exports.handler = async (event) => {
  try {
    const domains = event.domains || [];
    const batchSize = Math.min(50, Math.floor(200 / domains.length)); // Scale batch size
    
    // Create stream from domains
    const domainStream = Readable.from(domains.map(domain => ({ domain })));
    
    // Process stream with backpressure
    const results = [];
    await pipelineAsync(
      domainStream,
      new Transform({
        objectMode: true,
        transform(chunk, encoding, callback) {
          // Process domain with error handling
          client.domain(chunk.domain)
            .then(result => {
              results.push({ domain: chunk.domain, result, status: 'success' });
              callback();
            })
            .catch(error => {
              results.push({ domain: chunk.domain, error: error.message, status: 'error' });
              callback();
            });
        },
        flush(callback) {
          // Cleanup resources
          client.close().catch(console.error);
          callback();
        }
      })
    );
    
    // Return results with memory usage report
    const memoryUsage = process.memoryUsage();
    return {
      statusCode: 200,
      body: JSON.stringify({
        results,
        memoryUsage: {
          heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
          heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2),
          rss: (memoryUsage.rss / 1024 / 1024).toFixed(2)
        },
        processed: results.length,
        successRate: results.filter(r => r.status === 'success').length / results.length
      })
    };
  } catch (error) {
    console.error('Batch processing error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

## 📚 Related Documentation

| Document | Description | Path |
|----------|-------------|------|
| [Common Errors](common_errors.md) | Frequently encountered issues and solutions | [common_errors.md](common_errors.md) |
| [Debugging](debugging.md) | Advanced debugging techniques | [debugging.md](debugging.md) |
| [Connection Timeout Resolution](connection_timeout.md) | Handling network timeout issues | [connection_timeout.md](connection_timeout.md) |
| [Lambda Performance Inspector](../../playground/lambda-inspector.md) | Interactive Lambda optimization tool | [../../playground/lambda-inspector.md](../../playground/lambda-inspector.md) |
| [Lambda Cold Start Optimization](../../../benchmarks/results/lambda-cold-start.md) | Cold start benchmark data | [../../../benchmarks/results/lambda-cold-start.md](../../../benchmarks/results/lambda-cold-start.md) |
| [Serverless Deployments](../deployments/serverless.md) | Comprehensive serverless guide | [../deployments/serverless.md](../deployments/serverless.md) |
| [Security Whitepaper](../../security/whitepaper.md) | Comprehensive security architecture | [../../security/whitepaper.md](../../security/whitepaper.md) |
| [GDPR Compliance](../../guides/gdpr_compliance.md) | Privacy protection implementation guide | [../../guides/gdpr_compliance.md](../../guides/gdpr_compliance.md) |

## 🏷️ Lambda Specifications

| Property | Value |
|----------|-------|
| **Runtime** | Node.js 20.x (LTS) |
| **Memory Limit** | 512MB (recommended), 256MB (minimum) |
| **Timeout** | 15 seconds (maximum) |
| **Package Size** | < 50MB (unzipped) for fast cold starts |
| **Concurrency** | Reserved concurrency: 50 per function |
| **VPC Configuration** | Optional with PrivateLink fallback |
| **Cache Strategy** | Memory-only with aggressive TTL management |
| **Error Rate** | < 0.1% at 95th percentile |
| **Cold Start Time** | < 3 seconds (optimized) |
| **Test Coverage** | 95% unit tests, 90% integration tests for Lambda-specific code |
| **Last Updated** | December 5, 2025 |

> 🔐 **Critical Reminder**: Never store sensitive credentials or API keys directly in Lambda environment variables. Always use AWS Systems Manager Parameter Store or Secrets Manager with IAM role restrictions. For GDPR/CCPA compliance, implement automatic data deletion after retention periods and maintain audit trails of all data processing activities. Regular security reviews of Lambda configurations are required for maintaining compliance with GDPR Article 32 and similar regulations.

[← Back to Troubleshooting](../README.md) | [Next: Proxy Rotation →](proxy_rotation.md)

*Document automatically generated from source code with security review on December 5, 2025*