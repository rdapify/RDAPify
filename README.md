# rdapify

A fast, secure, production-ready [RDAP](https://rdap.org) client library for Rust.

RDAP (Registration Data Access Protocol) is the modern replacement for WHOIS, defined in [RFC 9083](https://www.rfc-editor.org/rfc/rfc9083) and [RFC 9224](https://www.rfc-editor.org/rfc/rfc9224).

[![Crates.io](https://img.shields.io/crates/v/rdapify)](https://crates.io/crates/rdapify)
[![docs.rs](https://img.shields.io/docsrs/rdapify)](https://docs.rs/rdapify)
[![CI](https://github.com/rdapify/rdapify-rs/actions/workflows/ci.yml/badge.svg)](https://github.com/rdapify/rdapify-rs/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **rdapify ecosystem**
> | Library | Language | Package |
> |---------|----------|---------|
> | [rdapify-rs](https://github.com/rdapify/rdapify-rs) ← **you are here** | Rust | [`rdapify`](https://crates.io/crates/rdapify) on crates.io |
> | [RDAPify](https://github.com/rdapify/RDAPify) | TypeScript / Node.js | [`rdapify`](https://www.npmjs.com/package/rdapify) on npm |
> | [rdapify-nd](https://www.npmjs.com/package/rdapify-nd) | Node.js (Rust native) | [`rdapify-nd`](https://www.npmjs.com/package/rdapify-nd) on npm |
> | [rdapify-py](https://pypi.org/project/rdapify-py/) | Python (Rust native) | [`rdapify-py`](https://pypi.org/project/rdapify-py/) on PyPI |

## Features

- **5 query types** — domain, IP, ASN, nameserver, entity
- **IANA Bootstrap** (RFC 9224) — automatic server discovery, no manual configuration needed
- **SSRF protection** — blocks requests to private, loopback, and link-local addresses
- **In-memory cache** — configurable TTL and capacity, lock-free via `DashMap`
- **IDN support** — accepts Unicode domain names, normalises to Punycode automatically
- **Retry with back-off** — exponential back-off on network errors and 5xx/429 responses
- **Zero OpenSSL** — uses `rustls` (pure Rust TLS)
- **Async-first** — built on `tokio`

## Installation

```toml
[dependencies]
rdapify = "0.2"
```

## Quick Start

```rust
use rdapify::RdapClient;

#[tokio::main]
async fn main() -> rdapify::Result<()> {
    let client = RdapClient::new();

    // Query a domain
    let domain = client.domain("example.com").await?;
    println!("Registrar: {:?}", domain.registrar);
    println!("Expires:   {:?}", domain.expiration_date());

    // Query an IP address
    let ip = client.ip("8.8.8.8").await?;
    println!("Network: {:?}", ip.name);
    println!("Country: {:?}", ip.country);

    // Query an ASN
    let asn = client.asn("AS15169").await?;
    println!("ASN name: {:?}", asn.name);

    Ok(())
}
```

## Usage

### Domain Query

```rust
let res = client.domain("rust-lang.org").await?;

println!("{}", res.ldh_name.as_deref().unwrap_or("-"));
println!("{:?}", res.status);
println!("{:?}", res.expiration_date());

if let Some(r) = &res.registrar {
    println!("Registrar: {}", r.name.as_deref().unwrap_or("-"));
}
```

### IP Address Query

```rust
// IPv4
let res = client.ip("1.1.1.1").await?;

// IPv6
let res = client.ip("2606:4700::1111").await?;

println!("CIDR:    {:?}", res.cidr);
println!("Country: {:?}", res.country);
```

### ASN Query

```rust
// Both formats accepted
let res = client.asn("15169").await?;
let res = client.asn("AS15169").await?;

println!("Name: {:?}", res.name);
```

### Nameserver Query

```rust
let res = client.nameserver("ns1.example.com").await?;
println!("IPs: {:?}", res.ip_addresses);
```

### Entity Query

```rust
let res = client.entity("ARIN-CHA-1", "https://rdap.arin.net/registry").await?;
println!("Name:  {:?}", res.name);
println!("Roles: {:?}", res.roles);
```

## Configuration

```rust
use rdapify::{RdapClient, ClientConfig, FetcherConfig, SsrfConfig};
use std::time::Duration;

let client = RdapClient::with_config(ClientConfig {
    cache: true,
    fetcher: FetcherConfig {
        timeout: Duration::from_secs(10),
        max_attempts: 3,
        ..Default::default()
    },
    ssrf: SsrfConfig {
        enabled: true,
        ..Default::default()
    },
    ..Default::default()
})?;
```

## CLI

Enable the `cli` feature to build the `rdapify` binary:

```toml
rdapify = { version = "0.2", features = ["cli"] }
```

Or install it directly:

```bash
cargo install rdapify --features cli
```

```bash
rdapify domain example.com
rdapify ip 8.8.8.8
rdapify asn AS15169
rdapify nameserver ns1.example.com
rdapify entity ARIN-CHA-1 https://rdap.arin.net/registry

# Machine-readable JSON output
rdapify domain example.com --raw
```

## Performance

All figures are measured with `cargo bench` (Criterion) on a Linux x86-64 machine.
The query benchmarks use a local mock HTTP server (mockito) so results reflect
pure Rust overhead — no real network latency is included.

### Cache

| Benchmark | Time |
|-----------|------|
| Cache hit (DashMap read, fresh TTL) | **~124 ns** |
| Cache miss (key absent) | **~24 ns** |
| Cache insert (single write) | **~780 ns** |
| Cache eviction (insert at max capacity) | **~8.8 µs** |
| Bulk insert — 100 entries | **~35 µs** |
| Bulk insert — 1 000 entries | **~444 µs** |

### Query pipeline (mock HTTP server)

| Benchmark | Time | Notes |
|-----------|------|-------|
| `domain()` — no cache | **~183 µs** | bootstrap lookup + HTTP fetch + normalise |
| `domain()` — cache hit | **~2.3 µs** | **~80× faster** than uncached |
| `ip()` — no cache | **~176 µs** | |
| `asn()` — no cache | **~176 µs** | |

> Cache brings query latency from **~180 µs → ~2 µs** — an 80× speedup for
> repeated queries within the TTL window.

### SSRF validation

| Benchmark | Time |
|-----------|------|
| Public domain URL (allowed) | **~141 ns** |
| Public IPv4 URL (allowed) | **~220 ns** |
| Private IPv4 URL (blocked at RFC-1918) | **~295 ns** |
| Non-HTTPS scheme (blocked immediately) | **~145 ns** |
| SSRF disabled (boolean bypass) | **~3 ns** |

Run the benchmarks yourself:

```bash
cargo bench
# HTML reports → target/criterion/report/index.html
```

## Language Bindings

### Node.js — `rdapify-nd`

A prebuilt native binding for Node.js. No compiler required — binaries ship for
Linux x64, macOS x64/arm64, and Windows x64.

```bash
npm install rdapify-nd
```

```js
const { domain, ip, asn, nameserver, entity } = require('rdapify-nd');

// Domain
const d = await domain('example.com');
console.log(d.registrar?.name);    // "Example Registrar, Inc."
console.log(d.ldhName);            // "example.com"
console.log(d.metadata.timestamp); // "2026-03-21T00:00:00Z"

// IP address
const i = await ip('8.8.8.8');
console.log(i.name);    // "GOOGLE"
console.log(i.country); // "US"

// ASN
const a = await asn('AS15169');
console.log(a.name); // "GOOGLE"

// Nameserver
const ns = await nameserver('ns1.google.com');
console.log(ns.ipAddresses.v4); // ["216.239.32.10"]

// Entity (requires explicit server URL — no global bootstrap for entities)
const e = await entity('ARIN-HN-1', 'https://rdap.arin.net/registry');
console.log(e.handle); // "ARIN-HN-1"
```

**Use with the TypeScript `rdapify` library** for automatic native acceleration:

```bash
npm install rdapify rdapify-nd
```

```ts
import { RDAPClient } from 'rdapify';

// backend: 'auto' (default) uses rdapify-nd if installed, falls back to TypeScript
const client = new RDAPClient({ backend: 'auto' });

// Or require it — throws at startup if rdapify-nd is not installed
const client2 = new RDAPClient({ backend: 'native' });

const result = await client.domain('example.com');
console.log(result.metadata.source); // RDAP server URL that served the response
```

---

### Python — `rdapify-py`

A prebuilt native extension for Python 3.8+. Ships as `abi3` wheels for
Linux x64, macOS x64/arm64, and Windows x64.

```bash
pip install rdapify-py
```

```python
import rdapify_py as rdap

# Domain
d = rdap.domain("example.com")
print(d["registrar"]["name"])         # "Example Registrar, Inc."
print(d["ldhName"])                   # "example.com"
print(d["meta"]["queried_at"])        # RFC 3339 timestamp

# IP address
i = rdap.ip("8.8.8.8")
print(i["name"])     # "GOOGLE"
print(i["country"])  # "US"

# ASN
a = rdap.asn("AS15169")
print(a["name"])  # "GOOGLE"

# Nameserver
ns = rdap.nameserver("ns1.google.com")
print(ns["ipAddresses"]["v4"])  # ["216.239.32.10"]

# Entity (requires explicit server URL)
e = rdap.entity("ARIN-HN-1", "https://rdap.arin.net/registry")
print(e["handle"])  # "ARIN-HN-1"
```

All five functions are **synchronous** and backed by a `tokio` runtime under the hood.

## MSRV

Minimum supported Rust version: **1.75**

## License

MIT — see [LICENSE](LICENSE)
