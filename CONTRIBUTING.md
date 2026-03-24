# Contributing to rdapify-rust

Thank you for your interest in contributing!

## Repository Structure

- **Core crate** (`src/`): Rust RDAP client implementation
- **Node.js binding** (`bindings/nodejs/`): napi-rs, published as `rdapify-nd`
- **Python binding** (`bindings/python/`): PyO3 + maturin, published as `rdapify-py`
- **Go binding** (`bindings/go/`): CGo wrapper (experimental)
- **Benchmarks** (`benches/`): Criterion benchmarks (cache, SSRF, query, streaming)

## Development Setup

```bash
# Rust toolchain (MSRV 1.75)
rustup update stable
cargo build

# Run tests
cargo test

# Lint
cargo clippy -- -D warnings
cargo fmt -- --check

# Run benchmarks
cargo bench
```

### Node.js binding

```bash
cd bindings/nodejs
npm install
npm run build   # napi build --platform --release
npm test
```

### Python binding

```bash
cd bindings/python
pip install maturin
maturin develop
python -m pytest tests/
```

## Commit Message Format

```
type: short description

Types: feat, fix, docs, refactor, test, chore, ci
Examples:
  feat: add stream_asn() for ASN streaming queries
  fix: handle timeout in DNS resolution
  docs: update Python binding README
```

## Version Policy

| Component  | Versioning          | Notes                           |
|------------|---------------------|---------------------------------|
| Core crate | Semantic versioning | Independent                     |
| rdapify-nd | Tracks core         | May lag by a minor version      |
| rdapify-py | Tracks core         | Aims for parity                 |

## Pull Request Process

1. Fork and create a feature branch
2. `cargo test` must pass
3. `cargo clippy -- -D warnings` must be clean
4. `cargo fmt` applied
5. Update `CHANGELOG.md` under `[Unreleased]`
6. Open PR with a clear description of changes

## Reporting Security Issues

See [SECURITY.md](./SECURITY.md). Do **not** open public issues for vulnerabilities.

## Code Style

- `#![forbid(unsafe_code)]` is enforced — no unsafe Rust
- TLS via `rustls` only (no OpenSSL)
- Async via Tokio multi-thread runtime
- All public types must derive `Debug` and implement `Display` where appropriate
