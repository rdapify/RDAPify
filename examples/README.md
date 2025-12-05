# Examples

This directory contains practical code examples demonstrating RDAPify usage across different scenarios and frameworks.

## Directory Structure

- **basic/** - Simple domain, IP, and ASN lookup examples
- **typescript/** - TypeScript-specific implementations with type safety
- **frameworks/** - Integration examples (Express, Next.js, NestJS, etc.)
- **advanced/** - Custom cache, rate limiting, batch processing
- **real_world/** - Complete application examples
- **real_rdap/** - Real RDAP protocol examples

## Getting Started

Each subdirectory contains its own README with specific instructions. Start with the `basic/` examples if you're new to RDAPify.

## Running Examples

```bash
# Install dependencies
npm install

# Run a specific example
node examples/basic/domain-lookup.js

# TypeScript examples
npx ts-node examples/typescript/domain-lookup.ts
```

## Contributing Examples

When adding new examples:
1. Place in appropriate subdirectory
2. Include inline comments
3. Add error handling
4. Update subdirectory README
5. Test before submitting
