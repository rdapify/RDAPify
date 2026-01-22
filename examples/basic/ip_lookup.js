/**
 * Basic IP lookup example
 * Demonstrates how to query RDAP information for an IP address
 */

const { RDAPClient } = require('rdapify');

async function main() {
  // Create client
  const client = new RDAPClient({
    cache: true,
    privacy: { redactPII: true },
  });

  try {
    console.log('Querying RDAP information for 8.8.8.8...\n');

    // Query IP information
    const result = await client.ip('8.8.8.8');

    console.log('IP Network Information:');
    console.log('======================');
    console.log(`IP Range: ${result.startAddress} - ${result.endAddress}`);
    console.log(`IP Version: IPv${result.ipVersion === 'v4' ? '4' : '6'}`);
    console.log(`Network Name: ${result.name || 'N/A'}`);
    console.log(`Country: ${result.country || 'N/A'}`);
    console.log(`Type: ${result.type || 'N/A'}`);
    console.log(`Status: ${result.status?.join(', ') || 'N/A'}`);

    // Display entities (organizations)
    if (result.entities && result.entities.length > 0) {
      console.log('\nOrganizations:');
      result.entities.forEach((entity) => {
        if (entity.roles?.includes('registrant')) {
          console.log(`  - ${entity.handle || 'Unknown'} (${entity.roles.join(', ')})`);
        }
      });
    }

    // Display events
    if (result.events && result.events.length > 0) {
      console.log('\nEvents:');
      result.events.slice(0, 3).forEach((event) => {
        const date = new Date(event.date).toLocaleDateString();
        console.log(`  - ${event.type}: ${date}`);
      });
    }

    // Display metadata
    console.log('\nMetadata:');
    console.log(`  Source: ${result.metadata.source}`);
    console.log(`  Cached: ${result.metadata.cached ? 'Yes' : 'No'}`);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code) {
      console.error('Error Code:', error.code);
    }
    process.exit(1);
  }
}

// Run the example
main().catch(console.error);
