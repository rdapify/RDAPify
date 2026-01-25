# Production Examples

Production-ready examples demonstrating secure RDAP integration patterns.

---

## Examples

### 1. Express Middleware (`express-middleware.js`)

Full-featured Express.js API server with:
- ✅ SSRF protection with allowlist
- ✅ Rate limiting per IP
- ✅ Batch query support
- ✅ Error handling
- ✅ Health check endpoint
- ✅ Caching

**Usage**:
```bash
cd examples/production
npm install express rdapify
node express-middleware.js
```

**Endpoints**:
- `GET /api/rdap/domain/:domain` - Query domain
- `GET /api/rdap/ip/:ip` - Query IP address
- `GET /api/rdap/asn/:asn` - Query ASN
- `POST /api/rdap/batch` - Batch queries
- `GET /api/health` - Health check

**Example Request**:
```bash
curl http://localhost:3000/api/rdap/domain/example.com
```

---

### 2. Next.js API Route (`nextjs-api-route.ts`)

TypeScript Next.js API route with:
- ✅ SSRF protection
- ✅ TypeScript types
- ✅ Edge runtime compatible
- ✅ Rate limiting
- ✅ Cache headers

**Usage**:
```bash
# Copy to your Next.js project
cp nextjs-api-route.ts pages/api/rdap.ts

# Install dependencies
npm install rdapify
```

**Endpoint**:
- `GET /api/rdap?type=domain&query=example.com`
- `GET /api/rdap?type=ip&query=8.8.8.8`
- `GET /api/rdap?type=asn&query=15169`

**Example Request**:
```bash
curl "http://localhost:3000/api/rdap?type=domain&query=example.com"
```

---

## Security Considerations

### SSRF Protection

Both examples use strict SSRF protection:

```javascript
ssrfProtection: {
  enabled: true,
  blockPrivateIPs: true,
  blockLocalhost: true,
  allowedDomains: [
    'rdap.verisign.com',
    'rdap.arin.net',
    'rdap.ripe.net',
    'rdap.apnic.net',
    'rdap.lacnic.net',
    'rdap.afrinic.net'
  ]
}
```

**Why allowlist?**
- Prevents SSRF attacks
- Ensures queries only go to legitimate RDAP servers
- Reduces attack surface

### Rate Limiting

Simple in-memory rate limiting is included:
- 30 requests per minute per IP
- Suitable for development/small deployments

**For production**, use:
- Redis-based rate limiting
- Distributed rate limiting (e.g., rate-limiter-flexible)
- API gateway rate limiting (e.g., Kong, Tyk)

### Privacy

PII redaction is enabled by default:
```javascript
privacy: {
  redactEmails: true,
  redactPhones: true,
  redactAddresses: true
}
```

This ensures GDPR/CCPA compliance.

---

## Performance Optimization

### Caching

Both examples use in-memory caching:
```javascript
cache: {
  enabled: true,
  ttl: 3600000, // 1 hour
  maxSize: 500
}
```

**For production**, consider:
- Redis caching
- CDN caching (Cloudflare, Fastly)
- Database caching (PostgreSQL, MongoDB)

### Timeouts

Aggressive timeouts prevent slow queries:
```javascript
timeout: 5000, // 5 seconds
retry: {
  maxAttempts: 2,
  backoff: 'exponential'
}
```

---

## Deployment

### Environment Variables

Recommended environment variables:

```bash
# Server
PORT=3000
NODE_ENV=production

# RDAP
RDAP_CACHE_TTL=3600000
RDAP_TIMEOUT=5000
RDAP_MAX_RETRIES=2

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=30

# Security
ALLOWED_RDAP_DOMAINS=rdap.verisign.com,rdap.arin.net
```

### Docker

Example Dockerfile:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "express-middleware.js"]
```

### Kubernetes

Example deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rdap-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: rdap-api
  template:
    metadata:
      labels:
        app: rdap-api
    spec:
      containers:
      - name: rdap-api
        image: your-registry/rdap-api:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: RDAP_CACHE_TTL
          value: "3600000"
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
```

---

## Monitoring

### Metrics to Track

- Request rate (requests/second)
- Error rate (errors/total requests)
- Response time (p50, p95, p99)
- Cache hit rate
- SSRF blocks (security metric)
- Rate limit hits

### Example with Prometheus

```javascript
const prometheus = require('prom-client');

const requestCounter = new prometheus.Counter({
  name: 'rdap_requests_total',
  help: 'Total RDAP requests',
  labelNames: ['type', 'status']
});

const responseTime = new prometheus.Histogram({
  name: 'rdap_response_time_seconds',
  help: 'RDAP response time',
  labelNames: ['type']
});

// In your handler
const start = Date.now();
try {
  const result = await client.queryDomain(domain);
  requestCounter.inc({ type: 'domain', status: 'success' });
} catch (error) {
  requestCounter.inc({ type: 'domain', status: 'error' });
} finally {
  responseTime.observe({ type: 'domain' }, (Date.now() - start) / 1000);
}
```

---

## Testing

### Unit Tests

```javascript
const request = require('supertest');
const app = require('./express-middleware');

describe('RDAP API', () => {
  it('should query domain', async () => {
    const response = await request(app)
      .get('/api/rdap/domain/example.com')
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('handle');
  });
  
  it('should block SSRF attempts', async () => {
    const response = await request(app)
      .get('/api/rdap/domain/localhost')
      .expect(403);
    
    expect(response.body.error).toBe('SSRFProtectionError');
  });
});
```

### Load Testing

```bash
# Using Apache Bench
ab -n 1000 -c 10 http://localhost:3000/api/rdap/domain/example.com

# Using k6
k6 run --vus 10 --duration 30s load-test.js
```

---

## Troubleshooting

### Common Issues

**1. SSRF Protection Blocking Legitimate Requests**

Solution: Add the RDAP server to allowlist:
```javascript
allowedDomains: ['your-rdap-server.com']
```

**2. Rate Limit Too Strict**

Solution: Adjust rate limit settings:
```javascript
const maxRequests = 100; // Increase from 30
```

**3. Slow Response Times**

Solutions:
- Increase cache TTL
- Reduce timeout
- Use CDN caching
- Scale horizontally

**4. Memory Leaks**

Solution: Clear old rate limit entries:
```javascript
setInterval(() => {
  const now = Date.now();
  for (const [ip, requests] of rateLimitMap.entries()) {
    if (requests.every(time => now - time > windowMs)) {
      rateLimitMap.delete(ip);
    }
  }
}, 60000);
```

---

## Support

- **Documentation**: https://rdapify.com/docs
- **Issues**: https://github.com/rdapify/RDAPify/issues
- **Security**: security@rdapify.com

---

## License

MIT License - See LICENSE file for details
