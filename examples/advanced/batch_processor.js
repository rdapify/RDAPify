/**
 * Batch Processing Example
 * Demonstrates how to efficiently query multiple domains/IPs in parallel
 */

const { RDAPClient } = require('rdapify');

async function main() {
  const client = new RDAPClient({
    cache: true,
    privacy: { redactPII: true },
    retry: { maxAttempts: 2 },
  });

  // List of domains to query
  const domains = [
    'example.com',
    'google.com',
    'github.com',
    'cloudflare.com',
    'amazon.com',
  ];

  console.log(`Processing ${domains.length} domains in parallel...\n`);

  try {
    // Process all domains in parallel
    const startTime = Date.now();
    const results = await Promise.allSettled(
      domains.map((domain) => client.domain(domain))
    );
    const duration = Date.now() - startTime;

    // Analyze results
    const successful = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    console.log('Batch Processing Results:');
    console.log('========================');
    console.log(`Total: ${results.length}`);
    console.log(`Successful: ${successful.length}`);
    console.log(`Failed: ${failed.length}`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Average: ${Math.round(duration / results.length)}ms per query\n`);

    // Display successful results
    if (successful.length > 0) {
      console.log('Successful Queries:');
      successful.forEach((result, index) => {
        const data = result.value;
        const cached = data.metadata.cached ? '(cached)' : '(fresh)';
        console.log(`  ✓ ${data.ldhName} - ${data.status?.[0] || 'N/A'} ${cached}`);
      });
    }

    // Display failures
    if (failed.length > 0) {
      console.log('\nFailed Queries:');
      failed.forEach((result, index) => {
        console.log(`  ✗ ${domains[index]} - ${result.reason.message}`);
      });
    }

    // Cache statistics
    const cachedCount = successful.filter((r) => r.value.metadata.cached).length;
    console.log(`\nCache Hit Rate: ${Math.round((cachedCount / successful.length) * 100)}%`);
  } catch (error) {
    console.error('Batch processing error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
