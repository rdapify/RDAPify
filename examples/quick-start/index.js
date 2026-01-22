/**
 * Quick Start Example - RDAPify v0.1.0-alpha.1
 * 
 * This example demonstrates basic usage of RDAPify to query domain information.
 * 
 * Installation:
 *   npm install rdapify
 * 
 * Run:
 *   node examples/quick-start/index.js
 */

const { RDAPClient } = require('rdapify');

async function main() {
  // Create a client with default options
  const client = new RDAPClient({
    cache: true,           // Enable in-memory caching
    redactPII: true,       // Automatically redact personal information
    retry: {
      maxAttempts: 3,
      backoff: 'exponential'
    }
  });

  try {
    console.log('Querying domain: example.com\n');
    
    // Query domain information
    const result = await client.domain('example.com');
    
    // Display results
    console.log('Domain:', result.ldhName);
    console.log('Status:', result.status.join(', '));
    console.log('Nameservers:', result.nameservers.join(', '));
    
    // Find registration and expiration dates
    const registered = result.events.find(e => e.type === 'registration');
    const expires = result.events.find(e => e.type === 'expiration');
    
    if (registered) {
      console.log('Registered:', new Date(registered.date).toLocaleDateString());
    }
    if (expires) {
      console.log('Expires:', new Date(expires.date).toLocaleDateString());
    }
    
    // Display registrar info
    if (result.registrar) {
      console.log('\nRegistrar:', result.registrar.name);
    }
    
    console.log('\nQuery completed successfully!');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
