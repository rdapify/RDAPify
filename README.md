# RDAPify

**High-performance RDAP client, CLI, and service engine for production use.**

RDAP (Registration Data Access Protocol) is the modern, structured replacement for WHOIS — defined in [RFC 9083](https://www.rfc-editor.org/rfc/rfc9083) and [RFC 9224](https://www.rfc-editor.org/rfc/rfc9224).

[![Crates.io](https://img.shields.io/crates/v/rdapify)](https://crates.io/crates/rdapify)
[![docs.rs](https://img.shields.io/docsrs/rdapify)](https://docs.rs/rdapify)
[![CI](https://github.com/rdapify/RDAPify/actions/workflows/ci.yml/badge.svg)](https://github.com/rdapify/RDAPify/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![MSRV: 1.77](https://img.shields.io/badge/MSRV-1.77-orange)](https://blog.rust-lang.org/2024/03/21/Rust-1.77.0.html)

---

## What is RDAPify?

| Mode | Description |
|---|---|
| **Library** | Rust crate for embedding RDAP queries in your application |
| **CLI** | `rdapify` command for shell scripts and one-off lookups |
| **Service** | `rdapify serve` — HTTP API that exposes RDAP over REST |
| **Docker** | Container image for zero-config deployment |
| **Monitoring** | Domain expiry + change alerts via [RDAPify Pro](#open-core) |

Not a SaaS. Not a hosted API. A self-contained engine you run anywhere.

---

## Features

- **5 query types** — domain, IP address, ASN, nameserver, entity
- **Automatic bootstrap** — IANA RFC 9224 server discovery; no manual URL configuration
- **In-memory cache** — lock-free `DashMap` with configurable TTL; cache hits at ~2 µs
- **SSRF protection** — blocks private IPs, loopback, link-local, and redirect-based rebinding
- **Retry with back-off** — exponential back-off on network errors and 5xx/429 responses
- **IDN support** — accepts Unicode domain names, normalizes to Punycode automatically
- **Batch queries** — query hundreds of domains concurrently via `rdap-batch`
- **Streaming API** — receive query events as they arrive via `rdap-stream`
- **Prometheus metrics** — 9 metrics at `/metrics` in service mode
- **Zero OpenSSL** — pure Rust TLS via `rustls`
- **Async-first** — built on Tokio; no blocking I/O

---

## Quick Start

**30-second start:**

```bash
cargo install rdapify --features cli
rdapify domain github.com
```

Or with Docker:

```bash
docker run --rm ghcr.io/rdapify/rdapify domain github.com
```

See [QUICKSTART.md](QUICKSTART.md) for all options (Rust library, Node.js, Python).

---

## Installation

### CLI

```bash
cargo install rdapify --features cli
```

Pre-built binaries for Linux x86-64/ARM64, macOS Intel/Apple Silicon, Windows x64:
→ [GitHub Releases](https://github.com/rdapify/RDAPify/releases/latest)

### Rust Library

```toml
[dependencies]
rdapify = "0.3"
tokio = { version = "1", features = ["full"] }
```

### Docker

```bash
docker pull ghcr.io/rdapify/rdapify:latest
```

### Node.js

```bash
npm install rdapify-nd
```

### Python

```bash
pip install rdapify-py
```

Full details: [docs/INSTALL.md](docs/INSTALL.md)

---

## CLI Usage

```bash
# Domain registration data
rdapify domain example.com

# IP network information
rdapify ip 8.8.8.8
rdapify ip 2001:4860:4860::8888

# Autonomous System lookup
rdapify asn AS15169
rdapify asn 15169

# Nameserver
rdapify nameserver ns1.google.com

# Entity (contact / registrar)
rdapify entity ARIN-HN-1 --server https://rdap.arin.net/registry

# Output formats
rdapify domain example.com               # Pretty-printed JSON (default)
rdapify domain example.com --raw         # Compact JSON
rdapify domain example.com -o text       # Human-readable summary
rdapify domain example.com -o csv        # CSV (for batch output)

# Batch queries from file
rdapify batch --file domains.txt --concurrency 10

# Shell completions
rdapify completions bash >> ~/.bashrc
```

Exit codes: `0` success · `1` query error · `2` network error · `3` security block · `4` invalid input

Full reference: [docs/CLI.md](docs/CLI.md)

---

## Service Mode

Run RDAPify as an HTTP API that any language can query:

```bash
rdapify serve
# Listening on 0.0.0.0:7080
```

```bash
curl http://localhost:7080/v1/domain/example.com
curl http://localhost:7080/v1/ip/8.8.8.8
curl http://localhost:7080/v1/autnum/15169
curl http://localhost:7080/v1/nameserver/ns1.google.com
curl http://localhost:7080/health
curl http://localhost:7080/metrics   # Prometheus format
```

Configure via environment variables or `rdapify.toml`:

```bash
RDAPIFY_PORT=7080 \
RDAPIFY_CACHE_TTL=300 \
RDAPIFY_RATE_LIMIT_RPS=60 \
rdapify serve
```

Full guide: [docs/PRODUCTION.md](docs/PRODUCTION.md)

---

## Docker

```bash
# Service mode
docker run -d -p 7080:7080 \
  -e RDAPIFY_CACHE_TTL=300 \
  ghcr.io/rdapify/rdapify serve

# One-shot CLI
docker run --rm ghcr.io/rdapify/rdapify ip 8.8.8.8
```

Image: distroless base, < 40 MB, runs as non-root.

Full guide: [docs/DOCKER.md](docs/DOCKER.md)

---

## Rust Library Usage

```rust
use rdapify::RdapClient;

#[tokio::main]
async fn main() -> rdapify::Result<()> {
    let client = RdapClient::new()?;

    // Domain
    let domain = client.domain("example.com").await?;
    println!("Registrar: {:?}", domain.registrar);
    println!("Expires:   {:?}", domain.expiration_date());

    // IP address (IPv4 and IPv6)
    let ip = client.ip("8.8.8.8").await?;
    println!("Network: {} ({})",
        ip.name.as_deref().unwrap_or("-"),
        ip.country.as_deref().unwrap_or("-"));

    // ASN — both "15169" and "AS15169" accepted
    let asn = client.asn("AS15169").await?;
    println!("ASN: {:?}", asn.name);

    // Nameserver
    let ns = client.nameserver("ns1.google.com").await?;
    println!("IPs: {:?}", ns.ip_addresses);

    // Entity (registrar / contact)
    let entity = client.entity("ARIN-HN-1", "https://rdap.arin.net/registry").await?;
    println!("Name: {:?}", entity.name);

    Ok(())
}
```

### Custom configuration

```rust
use rdapify::{RdapClient, ClientConfig, FetcherConfig};
use rdap_security::SsrfConfig;
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

---

## Node.js

```js
const { domain, ip, asn, nameserver, entity } = require('rdapify-nd');

const d = await domain('example.com');
console.log(d.registrar?.name);

const i = await ip('8.8.8.8');
console.log(`${i.name} (${i.country})`);

const a = await asn('AS15169');
console.log(a.name);
```

---

## Python

```python
import rdapify_py as rdap

d = rdap.domain("example.com")
print(d["registrar"]["name"])

i = rdap.ip("8.8.8.8")
print(f"{i['name']} ({i['country']})")

a = rdap.asn("AS15169")
print(a["name"])
```

---

## Performance

Benchmarks run with Criterion on Linux x86-64 using a local mock server (no network latency included).

### Query pipeline

| Benchmark | Latency | Notes |
|---|---|---|
| Domain query — **cache hit** | **~2.3 µs** | ~80× faster than uncached |
| Domain query — no cache | ~183 µs | Bootstrap lookup + HTTP + normalize |
| IP query — no cache | ~176 µs | |
| ASN query — no cache | ~176 µs | |
| Batch 100 domains (c=10) | ~2.1 s | Real network; concurrency = 10 |
| Batch 1 000 domains (c=50) | ~18 s | Real network; concurrency = 50 |
| Cold start (bootstrap fetch) | < 10 ms | First query after process start |

### Cache

| Benchmark | Latency |
|---|---|
| Cache hit (DashMap read) | **~124 ns** |
| Cache miss | ~24 ns |
| Cache insert | ~780 ns |
| Cache eviction (LRU) | ~8.8 µs |
| Bulk insert 1 000 entries | ~444 µs |

### SSRF validation

| Benchmark | Latency |
|---|---|
| Public HTTPS URL (allowed) | ~141 ns |
| Private IPv4 URL (blocked) | ~295 ns |
| Non-HTTPS scheme (blocked) | ~145 ns |

```bash
cargo bench
# HTML report → target/criterion/report/index.html
```

---

## Security

RDAPify includes a multi-layer security model for safe use in server-side applications where user input may control query targets.

| Layer | What it prevents |
|---|---|
| URL validation | Non-HTTPS schemes, credentials in URLs |
| DNS resolution | SSRF via hostname → private IP |
| IP classification | Loopback, RFC-1918 private, link-local |
| Redirect guard | SSRF via redirect chain |
| DNS rebinding | TOCTOU: IP change between resolve and connect |
| Response size limit | Memory exhaustion (default: 10 MB) |
| Content-type check | Non-RDAP responses masquerading as RDAP |

SSRF protection is enabled by default. It cannot be bypassed by a user-supplied URL.

Full details: [docs/SECURITY.md](docs/SECURITY.md)

---

## Open Core

| Feature | Open (Apache-2.0) | Pro (Commercial) |
|---|:---:|:---:|
| Domain, IP, ASN, NS, Entity queries | ✔ | ✔ |
| Batch queries | ✔ | ✔ |
| CLI | ✔ | ✔ |
| HTTP service | ✔ | ✔ |
| Docker | ✔ | ✔ |
| Node.js / Python bindings | ✔ | ✔ |
| SSRF protection | ✔ | ✔ |
| Prometheus metrics | ✔ | ✔ |
| Domain expiry monitoring | — | ✔ |
| Change detection + alerts | — | ✔ |
| Webhooks | — | ✔ |
| Portfolio management | — | ✔ |
| Analytics dashboard | — | ✔ |
| Priority support | — | ✔ |

The open core (this repo) is **Apache-2.0 licensed** and will never have usage limits, license checks, or paywalled features.

RDAPify Pro → [rdapify.com](https://rdapify.com)

---

## Ecosystem

| Package | Language | Registry |
|---|---|---|
| [RDAPify](https://github.com/rdapify/RDAPify) ← **this repo** | Rust | [crates.io `rdapify`](https://crates.io/crates/rdapify) |
| [rdapify-nd](https://www.npmjs.com/package/rdapify-nd) | Node.js | [npm `rdapify-nd`](https://www.npmjs.com/package/rdapify-nd) |
| [rdapify-py](https://pypi.org/project/rdapify-py/) | Python | [PyPI `rdapify-py`](https://pypi.org/project/rdapify-py/) |
| [@rdapify/pro](https://rdapify.com) | Node.js addon | npm `@rdapify/pro` (private) |

---

## Documentation

| Guide | |
|---|---|
| [QUICKSTART.md](QUICKSTART.md) | Get running in 5 minutes |
| [docs/INSTALL.md](docs/INSTALL.md) | All installation methods |
| [docs/CLI.md](docs/CLI.md) | Full CLI reference |
| [docs/CONFIG.md](docs/CONFIG.md) | Configuration file + env vars |
| [docs/DOCKER.md](docs/DOCKER.md) | Docker and Docker Compose |
| [docs/PRODUCTION.md](docs/PRODUCTION.md) | systemd, nginx, Kubernetes |
| [docs/MONITORING.md](docs/MONITORING.md) | Prometheus metrics + Grafana |
| [docs/SECURITY.md](docs/SECURITY.md) | SSRF protection + security model |
| [docs/COMPARISON.md](docs/COMPARISON.md) | vs whois, python-rdap, ipwhois, curl |
| [docs/RUST_API.md](docs/RUST_API.md) | Full Rust API reference |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Crate structure and design |
| [CHANGELOG.md](CHANGELOG.md) | Release history |

---

## Compatibility

| Package version | MSRV | rdapify-nd | rdapify-py |
|---|---|---|---|
| 0.3.x | 1.77 | 0.1.3 | 0.2.1 |
| 0.2.x | 1.75 | 0.1.x | 0.2.x |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). All changes require:

```bash
cargo test --workspace
cargo clippy --workspace -- -D warnings
cargo fmt --check
```

---

## License

RDAPify is licensed under the **Apache License 2.0** — see [LICENSE](LICENSE).

Free to use, modify, and redistribute for any purpose.

RDAPify Pro is commercial software. See [rdapify.com](https://rdapify.com) for pricing.
