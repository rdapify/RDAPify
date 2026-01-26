/**
 * Example: Using Metrics and Logging
 * 
 * This example demonstrates how to use the built-in metrics collection
 * and logging features to monitor RDAP queries.
 */

const { RDAPClient } = require('../../dist');

async function monitoringExample() {
  // Create client with logging enabled
  const client = new RDAPClient({
    cache: true,
    logging: {
      level: 'info', // debug, info, warn, error
      enabled: true,
    },
  });

  console.log('=== Monitoring Example ===\n');

  // Perform some queries
  console.log('Performing queries...\n');
  
  try {
    await client.domain('example.com');
    await client.domain('google.com');
    await client.ip('8.8.8.8');
    await client.asn(15169);
    
    // Query cached domain again
    await client.domain('example.com');
  } catch (error) {
    console.error('Query error:', error.message);
  }

  // Get metrics summary
  console.log('\n=== Metrics Summary ===');
  const metrics = client.getMetrics();
  console.log(`Total Queries: ${metrics.total}`);
  console.log(`Successful: ${metrics.successful}`);
  console.log(`Failed: ${metrics.failed}`);
  console.log(`Success Rate: ${metrics.successRate.toFixed(2)}%`);
  console.log(`Average Response Time: ${metrics.avgResponseTime.toFixed(2)}ms`);
  console.log(`Cache Hit Rate: ${metrics.cacheHitRate.toFixed(2)}%`);
  console.log('\nQueries by Type:');
  console.log(`  - Domain: ${metrics.queriesByType.domain}`);
  console.log(`  - IP: ${metrics.queriesByType.ip}`);
  console.log(`  - ASN: ${metrics.queriesByType.asn}`);

  // Get connection pool stats
  console.log('\n=== Connection Pool Stats ===');
  const poolStats = client.getConnectionPoolStats();
  console.log(`Total Connections: ${poolStats.totalConnections}`);
  console.log(`Active: ${poolStats.activeConnections}`);
  console.log(`Idle: ${poolStats.idleConnections}`);
  console.log(`Hosts: ${poolStats.hosts}`);

  // Get recent logs
  console.log('\n=== Recent Logs (last 5) ===');
  const logs = client.getLogs(5);
  logs.forEach((log) => {
    const time = new Date(log.timestamp).toISOString();
    console.log(`[${time}] ${log.level.toUpperCase()}: ${log.message}`);
  });

  // Get logger statistics
  console.log('\n=== Logger Stats ===');
  const logger = client.getLogger();
  const loggerStats = logger.getStats();
  console.log(`Total Logs: ${loggerStats.totalLogs}`);
  console.log(`Log Level: ${loggerStats.level}`);
  console.log('Logs by Level:');
  console.log(`  - Debug: ${loggerStats.logsByLevel.debug}`);
  console.log(`  - Info: ${loggerStats.logsByLevel.info}`);
  console.log(`  - Warn: ${loggerStats.logsByLevel.warn}`);
  console.log(`  - Error: ${loggerStats.logsByLevel.error}`);

  // Export metrics for analysis
  console.log('\n=== Exporting Metrics ===');
  const metricsCollector = client.getMetrics.__collector; // Internal access for demo
  // In production, you would use the public API
  console.log('Metrics can be exported for external analysis');

  // Clean up
  client.destroy();
}

// Run the example
monitoringExample().catch(console.error);
