# RDAPify — Installation

All installation methods for the CLI, library, and service.

---

## CLI Binary

### From crates.io (recommended)

```bash
cargo install rdapify --features cli
```

Installs `rdapify` to `~/.cargo/bin/`. Requires Rust 1.77+.

### Pre-built binaries

Download from [GitHub Releases](https://github.com/rdapify/RDAPify/releases/latest):

| Platform | File |
|---|---|
| Linux x86-64 | `rdapify-x86_64-unknown-linux-musl.tar.gz` |
| Linux ARM64 | `rdapify-aarch64-unknown-linux-musl.tar.gz` |
| macOS Intel | `rdapify-x86_64-apple-darwin.tar.gz` |
| macOS Apple Silicon | `rdapify-aarch64-apple-darwin.tar.gz` |
| Windows x64 | `rdapify-x86_64-pc-windows-msvc.zip` |

Extract and put the binary somewhere on your `PATH`:

```bash
# Linux/macOS
tar xzf rdapify-x86_64-unknown-linux-musl.tar.gz
sudo mv rdapify /usr/local/bin/

# Verify
rdapify --version
```

### Docker

```bash
# Single query
docker run --rm ghcr.io/rdapify/rdapify domain github.com

# Run as a service
docker run -d -p 7080:7080 --name rdapify ghcr.io/rdapify/rdapify serve
```

See [docs/DOCKER.md](DOCKER.md) for full Docker documentation.

---

## Rust Library

Add to `Cargo.toml`:

```toml
[dependencies]
rdapify = "0.4"
tokio = { version = "1", features = ["full"] }
```

### Feature flags

| Feature | Default | Description |
|---|---|---|
| `default` | yes | Core client + cache + security |
| `cli` | no | Builds the `rdapify` CLI binary |
| `service` | no | Builds the `rdapify-service` HTTP server |
| `sqlite` | no | SQLite persistence backend |
| `postgres` | no | PostgreSQL persistence backend |
| `mysql` | no | MySQL persistence backend |

```toml
# All features
rdapify = { version = "0.4", features = ["service", "sqlite"] }

# Minimal (no persistence)
rdapify = { version = "0.4", default-features = true }
```

---

## Node.js Binding

```bash
npm install rdapify-nd
```

No compiler required. Pre-built native binaries ship for:
- Linux x64 (glibc ≥ 2.17)
- Linux ARM64 (glibc ≥ 2.17)
- macOS x64 (10.13+)
- macOS ARM64 (11.0+)
- Windows x64

Requires Node.js 18+.

```js
const { domain, ip, asn, nameserver, entity } = require('rdapify-nd');
```

---

## Python Binding

```bash
pip install rdapify-py
```

Pre-built `abi3` wheels for Python 3.8+ on:
- Linux x64 (manylinux2014)
- Linux ARM64 (manylinux2014)
- macOS x64 (10.13+)
- macOS ARM64 (11.0+)
- Windows x64

```python
import rdapify_py as rdap
```

---

## Build from Source

```bash
git clone https://github.com/rdapify/RDAPify.git
cd RDAPify

# Build all crates
cargo build --release

# Build CLI binary
cargo build --release --bin rdapify

# Build service binary
cargo build --release --bin rdapify-service

# Run tests
cargo test --workspace
```

MSRV: **Rust 1.77**. Uses `rustls` (no OpenSSL dependency).

---

## Verify Installation

```bash
rdapify --version
# rdapify 0.3.x

rdapify domain example.com --raw | jq '.objectClassName'
# "domain"
```
