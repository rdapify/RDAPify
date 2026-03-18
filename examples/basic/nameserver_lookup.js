/**
 * Basic nameserver lookup example
 * Demonstrates how to query RDAP information for a nameserver hostname
 */

const { RDAPClient } = require('rdapify');

async function main() {
  const client = new RDAPClient({
    cache: true,
    retry: {
      maxAttempts: 3,
      backoff: 'exponential',
    },
  });

  try {
    console.log('Querying RDAP information for ns1.example.com...\n');

    const result = await client.nameserver('ns1.example.com');

    console.log('=== Nameserver Information ===');
    console.log(`Hostname:   ${result.ldhName || result.unicodeName || result.query}`);
    console.log(`Handle:     ${result.handle || '—'}`);
    console.log(`Status:     ${result.status?.join(', ') || '—'}`);

    if (result.ipAddresses) {
      if (result.ipAddresses.v4?.length) {
        console.log(`IPv4:       ${result.ipAddresses.v4.join(', ')}`);
      }
      if (result.ipAddresses.v6?.length) {
        console.log(`IPv6:       ${result.ipAddresses.v6.join(', ')}`);
      }
    }

    const registered = result.events?.find(e => e.type === 'registration');
    const updated = result.events?.find(e => e.type === 'last changed');
    if (registered) console.log(`Registered: ${registered.date}`);
    if (updated)    console.log(`Updated:    ${updated.date}`);

    console.log(`\nSource:     ${result.metadata.source}`);
    console.log(`Cached:     ${result.metadata.cached}`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
