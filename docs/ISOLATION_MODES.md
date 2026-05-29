# RDAPify Isolation Modes

> **Status:** Normative · **Updated:** 2026-05-01
> **Scope:** How RDAPify is isolated from the host application across deployment modes.

RDAPify is a self-contained engine with no hosted SaaS dependency. It can be
embedded, sandboxed, or run as a sidecar. Pick the mode that matches your
trust boundary and crash-isolation requirements.

---

## Quick decision tree

```
Need crash isolation (RDAPify panic must NOT kill host)?
├── No  → Mode 1: Embedded
└── Yes → Need to share a single process with host?
          ├── Yes → Mode 4: WASM (when shipped — not yet)
          └── No  → Latency-sensitive (< 1 ms RTT required)?
                    ├── Yes → Mode 1 + accept risk
                    └── No  → Multi-tenant or untrusted host?
                              ├── Yes → Mode 3: Container
                              └── No  → Mode 2: Sidecar
```

---

## Mode 1 — Embedded (in-process)

**Status:** ✅ Stable · **Default**

The host application links RDAPify directly via Cargo, npm, or PyPI.

### How to consume

```bash
# Rust
cargo add rdapify

# Node.js (native bindings)
npm install rdapify-nd

# Python (native bindings)
pip install rdapify-py
```

```rust
use rdapify::RdapClient;

let client = RdapClient::new();
let domain = client.domain("example.com").await?;
```

### Isolation guarantees

| Layer | Guarantee |
|-------|-----------|
| Memory safety | `#![forbid(unsafe_code)]` across all 11 crates — no segfault from RDAPify code |
| Network | All outbound HTTP routed through `rdap-security::secure_fetch` (7-layer SSRF guard); `reqwest` direct use forbidden in non-security crates |
| Panics | `panic = "abort"` in release profile — RDAPify panic terminates the process (host included) |
| API surface | Only `RdapClient` and the facade re-exports are public; internals are `pub(crate)` |
| Filesystem | SQLite cache writes only to a configurable path (defaults to user data dir) |
| Threads | Spawns its own Tokio tasks on the host's runtime if present, otherwise creates a multi-thread runtime |

### When to use

- Single-tenant CLIs and services
- Low-latency batch jobs
- Trusted host code

### When NOT to use

- Multi-tenant SaaS where one tenant must not crash another
- Hosts that cannot tolerate Tokio runtime co-existence

### Cost

- Latency: native function call (sub-microsecond)
- Memory: shared with host (~5 MiB idle baseline)
- Throughput: ≥ 5,000 rps/core cache-warm

---

## Mode 2 — Sidecar (HTTP daemon)

**Status:** 🟡 Available in `rdapify-pro` · public daemon mode planned for `rdapify-rust` v1.0

Run RDAPify as a separate OS process. Host applications call it over HTTP
(or Unix socket on the same machine).

### How to deploy

```bash
# From the rdapify-rust workspace
cargo run --release -p rdap-cli -- serve --bind 127.0.0.1:8080

# Or from rdapify-pro (already supports HTTP API)
docker run -p 8080:8080 -p 9090:9090 rdapify/rdapify-pro:latest
```

### How to consume from host

```bash
curl http://localhost:8080/domain/example.com
```

```typescript
const res = await fetch("http://localhost:8080/domain/example.com");
const domain = await res.json();
```

### Isolation guarantees

| Layer | Guarantee |
|-------|-----------|
| Process | Separate PID — RDAPify panic does NOT kill host |
| Memory | Distinct address space |
| File descriptors | Separate; host cannot leak into daemon |
| Network egress | Only the daemon makes outbound RDAP calls — host is air-gapped from RDAP servers if desired |
| Failure modes | Host gets `connection refused` instead of crashing; can implement circuit breaker |
| Observability | Prometheus `/metrics` on port 9090 (Pro), structured JSON logs |

### When to use

- Multi-tenant production
- Hosts in restricted runtimes (no native modules allowed)
- When you want to update RDAPify independently of the host
- Centralized rate limiting / cache across multiple host instances

### Cost

- Latency: +1–3 ms RTT vs. embedded
- Memory: separate process (~10 MiB idle)
- Ops: one more thing to deploy, monitor, restart

---

## Mode 3 — Container (full Docker)

**Status:** ✅ Available · `rdapify-pro/Dockerfile` (distroless) · `rdapify/Dockerfile` (Alpine)

Same as Sidecar but with full OS-level isolation: distroless base, nonroot
user, no shell, no package manager.

### How to deploy

```bash
docker run --rm \
  -p 8080:8080 \
  -p 9090:9090 \
  --read-only \
  --cap-drop=ALL \
  --user=nonroot \
  rdapify/rdapify-pro:latest
```

### Isolation guarantees

| Layer | Guarantee |
|-------|-----------|
| All Mode 2 guarantees | ✓ |
| Filesystem | `--read-only` rootfs; only `/tmp` and explicit volumes writable |
| Capabilities | `--cap-drop=ALL` (no `CAP_NET_RAW`, no `CAP_SYS_*`) |
| User | nonroot UID, no shell, no package manager in image |
| Image size | ≤ 15 MB total (distroless `static-debian12:nonroot` + static musl binary; achieved ~13 MB) |
| Attack surface | No `apt`, no `bash`, no `curl` — even if RCE, attacker has nothing to pivot to |

### When to use

- Production deployments
- Untrusted networks (DMZ, edge)
- Compliance requirements (CIS, FedRAMP)
- Kubernetes / Nomad / ECS

### Cost

- Latency: +1–3 ms RTT (same as sidecar)
- Memory: ~12 MiB (process + container overhead)
- Image: ≤ 15 MB pull
- Cold start: ~50 ms after `docker run`

---

## Mode 4 — WASM (sandboxed in-process)

**Status:** ❌ Not yet implemented · Target: post-v1.0
**Size budget:** ≤ 400 KB gzipped (see [PERFORMANCE_SPEC.md §2](PERFORMANCE_SPEC.md#2-binary-size-targets))

Compile the core engine to WebAssembly. Host loads it as a sandboxed module
inside the same OS process. Memory is isolated from the host; syscalls are
capability-gated by the WASM runtime.

### Planned consumption

```typescript
// Browser / Deno / Bun
import { RdapClient } from "@rdapify/wasm";

const client = await RdapClient.load();
const domain = await client.domain("example.com");
```

```rust
// Native host with wasmtime
use wasmtime::*;
let module = Module::from_file(&engine, "rdapify.wasm")?;
```

### Isolation guarantees (planned)

| Layer | Guarantee |
|-------|-----------|
| Memory | WASM linear memory — host cannot access RDAPify heap and vice versa |
| Syscalls | Only what the WASI imports allow (network, clock, randomness) — no filesystem unless explicitly granted |
| Panics | A WASM trap unwinds the module without affecting the host |
| Determinism | Trivially reproducible (same WASM bytes → same output) |

### When to use (once shipped)

- Browsers / edge workers (Cloudflare Workers, Deno Deploy)
- Plugin systems where the host wants strong sandbox guarantees in-process
- Hostile multi-tenant where Mode 1 is insecure and Mode 2/3 is too slow

### Cost (estimated)

- Latency: ~2–5× slower than native (WASM JIT overhead)
- Memory: minimal — single module instance ~1–2 MiB
- No native networking — must use host-provided fetch via WASI

---

## Network sandbox — applies to ALL modes

Independent of which mode you pick, every outbound HTTP request goes through
[`rdap-security::secure_fetch`](../crates/rdap-security/src/lib.rs):

1. **URL validation** — only `http`/`https`, hostname required
2. **DNS resolution** — explicit, with timeout
3. **IP classification** — blocks RFC 1918, link-local, loopback, multicast, broadcast (configurable allowlist for testing)
4. **HTTP policy** — method allowlist, header sanitization
5. **Redirect guard** — max 3 redirects, each re-validated through layers 1–4
6. **Response limits** — max 5 MiB body, max 30 s total time
7. **Content-type validation** — only `application/json`, `application/rdap+json`

This means the host cannot — even if it imports internal crates directly —
bypass SSRF protection. Direct `reqwest` use is forbidden in any other crate
by clippy lint and code review.

---

## Mode comparison summary

| Property | Mode 1 Embedded | Mode 2 Sidecar | Mode 3 Container | Mode 4 WASM (future) |
|----------|----------------|----------------|------------------|---------------------|
| Crash isolation | ❌ | ✅ | ✅ | ✅ (trap) |
| Memory isolation | ❌ | ✅ | ✅ | ✅ |
| Filesystem isolation | ❌ | partial | ✅ | ✅ (capability) |
| Network sandbox | ✅ | ✅ | ✅ | ✅ |
| Ops complexity | none | medium | medium-high | low |
| Latency overhead | 0 µs | +1–3 ms | +1–3 ms | ~2–5× CPU |
| Memory cost | 5 MiB shared | +10 MiB | +12 MiB | +1–2 MiB |
| Update independence | ❌ rebuild host | ✅ | ✅ | ✅ |
| Suitable for browser | ❌ | ❌ | ❌ | ✅ |
| Multi-tenant safe | ❌ | ✅ | ✅ | ✅ |

---

## Recommendations by use case

| Use case | Recommended mode |
|----------|-----------------|
| CLI tool | Mode 1 (Embedded) |
| Internal microservice | Mode 1 (Embedded) |
| Public SaaS (multi-tenant) | Mode 3 (Container) |
| Cloudflare / edge worker | Mode 4 (WASM) once shipped — until then, Mode 2 with regional sidecars |
| Plugin in untrusted host | Mode 4 (WASM) once shipped |
| Compliance-constrained env | Mode 3 (Container, distroless, nonroot, read-only) |
| High-throughput batch | Mode 1 (Embedded) — accept risk for performance |

---

## See also

- [PERFORMANCE_SPEC.md](PERFORMANCE_SPEC.md) — latency, size, and memory targets
- [DOCKER.md](DOCKER.md) — container deployment guide
- [crates/rdap-security/](../crates/rdap-security/) — network sandbox implementation
- [Root README — Container Model](../../README.md#container-model) — workspace overview
