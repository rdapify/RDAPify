# RDAPify Roadmap

## Overview

This roadmap describes the planned development phases for the RDAPify platform. Phases are sequential: each phase must be fully completed and locked before the next begins.

**Governing principle**: Security > Stability > Documentation > Architecture > Features

---

## Phase Status

| Phase | Name | Status |
|---|---|---|
| Phase 0 | Foundation & Reorganization | ✅ Completed |
| Phase 1 | Security Hardening | 🔄 Next |
| Phase 2 | Billing & License Infrastructure | 📋 Planned |
| Phase 3 | Engine Stabilization | 📋 Planned |
| Phase 4 | SDK Bindings | 📋 Planned |
| Phase 5 | Cloud Platform | 🔭 Future |
| Phase 6 | Enterprise | 🔭 Future |

---

## Phase 0 — Foundation & Reorganization ✅

**Goal**: Establish a clean, well-documented architectural foundation.

**Completed deliverables:**
- 11-crate Rust workspace (replaced monolithic architecture)
- Documentation freeze: ARCHITECTURE.md, SECURITY.md, OPEN_CORE.md, LICENSING_MODEL.md, ROADMAP.md, REPOSITORY_BOUNDARIES.md
- Repository boundary specification
- Open Core model formally defined
- GitHub organization structure established
- DECISIONS.md and GOVERNANCE.md in place

---

## Phase 1 — Security Hardening 🔄

**Goal**: Ensure all security-critical code paths are hardened, audited, and tested before any public release.

**Scope:**
- Full SSRF audit (all code paths that issue outbound requests)
- Input validation completeness review
- `cargo-audit` integrated into CI
- `cargo deny` for license and dependency policy
- Security test suite expanded (fuzz targets for input validation)
- Responsible disclosure process verified

**Exit criteria**: Security audit passes with zero critical or high findings.

---

## Phase 2 — Billing & License Infrastructure 📋

**Goal**: Production-ready license validation and billing integration for RDAPify-Pro.

**Scope:**
- License server (RDAPify-Internal) production deployment
- Signing service key ceremony and key management
- Paddle billing integration and webhook handling
- License key issuance and revocation workflows
- Offline license validation integration in RDAPify-Pro
- License enforcement in RDAPify-Pro at startup

**Exit criteria**: End-to-end license purchase, activation, and validation working in staging.

---

## Phase 3 — Engine Stabilization 📋

**Goal**: Stable, well-tested v1.0 of the Rust engine ready for public release.

**Scope:**
- API stability review — all public types and methods finalized
- 90%+ test coverage on core crates (rdap-types, rdap-security, rdap-client, rdap-core)
- Integration test suite against real IANA servers (gated behind `--ignored`)
- Performance benchmarks baselined and documented
- CHANGELOG finalized for v1.0.0
- MIGRATION guide for users of the legacy TypeScript SDK

**Exit criteria**: `cargo test --workspace` passes clean; benchmarks documented; CHANGELOG complete.

---

## Phase 4 — SDK Bindings 📋

**Goal**: Production-ready Node.js and Python bindings for the Rust engine.

**Scope:**
- `rdapify-nd` (Node.js): npm package with TypeScript types, async/await API
- `rdapify-py` (Python): PyPI package with type stubs, asyncio support
- Go and PHP bindings (evaluation phase)
- Binding test suites covering all 5 query types
- Binding-specific documentation and examples
- npm and PyPI publish automation

**Exit criteria**: `rdapify-nd` and `rdapify-py` published to public registries; all query types tested.

---

## Phase 5 — Cloud Platform 🔭

**Goal**: Hosted SaaS offering all Pro features without local installation.

**Scope:**
- REST API (Cloudflare Workers + D1)
- Hosted monitoring infrastructure
- Multi-user accounts, SSO
- Dashboard UI
- SaaS Terms of Service and DPA
- Pricing tiers

**Status**: Future — detailed planning begins after Phase 4 completion.

---

## Phase 6 — Enterprise 🔭

**Goal**: Enterprise-grade features for large organizations.

**Scope:**
- On-premises deployment option
- SSO / SAML integration
- Audit logs and compliance exports
- Dedicated support tiers
- Custom SLA

**Status**: Future — scope defined based on Phase 5 adoption.

---

## Notes

- This roadmap covers the RDAPify platform (engine + Pro + Cloud).
- For current stabilization work items, see `RDAPify-Internal/planning/STABILIZATION_ROADMAP.md`.
- For architectural decisions, see `RDAPify-Internal/DECISIONS.md`.
- For release governance, see `RDAPify-Internal/GOVERNANCE.md`.
