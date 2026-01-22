# Quick Start Example

This example demonstrates basic usage of RDAPify to query domain information.

## Installation

```bash
npm install rdapify
```

## Usage

```bash
node examples/quick-start/index.js
```

## Expected Output

```
Querying domain: example.com

Domain: example.com
Status: active, clientTransferProhibited
Nameservers: ns1.example.com, ns2.example.com
Registered: 8/14/1995
Expires: 8/13/2025

Registrar: Example Registrar Inc.

Query completed successfully!
```

## What This Example Shows

- Creating an RDAPClient with default options
- Querying domain information
- Accessing normalized response data
- Extracting events (registration, expiration)
- Error handling

## Next Steps

See the [API documentation](../../docs/api_reference/) for more advanced usage.
