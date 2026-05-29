# RDAPify Platform Architecture

## Platform Overview

RDAPify is a **Rust-first RDAP platform** built on an **Open Core model**. All business logic lives in Rust. Language bindings are thin wrappers. RDAPify-Pro is a plugin layer. RDAPify-Internal handles licensing and billing — never RDAP logic.

### Platform Layers

```
RDAPify (Rust Core Engine — MIT)
        ↓
CLI (rdapify-cli)
        ↓
RDAPify-Pro (Monitoring · Alerts · History · Webhooks · Analytics — Commercial)
        ↓
RDAPify-Cloud (Future SaaS)
        ↓
Language Bindings (Node.js · Python · Go · PHP)
```

**Rules:**
- All business logic lives in Rust (rdapify-rust workspace).
- Language bindings are thin FFI/NAPI/PyO3 wrappers — no business logic.
- RDAPify-Pro extends RDAPify via a plugin interface — never forks or bundles it.
- RDAPify-Internal (billing/licensing) is a separate operational layer, not part of the engine.
- Dependency direction: Shared ← Core ← Application ← Infrastructure (no reverse).

---

## GitHub Organization Structure

```
github.com/rdapify/
│
├── RDAPify            (Public  — Rust Engine, CLI — MIT License)
├── RDAPify-Pro        (Private — Commercial plugin layer)
├── RDAPify-Internal   (Private — License server, Billing, Admin)
├── rdapify-TS         (Archived — Legacy TypeScript SDK)
├── rdapify.github.io  (Public  — Website and Documentation)
└── .github            (Public  — Org profile)
```

### Repository Responsibilities

| Repository | Responsibility | License |
|---|---|---|
| RDAPify | Rust engine (11 crates), CLI, Node.js + Python bindings | MIT |
| RDAPify-Pro | Monitoring, alerts, domain history, webhooks, portfolio analytics | Commercial |
| RDAPify-Internal | License validation server, Paddle billing integration, admin dashboard | Proprietary |
| rdapify-TS | Archived — read-only, no new features | MIT |
| rdapify.github.io | Public website, API docs, guides | MIT |

---

## Crate Architecture

RDAPify is a modular, async-first RDAP client built on Tokio and Rust Edition 2021. The architecture emphasizes separation of concerns through an 11-crate workspace, with each crate responsible for a distinct problem domain.

## Crate Dependency Graph

```
rdapify (facade)
    ├── rdap-client (high-level API)
    │   ├── rdap-core (HTTP + normalization)
    │   ├── rdap-bootstrap (server discovery)
    │   ├── rdap-cache (query response cache)
    │   ├── rdap-security (SSRF guard)
    │   ├── rdap-stream (streaming events)
    │   └── rdap-batch (bulk operations)
    └── rdap-rate-limit (skeleton for future)

    rdap-types (foundational types — used by all)
    rdap-core uses: rdap-types + rdap-security
    rdap-bootstrap uses: rdap-types
    rdap-cache uses: rdap-types
    rdap-security uses: rdap-types
    rdap-stream uses: rdap-types + rdap-client
    rdap-batch uses: rdap-types + rdap-client
```

Dependency direction is strictly bottom-up: shared types at the base, application layer at the top, no cycles.

## Crate Responsibilities

### `rdap-types`
Foundational data types implementing RFC 9083 (RDAP protocol specification):
- Response types: `DomainResponse`, `IpResponse`, `AsnResponse`, `NameserverResponse`, `EntityResponse`
- Common types: `RdapEntity`, `RdapLink`, `RdapStatus`, `RdapEvent`, `ResponseMeta`, `RdapRole`
- Error type: `RdapError` (unified error type used across all crates)
- Serde-compatible: all types derive `Serialize` and `Deserialize`

### `rdap-security`
SSRF (Server-Side Request Forgery) protection:
- Validates all outbound URLs before HTTP requests
- Blocks non-HTTPS schemes
- Blocks IPv4 private ranges (RFC 1918), loopback (127/8), link-local (169.254/16)
- Blocks IPv6 loopback (::1), link-local (fe80::/10), unique-local (fc00::/7)
- Supports domain allowlist/blocklist for flexibility
- Configuration: `SsrfConfig`; guard: `SsrfGuard`
- No unsafe code

### `rdap-bootstrap`
IANA RFC 9224 bootstrap server discovery:
- Fetches and caches authoritative RDAP server assignments for TLDs, IP ranges, and ASN ranges
- Methods: `for_domain()`, `for_ipv4()`, `for_ipv6()`, `for_asn()`
- Supports custom RDAP server overrides (e.g., for private registries)
- Default endpoint: https://data.iana.org/rdap/

### `rdap-cache`
Lock-free in-memory cache using DashMap:
- Caches RDAP query responses by URL
- Configurable TTL and capacity
- Used to avoid redundant RDAP server queries
- Optional: can be disabled in `ClientConfig`

### `rdap-core`
HTTP layer and response normalization:
- `Fetcher`: HTTP client wrapper with configurable timeout, retries, and User-Agent
- Retry logic: exponential back-off with configurable thresholds
- `Normalizer`: converts raw RDAP JSON responses into typed structs
- Handles HTTP error codes, timeouts, and malformed responses
- Uses `reqwest` with `rustls` (no OpenSSL dependency)

### `rdap-client`
High-level query API:
- `RdapClient`: main entry point
- Five query methods: `domain()`, `ip()`, `asn()`, `nameserver()`, `entity()`
- Configuration: `ClientConfig` (fetcher, SSRF, cache, bootstrap, connection pooling)
- Cheap to clone: all state is behind `Arc` pointers
- Orchestrates: bootstrap discovery → SSRF validation → HTTP fetch → response normalization
- Additional methods: `domain_available()`, `domain_available_batch()` for availability checking

### `rdap-stream`
Streaming API for bulk queries:
- Event enums: `DomainEvent`, `IpEvent`, `AsnEvent`, `NameserverEvent`
- Each event is either `Result(Box<Response>)` or `Error { query, error }`
- Configuration: `StreamConfig` (buffer size)
- Uses Tokio MPSC for non-blocking query dispatch
- Methods: `stream_domain()`, `stream_ip()`, `stream_asn()`, `stream_nameserver()`

### `rdap-batch`
Bulk domain operations:
- Helper for concurrent domain availability checks
- Used by `domain_available_batch()`
- Configurable concurrency limit (default: 10)
- Results maintain query order

### `rdap-rate-limit`
Placeholder for future rate-limiting enhancements:
- Currently a skeleton crate
- Will implement token-bucket or sliding-window rate limiting
- Will be integrated into `Fetcher`

### `rdapify` (facade)
Backward-compatible re-export layer:
- Re-exports public types and APIs from all sub-crates
- Ensures old code importing from `rdapify` directly continues to work
- Simplifies dependency management for consumers

## Async Model

- **Runtime**: Tokio multi-threaded executor
- **Concurrency**: Domain batch queries use `tokio::task::JoinSet` for structured concurrency
- **Streams**: `tokio-stream` wrappers provide async iterator semantics
- **No blocking**: All I/O is non-blocking; no thread pooling for network calls

## TLS and HTTP

- **TLS**: `rustls` only (pure Rust, no system OpenSSL dependency)
- **HTTP**: `reqwest` 0.12 with `rustls-tls` feature
- **Connection pooling**: Configurable per-host limits (default: 10 connections)
- **Compression**: gzip enabled by default

## Binding Architecture

RDAPify is designed for language bindings without bundling the core library:

### Node.js Binding (`rdapify-nd`)
- Uses `napi-rs` to expose Rust types as JavaScript objects
- Located in `bindings/nodejs/`
- Publishes to npm as `rdapify-nd`
- Async APIs map to JavaScript Promises

### Python Binding (`rdapify-py`)
- Uses `PyO3` to expose Rust types as Python classes
- Located in `bindings/python/`
- Publishes to PyPI as `rdapify-py`
- Async APIs map to Python `asyncio` coroutines

Both bindings:
- Link to the `rdapify` facade crate (Cargo.toml path deps)
- Reuse all Rust business logic unchanged
- Are built separately from the main workspace
- Update independently of the core library version

## Hexagonal Boundary

The architecture follows hexagonal (ports-and-adapters) principles:

**Core** (ports):
- `RdapClient` defines the primary query port
- `Fetcher` is the HTTP adapter port
- `SsrfGuard` is the security policy adapter port

**Adapters** (specific implementations):
- `reqwest` is the HTTP adapter
- `DashMap` is the cache adapter
- `tokio` is the async runtime adapter

This design allows swapping adapters (e.g., replacing `DashMap` with Redis) without changing business logic.

## Code Quality Invariants

- **No unsafe code**: `#![forbid(unsafe_code)]` in all crates
- **Edition**: 2021 (async/await, const generics, stable)
- **MSRV**: 1.88 (checked by CI)
- **Linting**: `cargo clippy --workspace -- -D warnings` passes (or breaks CI)
- **Formatting**: `cargo fmt --check` enforced
- **Testing**: unit tests inline, integration tests in `tests/`, live tests marked `#[ignore]`

## Performance

- Benchmarks (criterion.rs) in `benches/` cover:
  - Cache hit/miss latency
  - SSRF validation overhead
  - Query end-to-end latency
  - Stream throughput
- Release profile optimizes for speed:
  - opt-level 3 (maximum optimizations)
  - LTO enabled
  - Single codegen unit
  - Binary stripped

## Backward Compatibility

The `rdapify` facade guarantees old imports continue to work across minor versions. Consumers relying on `rdapify::RdapClient` rather than `rdap_client::RdapClient` are protected from internal refactors.
