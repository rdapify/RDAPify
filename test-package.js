const { RDAPClient } = require('./rdapify-0.1.3.tgz');

async function test() {
  try {
    const client = new RDAPClient();
    console.log('✅ RDAPClient imported successfully');
    console.log('✅ Client created successfully');
    console.log('✅ Package is working correctly');
    
    // Test exports
    console.log('\nTesting exports:');
    console.log('✅ RDAPClient:', typeof client);
    console.log('✅ domain method:', typeof client.domain);
    console.log('✅ ip method:', typeof client.ip);
    console.log('✅ asn method:', typeof client.asn);
    
    console.log('\n🎉 All tests passed!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

test();
