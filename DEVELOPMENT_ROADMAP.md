# RDAPify — Development Roadmap

> **Current version:** v0.1.7 (Alpha)
> **Last updated:** March 2026
> **Purpose:** Authoritative reference for all development decisions

---

## Table of Contents

1. [Current State](#1-current-state)
2. [Project Vision](#2-project-vision)
3. [Development Principles](#3-development-principles)
4. [Phase 1 — Stability & Core Features (v0.2.x)](#4-phase-1--stability--core-features-v02x)
5. [Phase 2 — Ecosystem Expansion (v0.3.x)](#5-phase-2--ecosystem-expansion-v03x)
6. [Phase 3 — Developer Experience (v0.4.x)](#6-phase-3--developer-experience-v04x)
7. [Phase 4 — Production Release (v1.0.0)](#7-phase-4--production-release-v100)
8. [Phase 5 — Advanced Features (v2.x)](#8-phase-5--advanced-features-v2x)
9. [Quality Standards](#9-quality-standards)
10. [Contributing Guidelines](#10-contributing-guidelines)

---

## 1. Current State

### Completed in v0.1.x

| Feature | Status |
|---------|--------|
| Domain RDAP queries | ✅ |
| IP RDAP queries | ✅ |
| ASN RDAP queries | ✅ |
| Bootstrap discovery (IANA) | ✅ |
| In-memory LRU cache | ✅ |
| Redis cache adapter | ✅ |
| PII redaction | ✅ |
| SSRF protection | ✅ |
| Retry with exponential backoff | ✅ |
| TypeScript strict mode | ✅ |
| Clean Architecture | ✅ |
| 90%+ test coverage | ✅ |
| npm publish pipeline | ✅ |

---

## 2. Project Vision

RDAPify aims to be the **definitive RDAP library** for the JavaScript ecosystem — the go-to solution for anyone querying domain, IP, and ASN registration data.

**Goals:**
- Zero-friction API for the common 80% of use cases
- Full extensibility for the advanced 20%
- Production-grade reliability and security
- First-class TypeScript experience

---

## 3. Development Principles

| Principle | Rule |
|-----------|------|
| **Zero dependencies** | No runtime deps in core (exception: `ipaddr.js`) |
| **Clean Architecture** | Never break layer boundaries |
| **Security by default** | SSRF protection, PII redaction on by default |
| **TypeScript strict** | Always — no exceptions |
| **Backward compatibility** | No breaking changes within a major version |

---

## 4. Phase 1 — Stability & Core Features (v0.2.x)

**Goal:** Deepen stability and complete the most-requested missing features.

### v0.1.8 — Domain Availability

| Feature | API | Priority |
|---------|-----|----------|
| Domain availability check | `client.checkAvailability(domain)` | 🔴 High |
| Bulk availability check | `client.checkAvailabilityBatch(domains[])` | 🔴 High |
| Live integration tests | opt-in via `LIVE_TESTS=1` | 🟠 Medium |
| Custom bootstrap config | custom servers, TTL overrides | 🟠 Medium |
| Performance benchmarks | automated via CI | 🟡 Low |

**Implementation notes:**
- `checkAvailability`: HTTP 404 from RDAP server = domain available
- `checkAvailabilityBatch`: parallel requests with configurable concurrency
- Batch should respect rate limits per RDAP server

### v0.2.x — Stability

| Feature | Priority |
|---------|----------|
| Improve error messages (actionable, user-friendly) | 🔴 High |
| `RDAPError` base class with typed subclasses | 🔴 High |
| Bootstrap TTL and refresh strategy | 🟠 Medium |
| Response validation with Zod (optional) | 🟡 Low |

---

## 5. Phase 2 — Ecosystem Expansion (v0.3.x)

**Goal:** Expand reach with framework integrations and additional adapters.

### Cache Adapters

| Adapter | Notes |
|---------|-------|
| File system cache | For CLI tools and scripts |
| SQLite cache | Embedded, no server required |
| Memcached | Enterprise use cases |

### Framework Integrations

| Integration | Notes |
|-------------|-------|
| Express middleware | `rdapify/express` |
| Fastify plugin | `rdapify/fastify` |
| CLI tool | `npx rdapify domain example.com` |

### Additional Query Types

| Type | Notes |
|------|-------|
| Entity queries | Contact/registrar lookup |
| Nameserver queries | NS record RDAP data |
| RDAP search | Wildcard searches where supported |

---

## 6. Phase 3 — Developer Experience (v0.4.x)

**Goal:** Make RDAPify the most pleasant RDAP library to use.

| Feature | Description |
|---------|-------------|
| Interactive CLI | Rich terminal output with formatting |
| Playground improvements | Live editor on rdapify.com |
| JSDoc on all public APIs | Inline IDE documentation |
| Migration guides | Between major versions |
| `rdapify doctor` | CLI command to diagnose config issues |

---

## 7. Phase 4 — Production Release (v1.0.0)

**Goal:** Declare API stable. No more breaking changes.

### Requirements for v1.0.0

- [ ] API surface stable and documented
- [ ] 95%+ test coverage
- [ ] Security audit passed
- [ ] Performance benchmarks published
- [ ] All `@experimental` APIs removed or promoted
- [ ] Changelog complete from v0.1.0

### SemVer commitment

After v1.0.0:
- **Patch** (1.0.x): bug fixes only
- **Minor** (1.x.0): new features, backward compatible
- **Major** (x.0.0): breaking changes, with migration guide

---

## 8. Phase 5 — Advanced Features (v2.x)

Long-term features, subject to community demand:

| Feature | Description |
|---------|-------------|
| Streaming API | Stream large result sets |
| GraphQL interface | Query via GraphQL |
| Webhook support | Event notifications for RDAP changes |
| Rate limit handling | Automatic backoff per server |
| Circuit breaker | Automatic failure detection per RDAP server |
| RDAP diff | Compare domain records over time |
| Multi-region proxy | Route to nearest RDAP server |

---

## 9. Quality Standards

### Every release must pass

| Check | Tool | Threshold |
|-------|------|-----------|
| Unit tests | Jest | 90% coverage |
| Type check | tsc --strict | 0 errors |
| Linter | ESLint | 0 warnings |
| Security audit | npm audit | 0 high/critical |
| API surface | verify:api | no regressions |

### Performance targets

| Operation | Target |
|-----------|--------|
| Cached query | < 1ms |
| Uncached query (network) | < 500ms p95 |
| Bootstrap discovery | < 100ms (cached) |
| Batch (100 domains) | < 5s with concurrency=10 |

---

## 10. Contributing Guidelines

### How features get prioritized

1. Reported issues with high community +1s
2. Features already in this roadmap
3. PRs with tests for unplanned features

### Branching strategy

```
main          ← always releasable
  └── feat/   ← feature branches
  └── fix/    ← bug fix branches
  └── chore/  ← maintenance
```

### Release cadence

- **Patch releases**: as needed (bug fixes)
- **Minor releases**: monthly (features)
- **Major releases**: when API is stable

---

*This roadmap is a living document. Priorities shift based on community feedback and real-world usage.*
