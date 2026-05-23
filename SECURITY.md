# Security Policy — rdapify (Rust)

This document covers the **`rdapify` crate** ([crates.io/crates/rdapify](https://crates.io/crates/rdapify)), its Node.js binding **`rdapify-nd`** ([npmjs.com/package/rdapify-nd](https://npmjs.com/package/rdapify-nd)), and its Python binding **`rdapify-py`** ([pypi.org/project/rdapify-py](https://pypi.org/project/rdapify-py)).

For the TypeScript npm package `rdapify`, see [rdapify/SECURITY.md](https://github.com/rdapify/rdapify/blob/main/SECURITY.md).

---

## 1. Supported Versions

### Core library (crates.io)

| Version | Supported         | Notes                                              |
| ------- | ----------------- | -------------------------------------------------- |
| 0.5.0   | ✅ Active support | Latest — pending public release (source ready)     |
| 0.4.x   | ✅ Active support | Current stable — all fixes applied here first      |
| 0.3.x   | ❌ End of life    | No further updates; upgrade to 0.4.x               |
| 0.2.x   | ❌ End of life    | No further updates; upgrade to 0.4.x               |
| 0.1.x   | ❌ End of life    | No further updates; upgrade to 0.4.x               |

### Bindings

| Binding      | Current version   | Supported         |
| ------------ | ----------------- | ----------------- |
| `rdapify-nd` | 0.4.0 / 0.5.0 ⏳ | ✅ Active support |
| `rdapify-py` | 0.4.0 / 0.5.0 ⏳ | ✅ Active support |

Bindings are versioned independently. The binding version tracks the core release it was compiled against. Only the latest binding version is supported.

**Support policy (pre-1.0):** The current minor version receives full support. Fixes are not backported to older versions. Starting with v1.0.0, an LTS policy will be defined.

---

## 2. Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

### Reporting channels

| Channel | Use for | Acknowledgement target |
|---------|---------|------------------------|
| [GitHub Security Advisories](https://github.com/rdapify/rdapify-rs/security/advisories/new) | All severities (preferred) | 48 hours |
| security@rdapify.com | All severities | 48 hours |
| emergency@rdapify.com | Critical or actively exploited | 4 hours |

### What to include

- **Description:** Clear explanation of the vulnerability and how it can be triggered
- **Impact:** What an attacker could achieve
- **Reproduction:** Steps to reproduce; proof-of-concept code if available
- **Affected component:** Core library, `rdapify-nd`, `rdapify-py`, CLI binary
- **Affected versions:** Crate version, binding version, Rust toolchain version

---

## 3. Security Scope

| Component | What we protect against |
|-----------|------------------------|
| **SSRF protection** | Private/loopback/link-local IP bypass; protocol smuggling |
| **Input validation** | Injection via malformed domain, IP, ASN, or nameserver inputs |
| **RDAP response parsing** | Malformed JSON causing panics; unexpected response structure |
| **`rdapify-nd` (N-API binding)** | Panics crossing the Rust→Node.js FFI boundary; memory safety at the boundary |
| **`rdapify-py` (PyO3 binding)** | Panics crossing the Rust→Python FFI boundary; GIL handling |
| **TLS (`rustls`)** | Certificate validation; cipher suite selection |
| **CLI binary** | Command injection via shell-interpolated arguments; path traversal |
| **Dependency supply chain** | Malicious crate injected via `Cargo.lock` drift or advisory-reported CVE |

---

## 4. Security Practices

### `#![forbid(unsafe_code)]`

All crates in this repository enforce `#![forbid(unsafe_code)]` at the crate root. The Rust compiler rejects any `unsafe` block at compile time. This eliminates the class of memory-safety vulnerabilities (buffer overflows, use-after-free, data races) that affect C and C++ libraries.

### No OpenSSL — rustls only

All TLS is handled by [`rustls`](https://github.com/rustls/rustls), a pure-Rust TLS implementation. There is no `openssl`, `native-tls`, or `openssl-sys` dependency in this crate. This eliminates the C-level CVEs that routinely affect OpenSSL-linked libraries.

MSRV is Rust 1.75. Cryptographic primitives (`ring` / `aws-lc-rs`) are kept up to date as part of the dependency maintenance process.

### SSRF protection

The Rust SSRF implementation mirrors the TypeScript version exactly: private RFC 1918 ranges, loopback, link-local, multicast, and reserved ranges are blocked before any DNS resolution or outbound connection. Only `https://` and `http://` schemes are permitted.

### RDAP response validation

**All RDAP responses must pass JSON structure validation before deserialization.
Deserializing untrusted JSON directly into structs is not allowed.**

Every RDAP response passes through `rdap_core::validation::validate_rdap_response` between the HTTP read and any `serde` deserialization.  The validation layer enforces:

| Protection              | Limit (default)          |
|-------------------------|--------------------------|
| Raw body size cap       | 5 MiB (`max_json_size`)  |
| JSON nesting depth      | 10 (`max_recursion_depth`) |
| Array length            | 1 000 (`max_array_length`) |
| Object field count      | 200 (`max_object_fields`)  |
| String value length     | 10 KiB (`max_string_length`) |
| `entities` array length | 100 (`max_entities`)       |
| `links` array length    | 100 (`max_links`)          |
| `events` array length   | 100 (`max_events`)         |

Limits are configurable via `RdapValidationLimits` in `FetcherConfig::validation_limits`.  The body size limit is enforced at the transport layer by `rdap_security::read_limited` **before** any heap allocation for JSON parsing occurs.

This layer protects against memory exhaustion, CPU exhaustion from JSON bombs, deep-recursion attacks, and unexpected RDAP structures that could cause panics or incorrect behavior downstream.

### Dependency auditing

`cargo audit` runs on every CI push via GitHub Actions. The workflow fails if any dependency has a published advisory. `Cargo.lock` is committed so that reproducible builds and supply-chain auditing are possible.

### Tokio async runtime

All async I/O uses the [Tokio](https://tokio.rs/) runtime with Rust's memory-safe async/await model. There is no thread-unsafe shared mutable state.

### FFI boundary safety (`rdapify-nd`, `rdapify-py`)

Rust panics are caught at the FFI boundary and converted to JavaScript errors (`rdapify-nd`) or Python exceptions (`rdapify-py`) before crossing the language boundary. An uncaught Rust panic does not crash the host process.

### CLI binary

The CLI binary (`rdapify` command, feature-flagged with `--features cli`) accepts inputs from the command line, passes them through the same validation layer as the library, and never interpolates user input into shell commands.

---

## 5. Key Rotation & Revocation

The `rdapify` Rust core library and its bindings do not manage or distribute cryptographic keys. There is no shared secret between crate instances.

TLS certificate validation is handled by `rustls` using the system certificate store (or the `webpki-roots` embedded roots). Certificate rotation at RDAP registries is transparent to the library.

For license key rotation and revocation in `@rdapify/pro`, see the [Pro Security Policy](https://github.com/rdapify/RDAPify-Pro) or contact security@rdapify.com.

---

## 6. Disclosure Policy

rdapify-rust follows coordinated responsible disclosure:

1. **Reporter submits** a vulnerability via GitHub Advisories or email
2. **Acknowledgement** within 48 hours (4 hours for emergency@rdapify.com)
3. **Severity triage** within 7 days; reporter is informed of the assessment
4. **Fix developed** in a private fork; a patched crate version is prepared
5. **Security release published** — patch version with a `### Security` entry in CHANGELOG
6. **Advisory published** on GitHub Security Advisories; CVE requested if applicable via crates.io advisory infrastructure
7. **Reporter credited** by name or handle (unless anonymity is requested)

**Maximum embargo: 90 days** from the date of initial report.

**Patch timeline targets by severity:**

| Severity | Examples | Target |
|----------|---------|--------|
| Critical | SSRF bypass, RCE, memory unsafety | 7 days |
| High | DoS via malformed response, FFI panic propagation | 14 days |
| Medium | Information disclosure, TLS downgrade | 30 days |
| Low | Documentation with security implications | Next release |

---

## 7. Security Updates

Security fixes are released as **patch versions** of the affected crate (e.g., `rdapify` 0.2.1 → 0.2.2, `rdapify-nd` 0.1.3 → 0.1.4).

Critical vulnerabilities trigger an **out-of-band release** independent of the normal schedule.

Every security release includes:
- A `### Security` section in [`CHANGELOG.md`](CHANGELOG.md)
- A published [GitHub Security Advisory](https://github.com/rdapify/rdapify-rs/security/advisories)
- A crates.io advisory (via the [RustSec Advisory Database](https://rustsec.org/)) for CVE-eligible issues

**Subscribe to security notifications:**
- GitHub: Watch this repository → "Security alerts only"
- Rust: Run `cargo audit` in your project after updating dependencies
- Python: Run `pip-audit` if using `rdapify-py`

---

> Last reviewed: 2026-03-25 · security@rdapify.com
> rdapify is provided under the MIT License. See [LICENSE](LICENSE) for full terms.
