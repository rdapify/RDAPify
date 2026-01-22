/**
 * Basic ASN lookup example
 * Demonstrates how to query RDAP information for an Autonomous System Number
 */

const { RDAPClient } = require('rdapify');

async function main() {
  // Create client
  const client = new RDAPClient({
    cache: true,
    privacy: { redactPII: true },
  });

  try {
    console.log('Querying RDAP information for AS15169 (Google)...\n');

    // Query ASN information (can use number or string with "AS" prefix)
    const result = await client.asn(15169); // or "AS15169"

    console.log('ASN Information:');
    console.log('================');
    console.log(`ASN: AS${result.startAutnum}`);
    if (result.endAutnum && result.endAutnum !== result.startAutnum) {
      console.log(`ASN Range: AS${result.startAutnum} - AS${result.endAutnum}`);
    }
    console.log(`Name: ${result.name || 'N/A'}`);
    console.log(`Country: ${result.country || 'N/A'}`);
    console.log(`Type: ${result.type || 'N/A'}`);
    console.log(`Status: ${result.status?.join(', ') || 'N/A'}`);

    // Display entities (organizations)
    if (result.entities && result.entities.length > 0) {
      console.log('\nOrganizations:');
      result.entities.forEach((entity) => {
        const roles = entity.roles?.join(', ') || 'unknown';
        console.log(`  - ${entity.handle || 'Unknown'} (${roles})`);
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

    // Display remarks
    if (result.remarks && result.remarks.length > 0) {
      console.log('\nRemarks:');
      result.remarks.slice(0, 2).forEach((remark) => {
        if (remark.title) {
          console.log(`  - ${remark.title}`);
        }
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
