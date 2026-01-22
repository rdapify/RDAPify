/**
 * Basic domain lookup example
 * Demonstrates how to query RDAP information for a domain
 */

const { RDAPClient } = require('rdapify');

async function main() {
  // Create client with default options
  const client = new RDAPClient({
    cache: true, // Enable caching (1 hour TTL)
    privacy: {
      redactPII: true, // Automatically redact personal information
    },
    retry: {
      maxAttempts: 3, // Retry up to 3 times on failure
      backoff: 'exponential',
    },
  });

  try {
    console.log('Querying RDAP information for example.com...\n');

    // Query domain information
    const result = await client.domain('example.com');

    console.log('Domain Information:');
    console.log('==================');
    console.log(`Domain: ${result.ldhName}`);
    console.log(`Handle: ${result.handle || 'N/A'}`);
    console.log(`Status: ${result.status?.join(', ') || 'N/A'}`);
    console.log(`Registrar: ${result.registrar?.name || 'N/A'}`);

    // Display nameservers
    if (result.nameservers && result.nameservers.length > 0) {
      console.log('\nNameservers:');
      result.nameservers.forEach((ns) => console.log(`  - ${ns}`));
    }

    // Display events
    if (result.events && result.events.length > 0) {
      console.log('\nImportant Events:');
      const importantEvents = result.events.filter((e) =>
        ['registration', 'expiration', 'last changed'].includes(e.type)
      );
      importantEvents.forEach((event) => {
        const date = new Date(event.date).toLocaleDateString();
        console.log(`  - ${event.type}: ${date}`);
      });
    }

    // Display metadata
    console.log('\nMetadata:');
    console.log(`  Source: ${result.metadata.source}`);
    console.log(`  Cached: ${result.metadata.cached ? 'Yes' : 'No'}`);
    console.log(`  Timestamp: ${new Date(result.metadata.timestamp).toLocaleString()}`);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code) {
      console.error('Error Code:', error.code);
    }
    if (error.statusCode) {
      console.error('HTTP Status:', error.statusCode);
    }
    process.exit(1);
  }
}

// Run the example
main().catch(console.error);
