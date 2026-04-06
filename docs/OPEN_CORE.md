# RDAPify Open Core Model

RDAPify is an Open Core product. The core RDAP engine is Apache-2.0-licensed and free forever. Commercial features are available in RDAPify-Pro and RDAPify-Cloud.

## Feature Matrix

| Feature | Open (Apache-2.0) | Pro (Commercial) | Cloud (Future SaaS) |
|---|:---:|:---:|:---:|
| RDAP domain queries | ✔ | ✔ | ✔ |
| RDAP IP queries | ✔ | ✔ | ✔ |
| RDAP ASN queries | ✔ | ✔ | ✔ |
| RDAP nameserver queries | ✔ | ✔ | ✔ |
| RDAP entity queries | ✔ | ✔ | ✔ |
| Domain availability check | ✔ | ✔ | ✔ |
| Batch queries | ✔ | ✔ | ✔ |
| Streaming API | ✔ | ✔ | ✔ |
| CLI | ✔ | ✔ | — |
| Node.js binding | ✔ | ✔ | ✔ |
| Python binding | ✔ | ✔ | ✔ |
| SSRF protection | ✔ | ✔ | ✔ |
| Monitoring | — | ✔ | ✔ |
| History | — | ✔ | ✔ |
| Alerts | — | ✔ | ✔ |
| Webhooks | — | ✔ | ✔ |
| Portfolio | — | ✔ | ✔ |
| Analytics | — | ✔ | ✔ |
| REST API | — | — | ✔ |
| Hosted Monitoring | — | — | ✔ |
| Multi-user / Teams | — | — | ✔ |
| SLA & uptime guarantee | — | — | ✔ |

---

## Tier Definitions

### Open (Apache-2.0)

The `RDAPify` engine and CLI are free, open source, and Apache-2.0 licensed. Any individual or organization can use, modify, and redistribute them without restriction. This tier is permanent — no usage limits, license checks, or feature flags will ever be added to the core engine.

**What it includes:**
- Full RDAP query engine (domain, IP, ASN, nameserver, entity)
- SSRF protection and input validation
- IANA bootstrap discovery
- In-memory caching
- Streaming and batch query APIs
- CLI binary
- Node.js and Python bindings (`rdapify-nd`, `rdapify-py`)

### Pro (Commercial License)

`RDAPify-Pro` is a commercial plugin that extends the core engine with operational features for power users and teams. It requires a valid license key and is distributed as a Rust crate and (optionally) a native Node.js module.

**What it adds:**
- **Monitoring**: Continuous domain and IP monitoring with configurable check intervals
- **Alerts**: Rule-based alert triggers (expiry, status change, registrar change, etc.)
- **History**: Persistent query history with diffing and change detection
- **Webhooks**: Outbound HTTP notifications for domain events
- **Portfolio**: Bulk domain portfolio management across registrars
- **Analytics**: Aggregated query statistics and trend reporting

RDAPify-Pro depends on `rdapify` as a peer dependency. It never bundles or forks the core engine.

### Cloud (Future SaaS — Planned)

`RDAPify-Cloud` is a hosted service layer (currently in planning, not yet available). It provides all Pro features without requiring local installation, plus:

- **REST API**: Programmatic access via HTTP
- **Hosted Monitoring**: Managed monitoring infrastructure
- **Team Access**: Multi-user accounts and role-based access control
- **SLA**: Uptime guarantee and support tiers

---

## Business Model

RDAPify's sustainability model:

1. **Core is free** — grows the user base and establishes RDAPify as the standard RDAP library.
2. **Pro is paid** — funds development of the core engine and the Pro layer.
3. **Cloud is paid** — funds infrastructure and global distribution.

The core engine will always remain free and Apache-2.0 licensed. The commercial layers fund its continued development.

---

## What Will Never Move Behind a Paywall

The following features are guaranteed Apache-2.0 forever:
- All RDAP query types (domain, IP, ASN, nameserver, entity)
- Domain availability checking and batch operations
- Streaming API
- CLI
- SSRF protection and all security primitives
- Node.js and Python language bindings

This is an immutable commitment. The Apache-2.0 license on the core engine cannot be revoked.

---

## Plugin Interface

RDAPify-Pro uses a documented plugin interface defined in `rdapify` (the core engine). The interface is versioned and stable across minor releases. Breaking changes require a major version bump and coordination between both repositories.

**Stability guarantee:**
- Minor versions of `rdapify`: plugin interface is backward compatible
- Major versions of `rdapify`: may include breaking interface changes (announced in advance)

The plugin interface is intentionally minimal: RDAPify-Pro receives `RdapClient` and query results; it does not patch or replace core engine behavior.
