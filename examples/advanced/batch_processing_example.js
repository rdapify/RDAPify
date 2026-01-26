/**
 * Batch Processing Example
 * 
 * This example demonstrates how to efficiently process multiple
 * RDAP queries in parallel using the BatchProcessor.
 */

const { RDAPClient } = require('rdapify');

// Example 1: Basic Batch Processing
async function basicBatchProcessing() {
  console.log('\n=== Example 1: Basic Batch Processing ===\n');
  
  const client = new RDAPClient();
  const batchProcessor = client.getBatchProcessor();
  
  const queries = [
    { type: 'domain', query: 'example.com' },
    { type: 'domain', query: 'google.com' },
    { type: 'ip', query: '8.8.8.8' },
    { type: 'asn', query: 15169 }
  ];
  
  console.log(`Processing ${queries.length} queries...`);
  const results = await batchProcessor.processBatch(queries);
  
  console.log('\nResults:');
  results.forEach(result => {
    if (result.error) {
      console.log(`✗ ${result.type}:${result.query} - Error: ${result.error.message}`);
    } else {
      console.log(`✓ ${result.type}:${result.query} - Duration: ${result.duration}ms`);
    }
  });
  
  // Analyze results
  const stats = batchProcessor.analyzeBatchResults(results);
  console.log('\nStatistics:');
  console.log(`  Total: ${stats.total}`);
  console.log(`  Successful: ${stats.successful}`);
  console.log(`  Failed: ${stats.failed}`);
  console.log(`  Success Rate: ${stats.successRate.toFixed(2)}%`);
  console.log(`  Average Duration: ${stats.averageDuration.toFixed(2)}ms`);
  console.log(`  Total Duration: ${stats.totalDuration.toFixed(2)}ms`);
}

// Example 2: Batch Processing with Concurrency Control
async function batchWithConcurrency() {
  console.log('\n=== Example 2: Concurrency Control ===\n');
  
  const client = new RDAPClient();
  const batchProcessor = client.getBatchProcessor();
  
  const domains = [
    'example.com',
    'google.com',
    'github.com',
    'stackoverflow.com',
    'reddit.com',
    'twitter.com',
    'facebook.com',
    'amazon.com'
  ];
  
  const queries = domains.map(domain => ({
    type: 'domain',
    query: domain
  }));
  
  // Test different concurrency levels
  for (const concurrency of [1, 3, 5]) {
    console.log(`\nConcurrency: ${concurrency}`);
    const startTime = Date.now();
    
    const results = await batchProcessor.processBatch(queries, {
      concurrency,
      continueOnError: true
    });
    
    const duration = Date.now() - startTime;
    const stats = batchProcessor.analyzeBatchResults(results);
    
    console.log(`  Duration: ${duration}ms`);
    console.log(`  Success Rate: ${stats.successRate.toFixed(2)}%`);
    console.log(`  Avg per query: ${(duration / queries.length).toFixed(2)}ms`);
  }
}

// Example 3: Domain Portfolio Monitoring
async function domainPortfolioMonitoring() {
  console.log('\n=== Example 3: Domain Portfolio Monitoring ===\n');
  
  const client = new RDAPClient();
  const batchProcessor = client.getBatchProcessor();
  
  const portfolio = [
    'example.com',
    'example.org',
    'example.net',
    'google.com',
    'github.com'
  ];
  
  const queries = portfolio.map(domain => ({
    type: 'domain',
    query: domain
  }));
  
  console.log(`Monitoring ${portfolio.length} domains...`);
  const results = await batchProcessor.processBatch(queries, {
    concurrency: 5,
    continueOnError: true
  });
  
  console.log('\nDomain Status:');
  results.forEach(result => {
    if (result.error) {
      console.log(`✗ ${result.query}: Error - ${result.error.message}`);
      return;
    }
    
    const domain = result.result;
    const expiryEvent = domain.events?.find(e => e.type === 'expiration');
    
    if (expiryEvent) {
      const expiryDate = new Date(expiryEvent.date);
      const daysUntilExpiry = Math.floor(
        (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      
      const status = daysUntilExpiry < 30 ? '⚠️' : '✓';
      console.log(`${status} ${result.query}:`);
      console.log(`    Registrar: ${domain.registrar?.name || 'N/A'}`);
      console.log(`    Expires: ${expiryDate.toLocaleDateString()} (${daysUntilExpiry} days)`);
      console.log(`    Status: ${domain.status?.join(', ') || 'N/A'}`);
    } else {
      console.log(`✓ ${result.query}: No expiry information`);
    }
  });
}

// Example 4: IP Range Analysis
async function ipRangeAnalysis() {
  console.log('\n=== Example 4: IP Range Analysis ===\n');
  
  const client = new RDAPClient();
  const batchProcessor = client.getBatchProcessor();
  
  // Generate IP range
  const baseIP = '8.8.8';
  const queries = [];
  
  for (let i = 0; i < 10; i++) {
    queries.push({
      type: 'ip',
      query: `${baseIP}.${i}`
    });
  }
  
  console.log(`Analyzing IP range ${baseIP}.0-9...`);
  const results = await batchProcessor.processBatch(queries, {
    concurrency: 5,
    continueOnError: true
  });
  
  // Group by country
  const byCountry = {};
  results.forEach(result => {
    if (!result.error && result.result) {
      const country = result.result.country || 'Unknown';
      byCountry[country] = (byCountry[country] || 0) + 1;
    }
  });
  
  console.log('\nIPs by Country:');
  Object.entries(byCountry).forEach(([country, count]) => {
    console.log(`  ${country}: ${count}`);
  });
}

// Example 5: Error Handling and Retry
async function batchWithErrorHandling() {
  console.log('\n=== Example 5: Error Handling and Retry ===\n');
  
  const client = new RDAPClient();
  const batchProcessor = client.getBatchProcessor();
  
  const queries = [
    { type: 'domain', query: 'example.com' },
    { type: 'domain', query: 'invalid..domain' },  // Invalid
    { type: 'ip', query: '8.8.8.8' },
    { type: 'ip', query: 'not-an-ip' },  // Invalid
    { type: 'asn', query: 15169 }
  ];
  
  console.log('First attempt...');
  let results = await batchProcessor.processBatch(queries, {
    continueOnError: true
  });
  
  // Show initial results
  const stats1 = batchProcessor.analyzeBatchResults(results);
  console.log(`  Success: ${stats1.successful}/${stats1.total}`);
  console.log(`  Failed: ${stats1.failed}/${stats1.total}`);
  
  // Retry failed queries
  const failed = results
    .filter(r => r.error)
    .map(r => ({ type: r.type, query: r.query }));
  
  if (failed.length > 0) {
    console.log(`\nRetrying ${failed.length} failed queries...`);
    const retryResults = await batchProcessor.processBatch(failed, {
      continueOnError: true
    });
    
    // Update results
    retryResults.forEach(retryResult => {
      const index = results.findIndex(
        r => r.type === retryResult.type && r.query === retryResult.query
      );
      if (index !== -1) {
        results[index] = retryResult;
      }
    });
    
    const stats2 = batchProcessor.analyzeBatchResults(results);
    console.log(`  Success: ${stats2.successful}/${stats2.total}`);
    console.log(`  Failed: ${stats2.failed}/${stats2.total}`);
  }
  
  // Show final results
  console.log('\nFinal Results:');
  results.forEach(result => {
    const status = result.error ? '✗' : '✓';
    const message = result.error 
      ? result.error.message 
      : `${result.duration}ms`;
    console.log(`  ${status} ${result.type}:${result.query} - ${message}`);
  });
}

// Example 6: Progress Tracking
async function batchWithProgress() {
  console.log('\n=== Example 6: Progress Tracking ===\n');
  
  const client = new RDAPClient();
  const batchProcessor = client.getBatchProcessor();
  
  // Generate large batch
  const queries = [];
  for (let i = 0; i < 20; i++) {
    queries.push({
      type: 'domain',
      query: `example${i}.com`
    });
  }
  
  console.log(`Processing ${queries.length} queries with progress tracking...`);
  
  // Process in chunks
  const chunkSize = 5;
  const allResults = [];
  
  for (let i = 0; i < queries.length; i += chunkSize) {
    const chunk = queries.slice(i, i + chunkSize);
    const chunkResults = await batchProcessor.processBatch(chunk, {
      concurrency: 3,
      continueOnError: true
    });
    
    allResults.push(...chunkResults);
    
    const completed = Math.min(i + chunkSize, queries.length);
    const progress = (completed / queries.length * 100).toFixed(1);
    console.log(`  Progress: ${completed}/${queries.length} (${progress}%)`);
  }
  
  const stats = batchProcessor.analyzeBatchResults(allResults);
  console.log('\nCompleted!');
  console.log(`  Success Rate: ${stats.successRate.toFixed(2)}%`);
  console.log(`  Total Duration: ${stats.totalDuration.toFixed(2)}ms`);
}

// Run all examples
async function main() {
  try {
    await basicBatchProcessing();
    await batchWithConcurrency();
    await domainPortfolioMonitoring();
    await ipRangeAnalysis();
    await batchWithErrorHandling();
    await batchWithProgress();
    
    console.log('\n✓ All examples completed!\n');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  basicBatchProcessing,
  batchWithConcurrency,
  domainPortfolioMonitoring,
  ipRangeAnalysis,
  batchWithErrorHandling,
  batchWithProgress
};
