# ADR-0007 — Change License from MIT to Apache-2.0

**Status:** Accepted  
**Date:** 2026-04-06  
**Deciders:** @vahmo (Maintainer)  
**Repos affected:** `rdapify/`, `rdapify-rust/`

---

## Context

RDAPify was originally released under the MIT license. As the project matures toward commercial viability and a structured open-core model, the project needs a license that:

1. Provides explicit patent grant protection for users
2. Requires preservation of attribution notices in derived works
3. Is compatible with the commercial `@rdapify/pro` dual-licensing model
4. Remains OSI-approved and permissive for end users

The MIT license does not include an explicit patent grant. Apache-2.0 includes both a patent grant (§3) and a `NOTICE` file mechanism (§4(d)) for attribution.

## Decision

Both `rdapify/` (npm) and `rdapify-rust/` (crates.io) are relicensed to **Apache License, Version 2.0** effective with the v0.4.0 release.

- A `NOTICE` file is added to each repo (required by Apache-2.0 §4(d))
- `package.json` and `Cargo.toml` `license` fields updated to `Apache-2.0`
- All `README` files updated with the new license badge and declaration
- CLAUDE.md workspace invariant updated: `"MIT license never changes"` → `"Core license is Apache-2.0 and does not change."`

`rdapify-pro/` remains under a separate proprietary license and is unaffected by this change.

## Consequences

**Positive:**
- Users receive an explicit patent grant, improving legal certainty
- Apache-2.0 is widely accepted in enterprise environments
- Compatible with major OSS licenses (GPL-2.0+, MIT, BSD, LGPL)
- Attribution via `NOTICE` file provides a clear contribution history

**Negative / Migration impact:**
- Projects requiring strict MIT-only licensing will need to evaluate compatibility
- Apache-2.0 is incompatible with GPL-2.0 (not GPL-2.0+); GPL-3.0 is compatible
- Downstream forks must retain the `NOTICE` file

**Mitigation:** Apache-2.0 ↔ MIT compatibility is one-directional: MIT code can be included in Apache-2.0 projects, not vice versa in MIT-only projects. This is considered acceptable given the project's target audience (Node.js servers, Rust services, cloud deployments) where Apache-2.0 is standard.

## References

- [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
- [Apache-2.0 vs MIT — OSI comparison](https://opensource.org/licenses/)
- `RDAPify-Internal/DECISIONS.md` — records this as a resolved decision
