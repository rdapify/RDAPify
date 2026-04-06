# Installation

## Version

> **Current stable:** `0.4.0` — [Release Notes](../releases/v0.4.0.md)

## System requirements

| Runtime | Minimum version | Notes |
|---------|-----------------|-------|
| Node.js | 20.x | Recommended. Required for the CLI binary. |
| Bun | 1.0 | Supported via the standard npm package. |
| Deno | 1.30 | Use with `npm:` specifier (`import { RDAPClient } from 'npm:rdapify'`). |
| Cloudflare Workers | current | In-memory cache and metrics are supported; file-based cache is not. |

TypeScript 5.0+ is required for development. The distributed package includes full `.d.ts` type definitions — no separate `@types/rdapify` is needed.

## Install

```bash
# npm
npm install rdapify

# yarn
yarn add rdapify

# pnpm
pnpm add rdapify

# Bun
bun add rdapify
```

## Rust

For native Rust projects:

```bash
cargo add rdapify
# or specify version:
cargo add rdapify@0.4.0
```

See the [Rust documentation](https://crates.io/crates/rdapify) on crates.io.

## Optional: Rust native backend (Node.js)

For high-throughput scenarios on Node.js, install `rdapify-nd` alongside `rdapify`. When present, the five core query methods (`domain`, `ip`, `asn`, `nameserver`, `entity`) are executed by a compiled Rust binary rather than the TypeScript pipeline.

```bash
npm install rdapify rdapify-nd
```

`rdapify-nd` is a prebuilt native Node.js addon (`.node` file). Platform-specific binaries are published for Linux x64, macOS x64, macOS arm64, and Windows x64.

## Verify the installation

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();
const result = await client.domain('example.com');

console.log(result.query);           // "example.com"
console.log(result.registrar?.name); // registrar name
console.log(result.nameservers);     // delegated nameservers
```

Run with:
```bash
node --input-type=module < verify.ts
# or, after compiling with tsc:
node dist/verify.js
```

## TypeScript configuration

The package targets ES2020 with CommonJS output. A minimal `tsconfig.json` for a consumer project:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true
  }
}
```

If you are on Node.js 20+ and want native ESM, set `"module": "Node16"` and `"moduleResolution": "Node16"`.

## CLI

The `rdapify` CLI is included in the package and requires no separate install:

```bash
npx rdapify domain example.com
npx rdapify ip 8.8.8.8
npx rdapify asn AS15169
npx rdapify nameserver ns1.example.com
npx rdapify entity ARIN-HN-1 --server https://rdap.arin.net/registry
```

To install the CLI globally:

```bash
npm install -g rdapify
rdapify domain example.com --json
```

## Troubleshooting

**`MODULE_NOT_FOUND` for `rdapify-nd`**

`rdapify-nd` is optional. If it is not installed, `RDAPClient` falls back to the TypeScript backend automatically (when `backend` option is `'auto'`, which is the default). Only `backend: 'native'` throws if the module is absent.

**TypeScript: `Cannot find module 'rdapify'`**

Ensure `moduleResolution` is set to `"node"` or `"node16"` in your `tsconfig.json`. The package exports are defined in `package.json#exports` and require a resolver that supports the `exports` field.

**Timeouts in restricted network environments**

Configure a custom bootstrap URL and timeout:

```typescript
const client = new RDAPClient({
  bootstrapUrl: 'https://data.iana.org/rdap',
  timeout: { request: 15000, connect: 5000 },
});
```

If outbound HTTPS to IANA is blocked, mirror the bootstrap files locally and point `bootstrapUrl` at your mirror.

---

Next: [Quick start](./quick-start.md)
