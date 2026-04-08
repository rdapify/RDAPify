# RDAPify — Quick Start

Get your first RDAP query running in under 5 minutes.

---

## Option A: CLI (fastest)

```bash
cargo install rdapify --features cli
rdapify domain github.com
```

That's it. You'll see the full RDAP registration record for `github.com`.

### Try more queries

```bash
# IP address lookup
rdapify ip 8.8.8.8

# Autonomous System lookup
rdapify asn AS15169

# Nameserver
rdapify nameserver ns1.google.com

# Machine-readable JSON
rdapify domain example.com --raw | jq '.registrar.name'
```

---

## Option B: Docker

```bash
docker run --rm ghcr.io/rdapify/rdapify domain github.com
```

---

## Option C: Rust library

Add to `Cargo.toml`:

```toml
[dependencies]
rdapify = "0.3"
tokio = { version = "1", features = ["full"] }
```

```rust
use rdapify::RdapClient;

#[tokio::main]
async fn main() -> rdapify::Result<()> {
    let client = RdapClient::new()?;

    let domain = client.domain("example.com").await?;
    println!("Registrar: {:?}", domain.registrar.as_ref().and_then(|r| r.name.as_deref()));
    println!("Expires:   {:?}", domain.expiration_date());

    let ip = client.ip("8.8.8.8").await?;
    println!("Network: {} ({})", ip.name.as_deref().unwrap_or("-"), ip.country.as_deref().unwrap_or("-"));

    Ok(())
}
```

```bash
cargo run
```

---

## Option D: Node.js

```bash
npm install rdapify-nd
```

```js
const { domain, ip, asn } = require('rdapify-nd');

const d = await domain('example.com');
console.log(d.registrar?.name);

const i = await ip('8.8.8.8');
console.log(`${i.name} (${i.country})`);
```

---

## Option E: Python

```bash
pip install rdapify-py
```

```python
import rdapify_py as rdap

d = rdap.domain("example.com")
print(d["registrar"]["name"])

i = rdap.ip("8.8.8.8")
print(f"{i['name']} ({i['country']})")
```

---

## What happens under the hood

1. The client fetches the IANA bootstrap file to discover which RDAP server handles your TLD/IP/ASN.
2. It sends an HTTPS query to that server.
3. The response is validated, normalized, and returned as a typed struct.

Bootstrap data is cached in memory for 24 hours. Subsequent queries to the same TLD skip step 1 entirely.

---

## Next steps

| Topic | Guide |
|---|---|
| All CLI options | [docs/CLI.md](docs/CLI.md) |
| Configuration file | [docs/CONFIG.md](docs/CONFIG.md) |
| Install options | [docs/INSTALL.md](docs/INSTALL.md) |
| Docker deployment | [docs/DOCKER.md](docs/DOCKER.md) |
| Production setup | [docs/PRODUCTION.md](docs/PRODUCTION.md) |
| Prometheus metrics | [docs/MONITORING.md](docs/MONITORING.md) |
| Security model | [docs/SECURITY.md](docs/SECURITY.md) |
| vs other tools | [docs/COMPARISON.md](docs/COMPARISON.md) |
