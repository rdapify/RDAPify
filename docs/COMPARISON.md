# RDAPify vs Other RDAP / WHOIS Tools

A practical comparison for developers choosing a tool for domain intelligence and network data lookups.

---

## TL;DR

| Tool | Protocol | Structured Output | Caching | SSRF-Safe | Service Mode | Language |
|---|---|---|---|---|---|---|
| **RDAPify** | RDAP | ✔ typed structs | ✔ in-memory | ✔ built-in | ✔ HTTP API | Rust |
| `whois` | WHOIS | ✗ raw text | ✗ | N/A | ✗ | C |
| `python-rdap` | RDAP | ✔ dict | ✗ | ✗ | ✗ | Python |
| `ipwhois` | WHOIS/RDAP | partial | ✗ | ✗ | ✗ | Python |
| `rdap` (npm) | RDAP | ✔ JSON | ✗ | ✗ | ✗ | Node.js |
| `curl` | RDAP (manual) | raw JSON | ✗ | ✗ | ✗ | — |

---

## RDAPify vs `whois`

`whois` uses the legacy WHOIS protocol (RFC 3912, 1982). RDAP replaced it in 2015.

| Aspect | `whois` | RDAPify |
|---|---|---|
| Protocol | WHOIS (plain text, port 43) | RDAP (HTTPS, structured JSON) |
| Output | Unstructured text (no consistent format) | Typed structs / JSON schema |
| Privacy | Sends query unencrypted | All traffic over TLS |
| Availability | Many TLDs no longer support it | All IANA-registered TLDs |
| Error handling | Exit code always 0 | Typed error variants |
| Bootstrap | Manual server selection | Automatic (IANA RFC 9224) |
| Parsing | Regex required per-registry | No parsing needed |
| Automation | Hard (format varies per registry) | Easy (consistent JSON) |

**When to use `whois`:** Interactive one-off lookups when you don't care about structure. For scripting or automation, use RDAPify.

---

## RDAPify vs `python-rdap`

[`python-rdap`](https://pypi.org/project/python-rdap/) is a pure-Python RDAP client.

| Aspect | `python-rdap` | RDAPify (`rdapify-py`) |
|---|---|---|
| Performance | GIL-bound, no async | Rust async, Tokio runtime |
| Caching | None | In-memory with TTL |
| SSRF protection | None | Full (DNS + IP + redirect) |
| Retry logic | None | Exponential back-off |
| Type safety | Dict only | Rust structs exposed as dicts |
| Bootstrap | Custom implementation | IANA RFC 9224 compliant |
| Service mode | None | HTTP API (`rdapify serve`) |
| Batch queries | Manual (loop) | Native (`rdapify-batch`) |

**When to use `python-rdap`:** Pure-Python environments where adding native extensions is blocked. For production use, `rdapify-py` is faster and safer.

---

## RDAPify vs `ipwhois`

[`ipwhois`](https://pypi.org/project/ipwhois/) is a Python library for IP network lookups via WHOIS and RDAP.

| Aspect | `ipwhois` | RDAPify |
|---|---|---|
| Scope | IP networks only | Domain + IP + ASN + NS + Entity |
| Protocol | WHOIS + RDAP | RDAP only |
| Caching | Session-level only | Persistent in-process TTL cache |
| SSRF protection | None | Full |
| Async support | No | Yes (Tokio) |
| CLI | No | Yes |
| Service | No | Yes |
| Language | Python | Rust + Python/Node.js bindings |

---

## RDAPify vs `rdap` (npm)

[`rdap`](https://www.npmjs.com/package/rdap) is a Node.js RDAP lookup package.

| Aspect | `rdap` (npm) | RDAPify (`rdapify-nd`) |
|---|---|---|
| Engine | JavaScript | Rust native |
| Performance | JavaScript async | Rust async, ~10× faster |
| SSRF protection | None | Full (DNS + IP + redirect + size) |
| Caching | None | In-memory with TTL |
| Type definitions | Partial | Full TypeScript types |
| Retry | None | Exponential back-off |
| Maintenance | Infrequent | Active |

---

## RDAPify vs `curl` (manual RDAP)

`curl` can query RDAP servers directly once you know the URL.

```bash
# Manual — you must know the server URL
curl https://rdap.verisign.com/com/v1/domain/example.com

# RDAPify — automatic bootstrap
rdapify domain example.com
```

| Aspect | `curl` manual | RDAPify |
|---|---|---|
| Bootstrap | Manual (you find the URL) | Automatic |
| Response validation | None | Schema + content-type |
| SSRF protection | None | Built-in |
| Output | Raw JSON string | Typed / pretty-printed |
| Error handling | HTTP status only | Typed errors + retry |
| Caching | None | In-memory |
| TLD coverage | 1 server at a time | All IANA TLDs |

**When to use `curl`:** One-off debugging when you already know the RDAP server URL. For any automation or production use, RDAPify handles all the complexity.

---

## Performance Comparison

> Measured on Linux x86-64. RDAPify uses a mock HTTP server for benchmarks — no real network latency included.

| Operation | `python-rdap` | `ipwhois` | RDAPify |
|---|---|---|---|
| Cold domain lookup | ~1.2s | N/A | **~250ms** |
| Warm domain lookup (cached) | ~800ms | N/A | **~95ms** |
| Cache hit (in-process) | N/A | N/A | **~2µs** |
| Batch 100 domains | ~120s | N/A | **~2.1s** |

Real network times depend on target registry, geographic location, and network conditions. The RDAPify cache provides the largest impact when querying the same records repeatedly.

---

## Security Comparison

| Feature | `python-rdap` | `ipwhois` | `rdap` (npm) | RDAPify |
|---|---|---|---|---|
| SSRF protection | ✗ | ✗ | ✗ | ✔ |
| DNS rebinding protection | ✗ | ✗ | ✗ | ✔ |
| Response size limit | ✗ | ✗ | ✗ | ✔ (10 MB default) |
| Redirect validation | ✗ | ✗ | ✗ | ✔ |
| TLS only (no HTTP) | ✗ | ✗ | ✗ | ✔ |
| Private IP blocking | ✗ | ✗ | ✗ | ✔ |

If you are running RDAP queries in a server environment (where user input may influence the query target), only RDAPify provides SSRF protection out of the box.

---

## When to choose RDAPify

- You need a **production-grade** RDAP client (retry, cache, SSRF protection)
- You are building a **web application** that accepts user-supplied domains/IPs
- You need **batch processing** of large domain lists
- You want a **drop-in CLI** with structured output for scripting
- You need **Prometheus metrics** and observability
- You want **Node.js or Python** performance without rewriting in Rust
- You want to run RDAP as a **self-hosted HTTP service**
