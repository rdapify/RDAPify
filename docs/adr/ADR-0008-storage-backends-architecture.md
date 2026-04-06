# ADR-0008 — Storage Backend Architecture (SQLite / PostgreSQL / MySQL)

**Status:** Accepted  
**Date:** 2026-04-06  
**Deciders:** @vahmo (Maintainer)  
**Repos affected:** `rdapify-rust/`

---

## Context

The `rdapify-rust` workspace added three new crates in v0.4.0:

- `rdap-sqlite` — SQLite storage backend  
- `rdap-postgres` — PostgreSQL storage backend  
- `rdap-mysql` — MySQL / MariaDB storage backend

These crates were added during the stabilization phase, which carries a governing principle of "No new features during stabilization; priority: Security > Stability > Docs > Architecture > Features."

This ADR documents the rationale and constraints for including these crates in v0.4.0.

## Decision

The storage backend crates are included in v0.4.0 as **optional, feature-gated, skeletal infrastructure** under the Architecture priority of the stabilization phase.

### Why now (during stabilization)

1. **Architecture, not features**: The crates define the storage abstraction layer and workspace module boundaries. Adding them post-stabilization would require a more disruptive restructuring of the workspace topology.
2. **Feature-gated and off by default**: None of the backends are compiled unless the caller explicitly enables the corresponding Cargo feature (`sqlite`, `postgres`, `mysql`). No existing consumer is affected.
3. **Skeletal stubs only**: At v0.4.0, these crates contain only the module structure, trait definitions, and error types. No production-ready persistence logic is shipped.
4. **Long-term architecture**: The storage layer underpins `@rdapify/pro` features (history tracking, monitoring, persistence). Defining the abstraction boundary in the public workspace now allows `rdapify-pro` to depend on it correctly from v0.5.0 onward.

### Constraints

- All three crates MUST remain feature-gated (`#[cfg(feature = "...")]`) in the workspace facade (`rdapify/src/lib.rs`)
- Features are **not enabled by default** in `Cargo.toml`
- No storage backend may be imported or activated without explicit opt-in by the caller
- Production implementations are out of scope for v0.4.x; they target the v0.5.0 milestone
- These crates are NOT published to crates.io in v0.4.0 (only the `rdapify` facade is published)

## Consequences

**Positive:**
- Workspace architecture is established cleanly before feature work begins
- `rdapify-pro` can declare path dependencies on these crates from v0.5.0
- No consumer impact — all gated behind opt-in features

**Negative:**
- Adds workspace members with no user-visible value in v0.4.x
- Increases compile time for contributors who build all workspace members

## References

- `RDAPify-Internal/planning/STABILIZATION_ROADMAP.md` — current phase
- `rdapify-rust/Cargo.toml` — workspace members and feature flags
