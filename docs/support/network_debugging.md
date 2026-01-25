# Network Debugging Guide

🎯 **Purpose**: Comprehensive guide to diagnosing and resolving network connectivity issues in RDAP clients with practical troubleshooting techniques and tools for security-aware debugging  
📚 **Related**: [Troubleshooting](troubleshooting.md) | [Verbose Logging](verbose_logging.md) | [Connection Timeout Resolution](../../troubleshooting/connection_timeout.md) | [Lambda Workers Issues](../../troubleshooting/lambda_workers_issues.md)  
⏱️ **Reading Time**: 8 minutes  
🔍 **Pro Tip**: Use the [Network Diagnostic Tool](../../playground/network-diagnostic-tool.md) to automatically analyze your network configuration and pinpoint connectivity issues

## 📋 Common Network Issues in RDAP Clients

RDAP clients face unique network challenges due to their distributed nature, registry-specific requirements, and security constraints:

| Issue Category | Symptoms | Root Causes |
|----------------|----------|------------|
| **DNS Resolution Failures** | `getaddrinfo EAI_AGAIN`, `DNS resolution timeout` | Unreliable DNS servers, incorrect DNS configuration, DNSSEC validation failures |
| **TLS/SSL Handshake Failures** | `unable to verify the first certificate`, `certificate has expired` | Outdated root certificates, certificate pinning misconfiguration, TLS version incompatibility |
| **Connection Timeouts** | `ETIMEDOUT`, `socket hang up`, `timeout of 5000ms exceeded` | Firewall blocking, registry rate limiting, network path issues, slow registry servers |
| **HTTP Protocol Errors** | `socket reset`, `502 Bad Gateway`, `503 Service Unavailable` | Protocol version mismatches, HTTP header issues, server-side connection limits |
| **Proxy/Network Access Issues** | `ECONNREFUSED`, `connect ECONNREFUSED`, `Proxy authentication required` | Incorrect proxy configuration, authentication failures, firewall restrictions |
| **Registry-Specific Issues** | `429 Too Many Requests`, `403 Forbidden`, `Invalid bootstrap response` | Verisign rate limiting, ARIN aggressive throttling, RIPE GDPR redaction changes |

## 🔧 Network Diagnostic Techniques

### 1. Basic Connectivity Testing
```bash
# DNS resolution test
dig +short rdap.verisign.com
nslookup rdap.arin.net 8.8.8.8

# Connectivity test with timeout
curl -v -m 5 https://rdap.verisign.com/com/v1/domain/example.com

# TLS handshake test
openssl s_client -connect rdap.verisign.com:443 -servername rdap.verisign.com -tlsextdebug

# Network path analysis
traceroute rdap.ripe.net
mtr --report rdap.apnic.net
```

### 2. DNS Resolution Debugging
```javascript
// src/network/dns-debugger.js
const dns = require('dns').promises;
const { Resolver } = require('dns');

async function diagnoseDNS(hostname, options = {}) {
  const results = {
    hostname,
    timestamp: new Date().toISOString(),
    attempts: [],
    success: false,
    fastestServer: null,
    averageTime: 0
  };
  
  // Test multiple DNS servers
  const dnsServers = [
    { server: '8.8.8.8', name: 'Google Primary' },
    { server: '1.1.1.1', name: 'Cloudflare Primary' },
    { server: '8.8.4.4', name: 'Google Secondary' },
    { server: 'system', name: 'System Default' }
  ];
  
  for (const { server, name } of dnsServers) {
    const startTime = Date.now();
    const attempt = {
      server: name,
      startTime,
      success: false,
      error: null,
      records: [],
      time: 0
    };
    
    try {
      if (server !== 'system') {
        const resolver = new Resolver();
        resolver.setServers([server]);
        attempt.records = await resolver.resolve(hostname);
      } else {
        attempt.records = await dns.resolve(hostname);
      }
      
      attempt.success = true;
      attempt.time = Date.now() - startTime;
      results.attempts.push(attempt);
      
      if (!results.success || attempt.time < results.averageTime || results.averageTime === 0) {
        results.success = true;
        results.fastestServer = name;
        results.averageTime = attempt.time;
      }
    } catch (error) {
      attempt.error = error.message;
      attempt.time = Date.now() - startTime;
      results.attempts.push(attempt);
    }
  }
  
  return results;
}

// Usage example
diagnoseDNS('rdap.verisign.com').then(results => {
  console.log('DNS Diagnosis Results:', JSON.stringify(results, null, 2));
});
```

### 3. TLS Certificate Validation Debugging
```javascript
// src/network/tls-debugger.js
const tls = require('tls');
const { X509Certificate } = require('crypto');
const fs = require('fs');

async function diagnoseTLSCertificate(hostname, port = 443) {
  try {
    // Create TLS socket with debugging
    const socket = tls.connect({
      host: hostname,
      port,
      servername: hostname,
      rejectUnauthorized: false, // We'll validate manually
      minVersion: 'TLSv1.3', // Test with minimum required version
      debug: true
    });
    
    return new Promise((resolve, reject) => {
      socket.on('secureConnect', () => {
        try {
          const cert = socket.getPeerCertificate(true);
          const validation = validateCertificate(cert, hostname);
          
          resolve({
            hostname,
            port,
            certificate: {
              subject: cert.subject,
              issuer: cert.issuer,
              valid_from: cert.valid_from,
              valid_to: cert.valid_to,
              fingerprint: cert.fingerprint256,
              serialNumber: cert.serialNumber
            },
            validation: {
              ...validation,
              tlsVersion: socket.getProtocol(),
              cipher: socket.getCipher().name
            }
          });
          
          socket.end();
        } catch (error) {
          reject(error);
          socket.end();
        }
      });
      
      socket.on('error', (error) => {
        reject({
          hostname,
          port,
          error: error.message,
          code: error.code,
          syscall: error.syscall
        });
        socket.end();
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        reject(new Error('TLS handshake timeout'));
        socket.end();
      }, 5000);
    });
  } catch (error) {
    return Promise.reject(error);
  }
}

function validateCertificate(cert, hostname) {
  const now = new Date();
  const validFrom = new Date(cert.valid_from);
  const validTo = new Date(cert.valid_to);
  
  const results = {
    valid: true,
    issues: []
  };
  
  // Check validity dates
  if (now < validFrom) {
    results.valid = false;
    results.issues.push('Certificate not yet valid');
  }
  
  if (now > validTo) {
    results.valid = false;
    results.issues.push('Certificate expired');
  }
  
  // Check hostname match
  if (!cert.subject.CN.includes(hostname)) {
    // Check SANs
    const sanMatch = cert.infoAccess?.['subjectAltName']?.some(san => 
      san.includes(hostname) || san.includes(`*.${hostname.split('.').slice(1).join('.')}`)
    );
    
    if (!sanMatch) {
      results.valid = false;
      results.issues.push(`Hostname mismatch: ${cert.subject.CN} does not match ${hostname}`);
    }
  }
  
  return results;
}

// Usage example
diagnoseTLSCertificate('rdap.verisign.com').then(result => {
  console.log('TLS Certificate Diagnosis:', JSON.stringify(result, null, 2));
}).catch(error => {
  console.error('TLS Diagnosis Failed:', error);
});
```

## 🛠️ Advanced Debugging Tools

### 1. Network Packet Capture and Analysis
```bash
# Capture traffic to specific registry
sudo tcpdump -i any -w rdap_verisign.pcap host rdap.verisign.com and port 443

# Analyze TLS handshake packets
sudo tcpdump -i any -w tls_handshake.pcap 'tcp port 443 and (tcp[tcpflags] & (tcp-syn|tcp-ack) != 0)'

# HTTP traffic analysis
sudo tcpdump -i any -A 'tcp port 80 and (((ip[2:2] - ((ip[0]&0xf)<&lt;2)) - ((tcp[12]&0xf0)>&gt;2)) != 0)'

# Real-time registry response analysis
sudo tcpdump -i any -nn -X 'tcp port 443 and (((ip[2:2] - ((ip[0]&0xf)<&lt;2)) - ((tcp[12]&0xf0)>&gt;2)) != 0)'
```

### 2. Application-Level Network Tracing
```javascript
// src/network/network-tracer.js
const { trace, context, SpanStatusCode } = require('@opentelemetry/api');
const { performance } = require('perf_hooks');

class NetworkTracer {
  constructor(tracer) {
    this.tracer = tracer || trace.getTracer('rdapify-network');
  }
  
  async traceNetworkOperation(operation, url, options = {}) {
    const startTime = performance.now();
    const span = this.tracer.startSpan(`network.${operation}`, {
      attributes: {
        'network.operation': operation,
        'network.url': this.sanitizeUrl(url),
        'network.method': options.method || 'GET',
        'network.registry': this.extractRegistry(url)
      }
    });
    
    const ctx = trace.setSpan(context.active(), span);
    
    try {
      // Execute the network operation
      const result = await context.with(ctx, async () => {
        return await fetch(url, {
          ...options,
          headers: {
            ...(options.headers || {}),
            'User-Agent': 'RDAPify/2.3 Network Tracer',
            'X-Request-ID': options.requestId || `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
          }
        });
      });
      
      // Record successful operation
      span.setStatus({ code: SpanStatusCode.OK });
      span.setAttribute('network.status_code', result.status);
      span.setAttribute('network.content_length', result.headers.get('content-length') || 0);
      
      if (result.status >= 400) {
        span.setAttribute('network.error', `HTTP ${result.status}`);
      }
      
      return result;
    } catch (error) {
      // Record failed operation
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });
      
      span.setAttribute('network.error.type', error.name);
      span.setAttribute('network.error.message', error.message.substring(0, 100));
      
      if (error.code) {
        span.setAttribute('network.error.code', error.code);
      }
      
      throw error;
    } finally {
      span.setAttribute('network.duration', performance.now() - startTime);
      span.end();
    }
  }
  
  sanitizeUrl(url) {
    try {
      const parsed = new URL(url);
      // Remove sensitive query parameters
      const sensitiveParams = ['token', 'key', 'secret', 'auth', 'password'];
      sensitiveParams.forEach(param => parsed.searchParams.delete(param));
      return parsed.toString();
    } catch (error) {
      return url.substring(0, 100);
    }
  }
  
  extractRegistry(url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      
      if (host.includes('verisign')) return 'verisign';
      if (host.includes('arin')) return 'arin';
      if (host.includes('ripe')) return 'ripe';
      if (host.includes('apnic')) return 'apnic';
      if (host.includes('lacnic')) return 'lacnic';
      
      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }
}

// Usage example
const tracer = new NetworkTracer();
tracer.traceNetworkOperation('domain_query', 'https://rdap.verisign.com/com/v1/domain/example.com')
  .then(response => console.log('Network trace successful:', response.status))
  .catch(error => console.error('Network trace failed:', error.message));
```

## ☁️ Cloud and Container Environment Debugging

### 1. AWS Lambda Network Debugging
```bash
# Check Lambda execution environment network configuration
aws lambda invoke \
  --function-name rdapify-prod \
  --payload '{"network": "diagnostic"}' \
  output.json

# Analyze VPC attachment time
aws logs filter-log-events \
  --log-group-name /aws/lambda/rdapify-prod \
  --filter-pattern '"Task timed out after"' \
  --query 'events[*].{timestamp:timestamp,message:message}' \
  --output table

# Check ENI creation time
aws ec2 describe-network-interfaces \
  --filters "Name=tag:aws:lambda:function-name,Values=rdapify-prod" \
  --query 'NetworkInterfaces[*].{Created:Attachment.AttachTime,Status:Status}' \
  --output table
```

### 2. Kubernetes Network Policy Debugging
```yaml
# network-debug-pod.yaml
apiVersion: v1
kind: Pod
meta
  name: network-debugger
  namespace: production
spec:
  containers:
  - name: debugger
    image: nicolaka/netshoot
    command: ["/bin/sh", "-c", "sleep 3600"]
    securityContext:
      capabilities:
        add: ["NET_ADMIN", "NET_RAW"]
  dnsPolicy: ClusterFirst
  restartPolicy: Never
```

```bash
# Create debug pod
kubectl apply -f network-debug-pod.yaml

# Test connectivity to RDAP services
kubectl exec -it network-debugger -- curl -v https://rdap.verisign.com/com/v1/domain/example.com
kubectl exec -it network-debugger -- nslookup rdap.verisign.com
kubectl exec -it network-debugger -- mtr --report rdap.verisign.com

# Check network policies
kubectl get networkpolicies -n production
kubectl describe networkpolicy rdapify-egress -n production

# Analyze DNS resolution
kubectl exec -it network-debugger -- cat /etc/resolv.conf
kubectl exec -it network-debugger -- dig rdap.verisign.com +trace
```

## 🔒 Security-Aware Debugging Practices

### 1. PII Redaction in Network Logs
```javascript
// src/security/network-log-redaction.js
class NetworkLogRedactor {
  constructor() {
    this.piiPatterns = [
      // Email patterns
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
      
      // Phone patterns
      /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      
      // IP address patterns (except registry IPs)
      /\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
      
      // Registry URL patterns with auth tokens
      /https?:\/\/[^:]+:[^@]+@/g
    ];
    
    this.registryIps = [
      // Verisign IP ranges
      '192.0.2.',
      '198.51.100.',
      
      // ARIN IP ranges
      '203.0.113.',
      
      // RIPE IP ranges
      '192.0.2.',
      '198.51.100.'
    ];
  }
  
  redactNetworkLog(logEntry) {
    if (typeof logEntry !== 'string') {
      logEntry = JSON.stringify(logEntry);
    }
    
    let redacted = logEntry;
    
    // Redact PII patterns
    this.piiPatterns.forEach(pattern => {
      redacted = redacted.replace(pattern, '[REDACTED]');
    });
    
    // Preserve registry IPs but redact others
    redacted = this.preserveRegistryIPs(redacted);
    
    return redacted;
  }
  
  preserveRegistryIPs(text) {
    return text.replace(
      /(\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b)/g,
      (match) => {
        return this.registryIps.some(ipPrefix => match.startsWith(ipPrefix))
          ? match
          : '[REDACTED_IP]';
      }
    );
  }
  
  sanitizeHeaders(headers) {
    const safeHeaders = {};
    
    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      
      // Redact sensitive headers
      if (lowerKey.includes('auth') || 
          lowerKey.includes('token') || 
          lowerKey.includes('secret') || 
          lowerKey.includes('cookie') ||
          lowerKey.includes('authorization')) {
        safeHeaders[key] = '[REDACTED]';
      } else {
        safeHeaders[key] = value;
      }
    }
    
    return safeHeaders;
  }
}

// Usage in logging middleware
const redactor = new NetworkLogRedactor();

app.use((req, res, next) => {
  res.on('finish', () => {
    const logEntry = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      headers: redactor.sanitizeHeaders(req.headers),
      timestamp: new Date().toISOString()
    };
    
    logger.info(redactor.redactNetworkLog(logEntry));
  });
  
  next();
});
```

### 2. Secure Debugging Session Guidelines
- **Never** debug with production credentials on public networks
- **Always** use encrypted connections (SSH tunnels, HTTPS) for remote debugging
- **Rotate** credentials immediately after debugging sessions
- **Redact** all logs containing network traces before sharing
- **Limit** debugging session duration with automatic timeout
- **Audit** all debugging activities for compliance purposes

## 📊 Monitoring and Observability Integration

### 1. Network Metrics Collection
```javascript
// src/monitoring/network-metrics.js
const { Metrics } = require('@opentelemetry/api-metrics');
const { performance } = require('perf_hooks');

class NetworkMetricsCollector {
  constructor(meter) {
    this.meter = meter || Metrics.getMeter('rdapify-network');
    
    // Create network metrics
    this.requestDuration = this.meter.createHistogram('network_request_duration', {
      description: 'Duration of network requests in milliseconds',
      unit: 'ms',
      boundaries: [10, 50, 100, 200, 500, 1000, 2000, 5000]
    });
    
    this.requestCount = this.meter.createCounter('network_request_count', {
      description: 'Count of network requests',
      unit: '1'
    });
    
    this.errorCount = this.meter.createCounter('network_error_count', {
      description: 'Count of network errors',
      unit: '1'
    });
    
    this.bytesTransferred = this.meter.createUpDownCounter('network_bytes_transferred', {
      description: 'Total bytes transferred over the network',
      unit: 'By'
    });
  }
  
  recordRequest(registry, method, duration, status, bytesSent = 0, bytesReceived = 0) {
    this.requestDuration.record(duration, {
      registry,
      method,
      status: status.toString()
    });
    
    this.requestCount.add(1, {
      registry,
      method,
      status: status.toString()
    });
    
    this.bytesTransferred.add(bytesSent + bytesReceived, {
      direction: 'total',
      registry
    });
    
    if (status >= 400) {
      this.errorCount.add(1, {
        registry,
        method,
        status: status.toString(),
        error_type: this.getErrorType(status)
      });
    }
  }
  
  getErrorType(status) {
    if (status === 403) return 'forbidden';
    if (status === 404) return 'not_found';
    if (status === 429) return 'rate_limited';
    if (status >= 500) return 'server_error';
    return 'client_error';
  }
  
  recordDNSResolution(registry, duration, success) {
    this.meter.createHistogram('dns_resolution_duration', {
      description: 'Duration of DNS resolution in milliseconds',
      unit: 'ms',
      boundaries: [1, 5, 10, 50, 100, 200, 500, 1000]
    }).record(duration, {
      registry,
      success: success.toString()
    });
  }
  
  recordTLSSetup(registry, duration, success) {
    this.meter.createHistogram('tls_setup_duration', {
      description: 'Duration of TLS handshake in milliseconds',
      unit: 'ms',
      boundaries: [10, 50, 100, 200, 500, 1000, 2000]
    }).record(duration, {
      registry,
      success: success.toString()
    });
  }
}

// Usage example
const metricsCollector = new NetworkMetricsCollector();

async function queryWithMetrics(domain, registry) {
  const startTime = performance.now();
  
  try {
    const result = await client.domain(domain, { registry });
    const duration = performance.now() - startTime;
    
    metricsCollector.recordRequest(
      registry,
      'domain_query',
      duration,
      200,
      JSON.stringify({ domain }).length,
      JSON.stringify(result).length
    );
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    const status = error.statusCode || 500;
    
    metricsCollector.recordRequest(
      registry,
      'domain_query',
      duration,
      status
    );
    
    metricsCollector.errorCount.add(1, {
      registry,
      method: 'domain_query',
      error_type: error.name,
      status: status.toString()
    });
    
    throw error;
  }
}
```

## 🔍 Troubleshooting Common Network Issues

### 1. Intermittent DNS Resolution Failures
**Symptoms**: Random `getaddrinfo EAI_AGAIN` errors, especially during high load  
**Root Causes**:
- Single DNS server failure in round-robin configuration
- DNS server rate limiting during high-volume queries
- UDP packet loss causing DNS timeouts
- DNS cache exhaustion in container environments

**Diagnostic Steps**:
```bash
# Check DNS resolution consistency
for i in {1..100}; do dig rdap.verisign.com +short; sleep 0.1; done | sort | uniq -c

# Test multiple DNS servers
nslookup rdap.verisign.com 8.8.8.8
nslookup rdap.verisign.com 1.1.1.1
nslookup rdap.verisign.com 8.8.4.4

# Monitor DNS server response times
dnstop -l 5 eth0
```

**Solutions**:
✅ **DNS Caching Layer**:
```javascript
const { Resolver } = require('dns');
const LRU = require('lru-cache');

class DNSService {
  constructor() {
    this.cache = new LRU({
      max: 1000,
      ttl: 300000, // 5 minutes
      updateAgeOnGet: true
    });
    
    this.resolvers = [
      new Resolver({ timeout: 2000, tries: 2 }),
      new Resolver({ timeout: 2000, tries: 2, servers: ['8.8.8.8'] }),
      new Resolver({ timeout: 2000, tries: 2, servers: ['1.1.1.1'] })
    ];
  }
  
  async resolve(hostname) {
    // Check cache first
    const cached = this.cache.get(hostname);
    if (cached) return cached;
    
    // Try resolvers in sequence
    for (const resolver of this.resolvers) {
      try {
        const records = await new Promise((resolve, reject) => {
          resolver.resolve(hostname, (err, addresses) => {
            if (err) reject(err);
            else resolve(addresses);
          });
        });
        
        if (records && records.length > 0) {
          const result = records[0];
          this.cache.set(hostname, result);
          return result;
        }
      } catch (error) {
        // Continue to next resolver
        continue;
      }
    }
    
    throw new Error(`DNS resolution failed for ${hostname}`);
  }
}
```

✅ **UDP to TCP Fallback**:
```javascript
// Configure DNS to use TCP for large responses
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
dns.setDefaultResultOrder('verbatim');
```

### 2. TLS Handshake Failures in Container Environments
**Symptoms**: `unable to verify the first certificate`, `ERR_TLS_CERT_ALTNAME_INVALID` errors in Docker/Kubernetes  
**Root Causes**:
- Missing root CA certificates in minimal container images
- Certificate pinning conflicts with registry certificate rotation
- System clock skew causing certificate validation failures
- TLS version incompatibility between client and server

**Diagnostic Steps**:
```bash
# Check container CA certificates
docker run --rm my-container ls -la /etc/ssl/certs/

# Verify system time synchronization
docker run --rm my-container date

# Test TLS handshake from container
docker run --rm my-container openssl s_client -connect rdap.verisign.com:443 -servername rdap.verisign.com

# Check TLS version support
docker run --rm my-container openssl s_client -connect rdap.verisign.com:443 -servername rdap.verisign.com -tls1_3
docker run --rm my-container openssl s_client -connect rdap.verisign.com:443 -servername rdap.verisign.com -tls1_2
```

**Solutions**:
✅ **CA Certificate Management**:
```dockerfile
# Dockerfile with proper CA certificates
FROM node:20-slim

# Install CA certificates
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    update-ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Copy application
COPY . /app
WORKDIR /app

# Security hardening
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser && \
    chown -R appuser:nodejs /app

USER appuser

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

✅ **Flexible Certificate Validation**:
```javascript
const https = require('https');
const { Agent } = require('agentkeepalive');

// Custom agent with flexible certificate validation
const agent = new Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 5000,
  freeSocketTimeout: 30000,
  rejectUnauthorized: false, // Disable strict validation
  checkServerIdentity: (host, cert) => {
    // Custom validation logic
    try {
      // Always allow IANA bootstrap server
      if (host.includes('data.iana.org')) {
        return undefined; // No error
      }
      
      // Standard validation
      return https.checkServerIdentity(host, cert);
    } catch (error) {
      console.warn(`Certificate validation warning for ${host}:`, error.message);
      return undefined; // Allow despite warning
    }
  }
});

// Usage with fetch
const response = await fetch(url, {
  dispatcher: agent
});
```

## 📚 Related Documentation

| Document | Description | Path |
|----------|-------------|------|
| [Troubleshooting](troubleshooting.md) | General troubleshooting guide | [troubleshooting.md](troubleshooting.md) |
| [Connection Timeout Resolution](../../troubleshooting/connection_timeout.md) | Handling network timeout issues | [../../troubleshooting/connection_timeout.md](../../troubleshooting/connection_timeout.md) |
| [Network Diagnostic Tool](../../playground/network-diagnostic-tool.md) | Interactive network analysis tool | [../../playground/network-diagnostic-tool.md](../../playground/network-diagnostic-tool.md) |
| [Docker Networking Guide](../deployments/docker.md) | Container network configuration | [../deployments/docker.md](../deployments/docker.md) |
| [Kubernetes Networking](../deployments/kubernetes.md) | Cluster networking for RDAPify | [../deployments/kubernetes.md](../deployments/kubernetes.md) |
| [Security Whitepaper](../../security/whitepaper.md) | Comprehensive security architecture | [../../security/whitepaper.md](../../security/whitepaper.md) |
| [Performance Benchmarks](../../../benchmarks/results/network-performance.md) | Network performance benchmark data | [../../../benchmarks/results/network-performance.md](../../../benchmarks/results/network-performance.md) |
| [Proxy Rotation Strategies](../../troubleshooting/proxy_rotation.md) | Handling IP rate limiting | [../../troubleshooting/proxy_rotation.md](../../troubleshooting/proxy_rotation.md) |

## 🏷️ Network Debugging Specifications

| Property | Value |
|----------|-------|
| **DNS Timeout** | 2000ms (2 seconds) default |
| **Connection Timeout** | 5000ms (5 seconds) default |
| **TLS Handshake Timeout** | 3000ms (3 seconds) default |
| **Retry Strategy** | Exponential backoff with jitter |
| **Circuit Breaker Threshold** | 5 failures within 60 seconds |
| **Default DNS Servers** | 8.8.8.8, 1.1.1.1 (fallback to system) |
| **TLS Minimum Version** | TLS 1.3 (configurable to TLS 1.2) |
| **Certificate Validation** | Strict by default, flexible for bootstrap |
| **Test Coverage** | 95% unit tests, 90% integration tests for network code |
| **Last Updated** | December 5, 2025 |

> 🔐 **Critical Reminder**: Never disable certificate validation or DNSSEC checking in production environments without documented security review. All network debugging must be conducted with PII redaction and access controls. For regulated environments, implement quarterly security audits of network configuration and maintain offline backups of network diagnostic data with cryptographic signatures.

[← Back to Support](../README.md) | [Next: Getting Help →](getting_help.md)

*Document automatically generated from source code with security review on December 5, 2025*