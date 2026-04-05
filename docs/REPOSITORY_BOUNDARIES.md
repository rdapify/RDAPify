# Repository Boundaries

## Purpose

This document defines strict boundaries for each repository in the RDAPify organization. These boundaries prevent architecture drift and ensure the Open Core model remains intact as the platform grows.

Any code that crosses a boundary is a violation and must be corrected before merging.

---

## Boundary Specification

| Repository | Contains | Must NOT Contain |
|---|---|---|
| RDAPify | RDAP engine (11 crates), CLI, language bindings | Pro features, billing, license enforcement, monitoring, webhooks |
| RDAPify-Pro | Monitoring, alerts, history, webhooks, portfolio, analytics | RDAP engine code, billing, license server, payment logic |
| RDAPify-Internal | License server, signing service, Paddle billing, admin | RDAP engine code, Pro feature logic |
| rdapify-TS | Archived — read-only | New features of any kind |
| rdapify.github.io | Public website, docs, guides | Source code, credentials, internal plans |

---

## RDAPify (This Repository)

**Allowed:**
- RDAP protocol implementation (RFC 9083, RFC 9224)
- SSRF protection, input validation, error types
- IANA bootstrap discovery
- In-memory caching, streaming, batch operations
- CLI binary (`rdap-cli` crate)
- Language binding scaffolding (Node.js via napi-rs, Python via PyO3)
- Plugin interface definition (the API that RDAPify-Pro uses)
- MIT-licensed code only

**Forbidden:**
- Any code that checks for a license key
- Any feature flags that enable/disable behavior based on a commercial license
- Monitoring loops, alert scheduling, webhook dispatch
- SQLite persistence or any local database
- Paddle, Stripe, or any payment provider integration
- References to `rdapify-pro`, `rdapify-internal`, or internal hostnames

---

## RDAPify-Pro

**Allowed:**
- Domain monitoring (polling `RdapClient` on a schedule)
- Change detection and alerting logic
- Persistent history storage (SQLite via local file)
- Webhook delivery engine
- Portfolio management data structures
- Analytics aggregation
- License validation (offline, using public key from RDAPify-Internal)
- Rust crate published as a private registry package
- Native Node.js addon (napi-rs)

**Forbidden:**
- Any modification of `RdapClient` behavior
- Bundling or copying code from the RDAPify workspace
- Billing logic (Paddle, Stripe, etc.)
- License key issuance or signing (signing is in RDAPify-Internal)
- Publishing to public crates.io or npm under the `rdapify` name without explicit approval

---

## RDAPify-Internal

**Allowed:**
- License server: key issuance, activation, revocation
- Signing service: Ed25519 key management and token signing
- Billing: Paddle webhook handling, subscription state
- Admin dashboard: internal tooling for the team
- D1 database schemas for license and billing data
- Cloudflare Workers deployment

**Forbidden:**
- RDAP query logic of any kind
- Pro feature implementations (monitoring, alerts, etc.)
- Public-facing APIs that end users call directly (except the license activation endpoint)
- Storing plaintext private keys anywhere outside the signing service

---

## Dependency Direction

```
RDAPify-Internal
      ↑ (no code dependency — only runtime HTTP calls for license activation)
RDAPify-Pro → depends on → RDAPify (peer dependency, Cargo.toml)
RDAPify      → no upstream dependencies in this org
```

**Rules:**
- RDAPify has zero dependencies on RDAPify-Pro or RDAPify-Internal.
- RDAPify-Pro depends on RDAPify via Cargo path dep (local) or registry dep (releases). It does **not** bundle it.
- RDAPify-Pro communicates with RDAPify-Internal only via HTTPS at runtime (license activation). There is no compile-time dependency.
- RDAPify-Internal has no code dependency on either RDAPify or RDAPify-Pro.

---

## Enforcement

### Automated checks (CI)

| Repository | Check |
|---|---|
| RDAPify | `grep -r "license_key\|LicenseKey\|rdapify_pro" src/` must return empty |
| RDAPify-Pro | `grep -r "paddle\|billing\|signing_service" src/` must return empty |
| RDAPify | `cargo deny check licenses` — only MIT/Apache-2.0 dependencies allowed |

### Code review

Any PR that appears to move a feature across a boundary requires explicit approval from the repository maintainer and a comment justifying why the boundary exception is warranted.

### Architecture drift detection

Before any non-trivial change, the implementer must read this document and confirm the proposed change respects the boundaries. If the change requires a boundary exception, a new entry must be added to `RDAPify-Internal/DECISIONS.md` first.

---

## Why These Boundaries Exist

1. **License integrity**: MIT code must never depend on or include commercial code. Mixing them voids the MIT promise to users.
2. **Security isolation**: The signing private key and billing credentials must never be near the open-source engine.
3. **Contribution clarity**: External contributors to RDAPify should never encounter commercial or internal code — it reduces confusion and legal risk.
4. **Auditability**: Security researchers auditing the MIT engine should see only MIT code. Commercial and internal code is out of scope.
