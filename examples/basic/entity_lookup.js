/**
 * Basic entity lookup example
 * Demonstrates how to query RDAP information for an entity (contact/registrar/registrant)
 *
 * Note: Entity queries require an explicit RDAP server URL.
 * There is no global IANA bootstrap for entities — you must know which registry
 * holds the entity handle.
 *
 * Common registries:
 *   ARIN:   https://rdap.arin.net/registry
 *   RIPE:   https://rdap.db.ripe.net
 *   APNIC:  https://rdap.apnic.net
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

  // Example: query a registrar entity from Verisign
  const handle = 'VRSN-96';
  const serverUrl = 'https://rdap.verisign.com/com/v1';

  try {
    console.log(`Querying RDAP entity: ${handle} from ${serverUrl}\n`);

    const result = await client.entity(handle, serverUrl);

    console.log('=== Entity Information ===');
    console.log(`Handle:   ${result.handle || '—'}`);
    console.log(`Roles:    ${result.roles?.join(', ') || '—'}`);
    console.log(`Status:   ${result.status?.join(', ') || '—'}`);

    // Extract name from vCard
    if (result.vcardArray && Array.isArray(result.vcardArray[1])) {
      const fnField = result.vcardArray[1].find(f => Array.isArray(f) && f[0] === 'fn');
      if (fnField) console.log(`Name:     ${fnField[3]}`);
    }

    const registered = result.events?.find(e => e.type === 'registration');
    const updated = result.events?.find(e => e.type === 'last changed');
    if (registered) console.log(`Registered: ${registered.date}`);
    if (updated)    console.log(`Updated:    ${updated.date}`);

    console.log(`\nSource:   ${result.metadata.source}`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
