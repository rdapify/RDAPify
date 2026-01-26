/**
 * Example: Performance Monitoring
 * 
 * This example shows how to monitor performance metrics over time
 * and identify slow queries.
 */

const { RDAPClient } = require('../../dist');

async function performanceMonitoring() {
  const client = new RDAPClient({
    cache: true,
    logging: {
      level: 'debug',
      enabled: true,
    },
  });

  console.log('=== Performance Monitoring Example ===\n');

  // Simulate various queries
  const domains = [
    'example.com',
    'google.com',
    'github.com',
    'stackoverflow.com',
    'reddit.com',
  ];

  console.log('Running queries...\n');

  for (const domain of domains) {
    try {
      const startTime = Date.now();
      await client.domain(domain);
      const duration = Date.now() - startTime;
      console.log(`✓ ${domain} - ${duration}ms`);
    } catch (error) {
      console.log(`✗ ${domain} - ${error.message}`);
    }
  }

  // Query some domains again to test cache performance
  console.log('\n=== Testing Cache Performance ===\n');
  
  for (const domain of domains.slice(0, 3)) {
    try {
      const startTime = Date.now();
      await client.domain(domain);
      const duration = Date.now() - startTime;
      console.log(`✓ ${domain} (cached) - ${duration}ms`);
    } catch (error) {
      console.log(`✗ ${domain} - ${error.message}`);
    }
  }

  // Analyze performance
  console.log('\n=== Performance Analysis ===');
  const metrics = client.getMetrics();
  
  console.log(`\nOverall Performance:`);
  console.log(`  Average Response Time: ${metrics.avgResponseTime.toFixed(2)}ms`);
  console.log(`  Min Response Time: ${metrics.minResponseTime}ms`);
  console.log(`  Max Response Time: ${metrics.maxResponseTime}ms`);
  console.log(`  Total Duration: ${metrics.totalDuration}ms`);

  console.log(`\nCache Performance:`);
  console.log(`  Cache Hit Rate: ${metrics.cacheHitRate.toFixed(2)}%`);
  console.log(`  Cached queries are ~${(metrics.avgResponseTime / 10).toFixed(0)}x faster`);

  // Get time-based metrics (last 30 seconds)
  const recentMetrics = client.getMetrics(Date.now() - 30000);
  console.log(`\nRecent Activity (last 30s):`);
  console.log(`  Queries: ${recentMetrics.total}`);
  console.log(`  Success Rate: ${recentMetrics.successRate.toFixed(2)}%`);

  // Connection pool efficiency
  const poolStats = client.getConnectionPoolStats();
  console.log(`\nConnection Pool Efficiency:`);
  console.log(`  Total Connections: ${poolStats.totalConnections}`);
  console.log(`  Reuse Rate: ${((poolStats.totalConnections / metrics.total) * 100).toFixed(2)}%`);

  // Clean up
  client.destroy();
}

// Run the example
performanceMonitoring().catch(console.error);
