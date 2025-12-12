# Verbose Logging Guide

🎯 **Purpose**: Comprehensive guide to configuring and utilizing verbose logging in RDAPify for detailed diagnostics, performance analysis, and security auditing with minimal performance impact  
📚 **Related**: [Troubleshooting](troubleshooting.md) | [Network Debugging](network_debugging.md) | [Getting Help](getting_help.md) | [Performance Tuning](../performance/troubleshooting.md)  
⏱️ **Reading Time**: 4 minutes  
🔍 **Pro Tip**: Use the [Log Analyzer Tool](../../playground/log-analyzer.md) to automatically parse verbose logs and identify patterns, anomalies, and optimization opportunities

## 📋 Logging Levels and Use Cases

RDAPify supports a hierarchical logging system with granular control over verbosity levels:

| Level | Environment | Use Case | Performance Impact | Retention Period |
|-------|-------------|----------|-------------------|-----------------|
| **fatal** | Production | Critical system failures requiring immediate attention | None | 30 days |
| **error** | Production | Error conditions affecting specific operations | None | 30 days |
| **warn** | Production | Non-critical issues requiring attention | None | 30 days |
| **info** | Production | Standard operational information | None | 14 days |
| **debug** | Staging/Testing | Detailed operational diagnostics | Low | 7 days |
| **trace** | Development | Complete request/response tracing | Medium | 24 hours |
| **sensitive** | Security Audit | PII access and security events | Medium | 90 days (GDPR) |

## ⚙️ Enabling Verbose Logging

### 1. Configuration Options

```javascript
// Programmatic configuration
const client = new RDAPClient({
  logging: {
    level: 'debug', // Set default logging level
    format: 'json', // 'json', 'human', or 'syslog'
    redactPII: true, // Always redact PII in logs
    sampling: {
      error: 1.0,    // Log all errors
      warn: 1.0,     // Log all warnings
      debug: 0.25,   // Sample 25% of debug logs
      trace: 0.05    // Sample 5% of trace logs
    },
    transports: [
      { type: 'console', level: 'debug' },
      { type: 'file', path: '/var/log/rdapify.log', level: 'info' },
      { type: 'http', url: 'https://logs.example.com/ingest', level: 'error' }
    ],
    context: {
      include: ['requestId', 'tenantId', 'userId', 'registry'],
      redact: ['email', 'phone', 'address', 'fn']
    }
  }
});
```

### 2. Environment Variable Configuration

```bash
# Development environment
RDAP_LOG_LEVEL=trace
RDAP_LOG_FORMAT=json
RDAP_LOG_REDACT_PII=true
RDAP_LOG_SENSITIVE_FIELDS=email,phone,address
RDAP_LOG_SAMPLE_RATE=0.5

# Production environment
RDAP_LOG_LEVEL=info
RDAP_LOG_ERROR_SAMPLING=1.0
RDAP_LOG_WARN_SAMPLING=1.0
RDAP_LOG_DEBUG_SAMPLING=0.0
RDAP_LOG_CONTEXT_FIELDS=requestId,tenantId

# Security auditing environment
RDAP_LOG_LEVEL=sensitive
RDAP_LOG_SENSITIVE=true
RDAP_LOG_REDACT_PII=false  # Only in secure audit environments
RDAP_LOG_RETENTION_DAYS=90
```

## 🔍 Log Format Examples

### JSON Format (Recommended for Production)

```json
{
  "timestamp": "2025-12-05T14:23:17.123Z",
  "level": "debug",
  "message": "Registry query executed",
  "context": {
    "requestId": "req_7a8b9c0d1e2f",
    "tenantId": "tenant_12345",
    "registry": "verisign",
    "queryType": "domain",
    "queryValue": "example.com"
  },
  "duration": 125,
  "cacheHit": false,
  "registryResponseCode": 200,
  "connectionPoolSize": 12,
  "activeConnections": 3
}
```

### Human-Readable Format (Development)

```
2025-12-05T14:23:17.123Z [DEBUG] Registry query executed
  Request ID: req_7a8b9c0d1e2f
  Tenant: tenant_12345
  Registry: verisign
  Query: domain/example.com
  Duration: 125ms
  Cache: miss
  Response Code: 200
  Connection Pool: 12 total, 3 active
```

## 🔧 Advanced Logging Features

### 1. Context Propagation

```javascript
// Express.js middleware example
app.use((req, res, next) => {
  const context = {
    requestId: req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    tenantId: req.headers['x-tenant-id'] || 'default',
    userId: req.user?.id,
    clientIp: req.ip,
    userAgent: req.headers['user-agent']
  };
  
  // Set context for all subsequent logs
  logger.setContext(context);
  req.logContext = context;
  
  // Add correlation ID to response
  res.setHeader('X-Request-ID', context.requestId);
  
  next();
});

// Usage in route handler
app.get('/domain/:domain', async (req, res) => {
  const { domain } = req.params;
  const log = logger.child({ domain });
  
  try {
    log.debug('Processing domain query', { 
      registry: await detectRegistry(domain),
      startTime: Date.now()
    });
    
    const result = await client.domain(domain, req.logContext);
    log.info('Domain query successful', { 
      duration: Date.now() - log.startTime,
      status: result.status
    });
    
    res.json(result);
  } catch (error) {
    log.error('Domain query failed', { 
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
      duration: Date.now() - log.startTime
    });
    res.status(500).json({ error: error.message });
  }
});
```

### 2. Conditional Logging Based on Context

```javascript
// Conditional logging for critical domains
logger.addConditionalRule({
  condition: (context) => {
    // Log more verbosely for critical domains
    const criticalDomains = ['example.com', 'google.com', 'facebook.com'];
    return context.domain && criticalDomains.includes(context.domain.toLowerCase());
  },
  level: 'trace',
  sampling: 1.0, // 100% sampling for critical domains
  fields: ['rawResponse', 'connectionDetails', 'cacheState']
});

// Conditional logging based on error patterns
logger.addConditionalRule({
  condition: (context, error) => {
    // Log more details for rate limiting errors
    return error?.message?.includes('rate limit') || error?.code === 'RATE_LIMITED';
  },
  level: 'debug',
  sampling: 1.0,
  fields: ['registryLimits', 'retryStrategy', 'backoffDuration']
});
```

## 🚀 Performance Optimization

### 1. Sampling Strategies

```javascript
// Adaptive sampling based on error rates
class AdaptiveSampler {
  constructor(options = {}) {
    this.errorThreshold = options.errorThreshold || 0.05; // 5% error rate threshold
    this.baseSampling = {
      error: 1.0,
      warn: 0.5,
      debug: 0.1,
      trace: 0.01
    };
    this.highSampling = {
      error: 1.0,
      warn: 1.0,
      debug: 0.5,
      trace: 0.2
    };
    this.errorRate = 0;
    this.lastUpdate = Date.now();
    this.errorCount = 0;
    this.totalRequests = 0;
  }
  
  updateMetrics(success, total) {
    this.errorCount += success ? 0 : 1;
    this.totalRequests += total;
    
    const now = Date.now();
    if (now - this.lastUpdate > 60000) { // Update every minute
      this.errorRate = this.errorCount / this.totalRequests;
      this.errorCount = 0;
      this.totalRequests = 0;
      this.lastUpdate = now;
    }
  }
  
  getSamplingConfig() {
    return this.errorRate > this.errorThreshold 
      ? this.highSampling 
      : this.baseSampling;
  }
}

// Usage
const sampler = new AdaptiveSampler();
const client = new RDAPClient({
  logging: {
    sampling: () => sampler.getSamplingConfig()
  }
});

// Update metrics after batch operations
async function processBatch(domains) {
  const results = await Promise.allSettled(domains.map(d => client.domain(d)));
  const successCount = results.filter(r => r.status === 'fulfilled').length;
  sampler.updateMetrics(successCount, domains.length);
}
```

### 2. Asynchronous Logging with Backpressure

```javascript
// Non-blocking logging with backpressure handling
class AsyncLogger {
  constructor(options = {}) {
    this.queue = [];
    this.flushInterval = options.flushInterval || 100; // ms
    this.maxQueueSize = options.maxQueueSize || 1000;
    this.backpressureThreshold = options.backpressureThreshold || 0.8;
    this.droppedLogs = 0;
    this.startFlushing();
  }
  
  log(level, message, context = {}) {
    // Apply sampling
    if (Math.random() > this.getSampleRate(level)) {
      return;
    }
    
    // Redact sensitive fields
    const safeContext = this.redactSensitiveFields(context);
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: safeContext,
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    };
    
    // Handle backpressure
    if (this.queue.length > this.maxQueueSize * this.backpressureThreshold) {
      this.droppedLogs++;
      if (this.droppedLogs % 100 === 0) {
        console.warn(`[LOGGING] Dropped ${this.droppedLogs} logs due to backpressure`);
      }
      return;
    }
    
    this.queue.push(logEntry);
  }
  
  startFlushing() {
    setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }
  
  flush() {
    if (this.queue.length === 0) return;
    
    const batch = this.queue.splice(0, 100); // Process 100 logs at a time
    this.writeBatch(batch).catch(error => {
      console.error('[LOGGING] Failed to write batch:', error);
      // Re-queue failed logs with exponential backoff
      setTimeout(() => {
        this.queue.unshift(...batch.slice(0, Math.min(10, batch.length)));
      }, 1000);
    });
  }
  
  async writeBatch(batch) {
    // Implementation would write to configured transports
    for (const entry of batch) {
      console.log(JSON.stringify(entry));
      // Send to external logging service
      // Write to file
    }
  }
}
```

## 🔒 Security and Compliance

### 1. PII Redaction in Logs

```javascript
// Comprehensive PII redaction configuration
const piiRedactionConfig = {
  fields: [
    'email', 'phone', 'address', 'fn', 'n', 'tel', 'adr', 
    'organization', 'registrant', 'billingContact', 'technicalContact'
  ],
  patterns: [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
    /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    /\b\d{1,5}\s+(?:[\w\s]+,?\s+){2,4}[A-Z]{2}\s+\d{5}(-\d{4})?\b/gi
  ],
  exceptions: [
    {
      context: { logLevel: 'sensitive', environment: 'audit' },
      allowedFields: ['email', 'organization']
    }
  ],
  replacementStrategy: 'hash' // 'mask', 'hash', or 'remove'
};

logger.configurePIIRedaction(piiRedactionConfig);

// Example log after redaction
logger.debug('User query processed', {
  email: 'user@example.com',
  phone: '+1.555.123.4567',
  domain: 'example.com'
});
// Output: 
// { email: '[REDACTED]', phone: '[REDACTED]', domain: 'example.com' }
```

### 2. GDPR-Compliant Logging

```javascript
// GDPR-compliant logging configuration
const gdprLogger = new RDAPLogger({
  compliance: {
    framework: 'gdpr',
    dataRetentionDays: 30,
    legalBasis: 'legitimate-interest',
    dpoContact: 'dpo@example.com',
    dataProcessingNotice: 'Logs are processed for security and service improvement purposes'
  },
  redaction: {
    enabled: true,
    fields: ['email', 'phone', 'address', 'ip'],
    hashAlgorithm: 'sha256'
  },
  retention: {
    errorLogs: 90,
    securityLogs: 2555, // 7 years for security events
    auditLogs: 2555,
    debugLogs: 7
  },
  auditTrail: {
    enabled: true,
    logAccess: true,
    logChanges: true,
    logDeletions: true
  }
});

// Automatic data deletion based on retention policy
setInterval(() => {
  gdprLogger.purgeExpiredLogs();
}, 24 * 60 * 60 * 1000); // Daily cleanup
```

## 🔍 Troubleshooting Common Logging Issues

### 1. Log Volume Overwhelm
**Symptoms**: Disk space exhaustion, logging service throttling, application slowdown  
**Solutions**:
✅ **Intelligent Sampling**: Implement adaptive sampling based on error rates and business criticality  
✅ **Tiered Retention**: Configure different retention periods based on log severity (errors kept longer than debug)  
✅ **Log Sharding**: Split logs by service, tenant, or log type to improve manageability  
✅ **Compression**: Enable log compression with gzip or zstd for archived logs  

### 2. Missing Context in Error Logs
**Symptoms**: Error logs lack sufficient context to diagnose issues  
**Solutions**:
✅ **Context Propagation**: Ensure context flows through async boundaries using AsyncLocalStorage  
✅ **Error Enrichment**: Automatically add context to errors using error boundaries or middleware  
✅ **Correlation IDs**: Always include correlation IDs in log contexts for traceability  
✅ **Structured Context**: Store context in structured format rather than string concatenation  

### 3. Performance Degradation from Logging
**Symptoms**: Application slowdown when verbose logging is enabled  
**Solutions**:
✅ **Asynchronous Logging**: Use non-blocking logging with backpressure handling  
✅ **Conditional Logging**: Only evaluate expensive log messages when they will actually be logged  
✅ **Buffered Writes**: Batch log writes to reduce I/O operations  
✅ **Log Level Thresholds**: Set appropriate thresholds to prevent unnecessary log generation  

## 📚 Related Documentation

| Document | Description | Path |
|----------|-------------|------|
| [Troubleshooting](troubleshooting.md) | General troubleshooting guide | [troubleshooting.md](troubleshooting.md) |
| [Network Debugging](network_debugging.md) | Network-level issue diagnosis | [network_debugging.md](network_debugging.md) |
| [Performance Tuning](../performance/troubleshooting.md) | Performance issue resolution | [../performance/troubleshooting.md](../performance/troubleshooting.md) |
| [Log Analyzer Tool](../../playground/log-analyzer.md) | Interactive log analysis tool | [../../playground/log-analyzer.md](../../playground/log-analyzer.md) |
| [Compliance Framework](../../security/compliance.md) | Regulatory compliance requirements | [../../security/compliance.md](../../security/compliance.md) |
| [Error Handling Guide](../../guides/error_handling.md) | Comprehensive error processing guide | [../../guides/error_handling.md](../../guides/error_handling.md) |

## 🏷️ Logging Specifications

| Property | Value |
|----------|-------|
| **Default Level** | info (production), debug (development) |
| **Format Options** | JSON, human-readable, syslog, CEE |
| **Maximum Context Size** | 10KB per log entry |
| **Queue Size** | 1000 entries (configurable) |
| **Flush Interval** | 100ms (configurable) |
| **Sampling Strategies** | Static, Adaptive, Context-based |
| **PII Redaction** | On by default in all environments |
| **GDPR Compliance** | Built-in retention and deletion |
| **Test Coverage** | 95% unit tests, 85% integration tests |
| **Last Updated** | December 5, 2025 |

> 🔐 **Critical Reminder**: Never disable PII redaction in production logging without documented legal basis and Data Protection Officer approval. For regulated environments, implement quarterly audits of logging configurations and maintain offline backups of security audit logs. Regular security testing of logging pipelines is required for maintaining compliance with GDPR Article 32 and similar regulations.

[← Back to Support](../README.md) | [Next: Network Debugging →](network_debugging.md)

*Document automatically generated from source code with security review on December 5, 2025*