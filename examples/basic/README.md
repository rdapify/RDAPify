# Basic Examples

Simple examples demonstrating core RDAPify functionality.

## Examples

- Domain lookups
- IP address queries
- ASN queries
- Basic error handling
- Simple caching

## Quick Start

```javascript
const { RDAPify } = require('rdapify');

const client = new RDAPify();

// Domain lookup
const result = await client.lookup('example.com');
console.log(result);
```

## Running Examples

```bash
node domain-lookup.js
node ip-lookup.js
node asn-lookup.js
```

## Next Steps

After mastering basic examples, explore:
- `../typescript/` for type-safe implementations
- `../frameworks/` for framework integrations
- `../advanced/` for complex scenarios
