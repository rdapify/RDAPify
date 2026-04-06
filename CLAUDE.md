# rdapify-rust — Execution Contract

## Architecture

**11-crate Rust workspace** (Phase 0 refactor — pure Rust, no napi-rs monolith).

```
rdapify/
├── crates/
│   ├── rdap-types/        → RDAP response types (domain, IP, ASN, nameserver)
│   ├── rdap-security/     → SSRF validation
│   ├── rdap-bootstrap/    → IANA RFC 9224 bootstrap discovery
│   ├── rdap-cache/        → In-memory cache (DashMap)
│   ├── rdap-core/         → HTTP fetcher + response normalizer
│   ├── rdap-stream/       → Async query stream events
│   ├── rdap-client/       → Main RdapClient (5 query types)
│   ├── rdap-rate-limit/   → Rate limiting (phase 0 skeleton)
│   ├── rdap-batch/        → Batch domain operations
│   ├── rdap-cli/          → Command-line binary
│   └── rdapify/           → Facade crate (backward-compatible re-exports)
├── Cargo.toml             → Workspace manifest
└── benches/               → Performance benchmarks
```

**Bindings** (external to this repo):
- `rdapify-nd` (npm) — Node.js bindings (separate build, uses workspace)
- `rdapify-py` (PyPI) — Python bindings (separate build, uses workspace)

Async: Tokio multi-thread · TLS: rustls only (no OpenSSL)

## Commands

| Command | Purpose |
|---------|---------|
| `cargo test --workspace` | Run all unit + integration tests |
| `cargo build --release` | Release build (all crates) |
| `cargo clippy --workspace -- -D warnings` | Lint all crates |
| `cargo fmt --check` | Check code formatting |
| `cargo test -- --ignored` | Run live tests (requires network) |
| `cargo bench` | Benchmarks (criterion) |
| `cargo doc --open --workspace` | Generate & view documentation |

## Invariants

- `#![forbid(unsafe_code)]` — no unsafe Rust ever
- Edition 2021 · MSRV 1.77 · no OpenSSL (rustls only)
- All workspace crates use shared `[workspace.dependencies]`
- Path deps: none (all deps pinned in workspace)
- Tests: unit inline in modules · integration in `tests/` · live marked `#[ignore]`
- `cargo clippy --workspace -- -D warnings` must pass before any commit
- CI: multi-platform (Ubuntu, macOS, Windows) + MSRV job — do not break
- **Apache-2.0** — never add paid features to this repo
- **Do not remove backward compatibility** — `rdapify` facade must always compile with old imports
- Coordinate with `rdapify-pro/` if changing public API (path deps on rdap-types, rdap-client)
