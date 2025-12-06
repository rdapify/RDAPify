# 🚀 Deployment Guide

> **🎯 Purpose:** Comprehensive guide for deploying RDAPify in production environments  
> **📚 Related:** [Production Checklist](../getting_started/production_checklist.md) | [Performance](performance.md) | [Observability](observability.md)  
> **⏱️ Reading Time:** 15 minutes

---

## 🌐 Deployment Overview

RDAPify supports multiple deployment strategies across various platforms:

```mermaid
graph TB
    A[RDAPify Application] --> B[Traditional Servers]
    A --> C[Containers]
    A --> D[Serverless]
    A --> E[Edge Computing]
    
    B --> B1[Node.js on VPS]
    B --> B2[PM2 Process Manager]
    
    C --> C1[Docker]
    C --> C2[Kubernetes]
    
    D --> D1[AWS Lambda]
    D --> D2[Azure Functions]
    D --> D3[Google Cloud Run]
    
    E --> E1[Cloudflare Workers]
    E --> E2[Vercel Edge]
    
    style A fill:#2196F3
    style B,C,D,E fill:#4CAF50
```

---

## 📋 Pre-Deployment Checklist

### Essential Requirements

- [ ] Node.js 16+ installed (or compatible runtime)
- [ ] Environment variables configured
- [ ] SSL/TLS certificates ready
- [ ] Monitoring tools configured
- [ ] Backup strategy defined
- [ ] Rate limiting configured
- [ ] Caching strategy implemented
- [ ] Error handling tested
- [ ] Security audit completed
- [ ] Performance benchmarks met

---

## 🖥️ Traditional Server Deployment

### Node.js with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Install dependencies
npm install --production

# Build application
npm run build

# Start with PM2
pm2 start dist/index.js --name rdapify-app \
  --instances max \
  --exec-mode cluster \
  --max-memory-restart 500M

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

### PM2 Ecosystem File

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'rdapify-app',
    script: './dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      CACHE_ENABLED: 'true',
      CACHE_TTL: '3600',
      RATE_LIMIT_ENABLED: 'true'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

---

## 🐳 Docker Deployment

### Dockerfile

```dockerfile
# Multi-stage build for optimal image size
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src

# Build application
RUN npm run build

# Production image
FROM node:18-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "dist/index.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  rdapify:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - CACHE_ENABLED=true
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    restart: unless-stopped
    networks:
      - rdapify-network
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health')"]
      interval: 30s
      timeout: 3s
      retries: 3

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped
    networks:
      - rdapify-network

volumes:
  redis-data:

networks:
  rdapify-network:
    driver: bridge
```

### Build and Run

```bash
# Build image
docker build -t rdapify:latest .

# Run container
docker run -d \
  --name rdapify-app \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e CACHE_ENABLED=true \
  --restart unless-stopped \
  rdapify:latest

# Or use Docker Compose
docker-compose up -d
```

---

## ☸️ Kubernetes Deployment

### Deployment Manifest

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rdapify
  labels:
    app: rdapify
spec:
  replicas: 3
  selector:
    matchLabels:
      app: rdapify
  template:
    metadata:
      labels:
        app: rdapify
    spec:
      containers:
      - name: rdapify
        image: rdapify:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: CACHE_ENABLED
          value: "true"
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: rdapify-secrets
              key: redis-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: rdapify-service
spec:
  selector:
    app: rdapify
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

### Apply Configuration

```bash
# Create namespace
kubectl create namespace rdapify

# Apply secrets
kubectl create secret generic rdapify-secrets \
  --from-literal=redis-url=redis://redis:6379 \
  -n rdapify

# Apply deployment
kubectl apply -f k8s/deployment.yaml -n rdapify

# Check status
kubectl get pods -n rdapify
kubectl get services -n rdapify
```

---

## ⚡ Serverless Deployment

### AWS Lambda

```javascript
// lambda/handler.js
const { RDAPClient } = require('rdapify');

const client = new RDAPClient({
  cache: { enabled: true, ttl: 3600 }
});

exports.handler = async (event) => {
  try {
    const { domain, ip, asn } = JSON.parse(event.body);
    
    let result;
    if (domain) {
      result = await client.domain(domain);
    } else if (ip) {
      result = await client.ip(ip);
    } else if (asn) {
      result = await client.asn(asn);
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing query parameter' })
      };
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600'
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

### Serverless Framework Configuration

```yaml
# serverless.yml
service: rdapify-service

provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  memorySize: 512
  timeout: 30
  environment:
    NODE_ENV: production
    CACHE_ENABLED: true

functions:
  rdapQuery:
    handler: lambda/handler.handler
    events:
      - http:
          path: /query
          method: post
          cors: true

plugins:
  - serverless-offline

package:
  exclude:
    - node_modules/**
    - test/**
```

### Deploy to AWS Lambda

```bash
# Install Serverless Framework
npm install -g serverless

# Deploy
serverless deploy

# Test
serverless invoke -f rdapQuery --data '{"body":"{\"domain\":\"example.com\"}"}'
```

---

## 🌍 Edge Computing Deployment

### Cloudflare Workers

```javascript
// worker.js
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  cache: { enabled: true, ttl: 3600 }
});

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const domain = url.searchParams.get('domain');
  const ip = url.searchParams.get('ip');
  const asn = url.searchParams.get('asn');
  
  try {
    let result;
    if (domain) {
      result = await client.domain(domain);
    } else if (ip) {
      result = await client.ip(ip);
    } else if (asn) {
      result = await client.asn(parseInt(asn));
    } else {
      return new Response('Missing query parameter', { status: 400 });
    }
    
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.statusCode || 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

### Deploy to Cloudflare

```bash
# Install Wrangler
npm install -g wrangler

# Login
wrangler login

# Deploy
wrangler publish
```

---

## 🔧 Environment Configuration

### Environment Variables

```bash
# .env.production
NODE_ENV=production
PORT=3000

# Cache Configuration
CACHE_ENABLED=true
CACHE_TTL=3600
REDIS_URL=redis://localhost:6379

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_SECOND=10
RATE_LIMIT_BURST_SIZE=20

# Security
SSRF_PROTECTION_ENABLED=true
PII_REDACTION_ENABLED=true

# Monitoring
LOG_LEVEL=info
METRICS_ENABLED=true
TRACING_ENABLED=true

# Performance
MAX_CONCURRENT_REQUESTS=100
REQUEST_TIMEOUT=30000
```

---

## 📊 Health Checks

### Health Check Endpoint

```javascript
// health.js
export async function healthCheck() {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {}
  };
  
  // Check cache connection
  try {
    await cacheClient.ping();
    checks.checks.cache = 'healthy';
  } catch (error) {
    checks.checks.cache = 'unhealthy';
    checks.status = 'degraded';
  }
  
  // Check RDAP connectivity
  try {
    await client.domain('example.com');
    checks.checks.rdap = 'healthy';
  } catch (error) {
    checks.checks.rdap = 'unhealthy';
    checks.status = 'degraded';
  }
  
  return checks;
}
```

---

## 🔄 Zero-Downtime Deployment

### Blue-Green Deployment

```bash
# Deploy new version (green)
kubectl apply -f k8s/deployment-green.yaml

# Wait for green to be ready
kubectl wait --for=condition=ready pod -l version=green

# Switch traffic to green
kubectl patch service rdapify-service -p '{"spec":{"selector":{"version":"green"}}}'

# Remove old version (blue)
kubectl delete deployment rdapify-blue
```

### Rolling Update

```bash
# Update image
kubectl set image deployment/rdapify rdapify=rdapify:v2.0.0

# Monitor rollout
kubectl rollout status deployment/rdapify

# Rollback if needed
kubectl rollout undo deployment/rdapify
```

---

## 📚 Additional Resources

- [Production Checklist](../getting_started/production_checklist.md)
- [Observability Guide](observability.md)
- [Performance Optimization](performance.md)
- [Security Best Practices](security_privacy.md)
- [Kubernetes Templates](../../templates/kubernetes/)
- [Cloud Deployment Guides](../integrations/cloud/)

---

**Need help with deployment?** Check our [troubleshooting guide](../troubleshooting/common_errors.md) or [get support](../support/getting_help.md).
