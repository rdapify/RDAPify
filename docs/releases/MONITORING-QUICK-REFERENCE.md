# Monitoring & Observability - Quick Reference

## 🚀 Quick Start

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  cache: true,
  logging: {
    level: 'info',
    enabled: true,
  },
});

// Perform queries
await client.domain('example.com');

// Get metrics
const metrics = client.getMetrics();
console.log(metrics);

// Clean up
client.destroy();
```

---

## 📊 Metrics API

### Get Metrics Summary
```typescript
const metrics = client.getMetrics(since?: number);
```

**Returns:**
```typescript
{
  total: number;              // Total queries
  successful: number;         // Successful queries
  failed: number;             // Failed queries
  successRate: number;        // Success rate (%)
  avgResponseTime: number;    // Average response time (ms)
  minResponseTime: number;    // Minimum response time (ms)
  maxResponseTime: number;    // Maximum response time (ms)
  cacheHitRate: number;       // Cache hit rate (%)
  totalDuration: number;      // Total duration (ms)
  queriesByType: {
    domain: number;
    ip: number;
    asn: number;
  };
  errorsByType: {
    [errorName: string]: number;
  };
}
```

**Examples:**
```typescript
// All metrics
const all = client.getMetrics();

// Last hour only
const lastHour = client.getMetrics(Date.now() - 3600000);

// Last 5 minutes
const recent = client.getMetrics(Date.now() - 300000);
```

---

## 🔄 Connection Pool API

### Get Connection Pool Statistics
```typescript
const stats = client.getConnectionPoolStats();
```

**Returns:**
```typescript
{
  totalConnections: number;   // Total connections
  activeConnections: number;  // Currently in use
  idleConnections: number;    // Available for reuse
  hosts: number;              // Number of unique hosts
}
```

**Example:**
```typescript
const stats = client.getConnectionPoolStats();
console.log(`Active: ${stats.activeConnections}/${stats.totalConnections}`);
console.log(`Efficiency: ${(stats.idleConnections / stats.totalConnections * 100).toFixed(1)}% reusable`);
```

---

## 📝 Logging API

### Configure Logging
```typescript
const client = new RDAPClient({
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error',
    enabled: boolean,
  },
});
```

### Get Logger Instance
```typescript
const logger = client.getLogger();
```

### Get Recent Logs
```typescript
const logs = client.getLogs(count?: number);
```

**Returns:**
```typescript
Array<{
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
  context?: Record<string, any>;
}>
```

**Examples:**
```typescript
// Last 10 logs
const recent = client.getLogs(10);

// All logs
const all = client.getLogs();

// Filter by level
const errors = logger.getLogsByLevel('error');

// Filter by time range
const lastHour = logger.getLogsInRange(
  Date.now() - 3600000,
  Date.now()
);
```

### Get Logger Statistics
```typescript
const stats = logger.getStats();
```

**Returns:**
```typescript
{
  enabled: boolean;
  level: string;
  totalLogs: number;
  logsByLevel: {
    debug: number;
    info: number;
    warn: number;
    error: number;
  };
}
```

---

## 🧹 Cleanup API

### Clear All Data
```typescript
await client.clearAll();
```
Clears:
- Response cache
- Bootstrap cache
- Metrics
- Logs

### Destroy Client
```typescript
client.destroy();
```
Cleans up:
- Rate limiter timers
- Connection pool
- Cleanup intervals

**Important:** Always call `destroy()` when done, especially in long-running applications.

---

## 📈 Common Patterns

### Performance Monitoring
```typescript
// Before
const startTime = Date.now();

// Perform queries
await client.domain('example.com');
await client.ip('8.8.8.8');

// After
const metrics = client.getMetrics(startTime);
console.log(`Queries: ${metrics.total}`);
console.log(`Success Rate: ${metrics.successRate}%`);
console.log(`Avg Time: ${metrics.avgResponseTime}ms`);
```

### Cache Effectiveness
```typescript
const metrics = client.getMetrics();
const cacheEfficiency = metrics.cacheHitRate;

if (cacheEfficiency < 50) {
  console.warn('Low cache hit rate - consider increasing TTL');
}
```

### Error Tracking
```typescript
const metrics = client.getMetrics();

if (metrics.failed > 0) {
  console.log('Errors by type:');
  Object.entries(metrics.errorsByType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
}
```

### Connection Pool Monitoring
```typescript
const stats = client.getConnectionPoolStats();
const utilizationRate = (stats.activeConnections / stats.totalConnections) * 100;

console.log(`Pool Utilization: ${utilizationRate.toFixed(1)}%`);

if (utilizationRate > 80) {
  console.warn('High connection pool utilization');
}
```

### Debug Logging
```typescript
// Development
const devClient = new RDAPClient({
  logging: { level: 'debug', enabled: true },
});

// Production
const prodClient = new RDAPClient({
  logging: { level: 'error', enabled: true },
});
```

---

## 🎯 Best Practices

### 1. Enable Logging in Development
```typescript
const isDev = process.env.NODE_ENV === 'development';

const client = new RDAPClient({
  logging: {
    level: isDev ? 'debug' : 'error',
    enabled: true,
  },
});
```

### 2. Monitor Performance Regularly
```typescript
setInterval(() => {
  const metrics = client.getMetrics(Date.now() - 60000); // Last minute
  console.log(`Last minute: ${metrics.total} queries, ${metrics.successRate}% success`);
}, 60000);
```

### 3. Export Metrics for Analysis
```typescript
// Get metrics collector (internal)
const metrics = client.getMetrics();

// Save to file or send to monitoring service
fs.writeFileSync('metrics.json', JSON.stringify(metrics, null, 2));
```

### 4. Always Clean Up
```typescript
// In Express.js
app.on('close', () => {
  client.destroy();
});

// In Lambda
exports.handler = async (event) => {
  try {
    const result = await client.domain(event.domain);
    return result;
  } finally {
    client.destroy();
  }
};
```

### 5. Set Appropriate Log Levels
- **debug**: Development only (very verbose)
- **info**: Development and staging (moderate verbosity)
- **warn**: Production (warnings and errors only)
- **error**: Production (errors only)

---

## 🔍 Troubleshooting

### High Response Times
```typescript
const metrics = client.getMetrics();

if (metrics.avgResponseTime > 1000) {
  // Check cache hit rate
  console.log(`Cache Hit Rate: ${metrics.cacheHitRate}%`);
  
  // Check connection pool
  const poolStats = client.getConnectionPoolStats();
  console.log(`Pool: ${poolStats.activeConnections}/${poolStats.totalConnections}`);
}
```

### Low Cache Hit Rate
```typescript
const metrics = client.getMetrics();

if (metrics.cacheHitRate < 30) {
  console.log('Consider:');
  console.log('- Increasing cache TTL');
  console.log('- Checking query patterns');
  console.log('- Enabling cache warming');
}
```

### High Error Rate
```typescript
const metrics = client.getMetrics();

if (metrics.successRate < 90) {
  console.log('Error breakdown:');
  Object.entries(metrics.errorsByType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count} (${(count/metrics.total*100).toFixed(1)}%)`);
  });
  
  // Check recent error logs
  const errors = logger.getLogsByLevel('error');
  console.log('Recent errors:', errors.slice(-5));
}
```

---

## 📚 See Also

- [Examples](examples/advanced/monitoring_example.js)
- [Performance Monitoring Example](examples/advanced/performance_monitoring.js)
- [CHANGELOG](CHANGELOG.md)
- [API Documentation](docs/api_reference/)
