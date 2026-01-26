# RDAPify Examples

Comprehensive examples demonstrating RDAPify usage across different scenarios and frameworks.

## Directory Structure

```
examples/
├── basic/              # Simple usage examples
├── advanced/           # Advanced patterns and techniques
├── typescript/         # TypeScript-specific examples
├── frameworks/         # Framework integrations
└── real_world/         # Production-ready applications
```

## Quick Start

### Basic Examples

Start here if you're new to RDAPify:

- **domain_lookup.js** - Query domain information
- **ip_lookup.js** - Query IP address information
- **asn_lookup.js** - Query ASN information

```bash
cd examples/basic
node domain_lookup.js
```

### Advanced Examples

Learn advanced patterns and optimizations:

- **batch_processor.js** - Process multiple queries in parallel
- **batch_processing_example.js** - Comprehensive batch processing guide
- **rate_limiting_example.js** - Rate limiting patterns and strategies
- **custom_cache.js** - Implement custom cache adapters
- **rate_limiter.js** - Add rate limiting to queries
- **error_state_handler.js** - Comprehensive error handling
- **geo_distributed_cache.js** - Multi-region caching strategy

```bash
cd examples/advanced
node batch_processing_example.js
node rate_limiting_example.js
```

### TypeScript Examples

Type-safe usage with TypeScript:

- **typed_client.ts** - Type-safe client wrapper
- **generic_functions.ts** - Generic TypeScript patterns
- **custom_types.ts** - Extending RDAPify types

```bash
cd examples/typescript
npx ts-node typed_client.ts
```

### Framework Integrations

Integration with popular frameworks:

#### Express.js
REST API server with RDAPify

```bash
cd examples/frameworks/express_app
npm install
npm start
```

#### Next.js
Server-side rendering with App Router

```bash
cd examples/frameworks/nextjs_app
npm install
npm run dev
```

### Real-World Applications

Production-ready examples:

#### Domain Monitor
Monitor domain expiration dates with alerts

```bash
cd examples/real_world/domain_monitor
node index.js
```

#### IP Tracker
Track IP address ownership changes

```bash
cd examples/real_world/ip_tracker
node index.js
```

#### Compliance Checker
Validate domains against compliance rules

```bash
cd examples/real_world/compliance_checker
node index.js
```

#### Scheduled Reporting
Generate periodic domain reports

```bash
cd examples/real_world/scheduled_reporting
node index.js
```

## Example Categories

### By Complexity

**Beginner**
- basic/domain_lookup.js
- basic/ip_lookup.js
- basic/asn_lookup.js

**Intermediate**
- advanced/batch_processor.js
- advanced/custom_cache.js
- typescript/typed_client.ts

**Advanced**
- advanced/rate_limiter.js
- advanced/geo_distributed_cache.js
- real_world/compliance_checker

### By Use Case

**Domain Management**
- basic/domain_lookup.js
- real_world/domain_monitor
- real_world/compliance_checker

**Network Analysis**
- basic/ip_lookup.js
- basic/asn_lookup.js
- real_world/ip_tracker

**Enterprise Integration**
- frameworks/express_app
- frameworks/nextjs_app
- real_world/scheduled_reporting

**Performance Optimization**
- advanced/batch_processor.js
- advanced/rate_limiter.js
- advanced/geo_distributed_cache.js

## Common Patterns

### Basic Query
```javascript
const { RDAPClient } = require('rdapify');

const client = new RDAPClient({
  cache: true,
  privacy: { redactPII: true },
});

const result = await client.domain('example.com');
```

### Batch Processing
```javascript
const domains = ['example.com', 'google.com', 'github.com'];
const results = await Promise.allSettled(
  domains.map(domain => client.domain(domain))
);
```

### Error Handling
```javascript
try {
  const result = await client.domain('example.com');
} catch (error) {
  if (error.code === 'VALIDATION_ERROR') {
    // Handle validation error
  } else if (error.code === 'NETWORK_ERROR') {
    // Handle network error
  }
}
```

### Custom Cache
```javascript
class CustomCache {
  async get(key) { /* implementation */ }
  async set(key, value, ttl) { /* implementation */ }
  async delete(key) { /* implementation */ }
}

const client = new RDAPClient({
  cache: new CustomCache(),
});
```

## Requirements

### Node.js
All examples require Node.js 16 or higher.

### Dependencies
Each example directory has its own `package.json` if additional dependencies are needed.

### TypeScript Examples
TypeScript examples require:
```bash
npm install -g ts-node typescript
```

## Running Examples

### Single Example
```bash
node examples/basic/domain_lookup.js
```

### With npm
```bash
cd examples/frameworks/express_app
npm install
npm start
```

### TypeScript
```bash
npx ts-node examples/typescript/typed_client.ts
```

## Contributing Examples

When adding new examples:

1. Follow existing code style
2. Include comprehensive comments
3. Add README.md in the example directory
4. Test the example before committing
5. Update this main README

## Support

- **Documentation**: See `/docs` directory
- **Issues**: https://github.com/rdapify/rdapify/issues
- **Discussions**: https://github.com/rdapify/rdapify/discussions

## License

All examples are MIT licensed, same as the main project.
