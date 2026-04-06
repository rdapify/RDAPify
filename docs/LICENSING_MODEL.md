# RDAPify Licensing Model

## Overview

RDAPify uses a multi-tier licensing model aligned with its Open Core architecture. Each repository has a distinct license that matches its intended audience and use case.

---

## License by Repository

| Repository | License | Audience |
|---|---|---|
| RDAPify (this repo) | Apache-2.0 | Developers, researchers, integrators |
| RDAPify-Pro | Commercial | Businesses and power users |
| RDAPify-Internal | Proprietary | Internal use only — never distributed |
| rdapify-TS (archived) | Apache-2.0 | Legacy — no new use |
| RDAPify-Cloud (future) | SaaS Terms | Hosted service subscribers |

---

## Apache License 2.0 (RDAPify Core)

The core engine — all 11 crates in this workspace — is licensed under the **Apache License 2.0**.

**Permissions:**
- Use commercially without restriction
- Modify and redistribute in source or binary form
- Embed in proprietary software
- Sub-license

**Requirements:**
- Retain the copyright notice and license text in all copies

**No warranty**: The software is provided "as is". See [LICENSE](../LICENSE) for the full text.

The Apache-2.0 license on the core engine is **permanent and irrevocable**. It will not be changed to a more restrictive license in any future version.

---

## Commercial License (RDAPify-Pro)

RDAPify-Pro is distributed under a **commercial license** that requires a valid license key.

**Key properties:**
- A license key is required to activate Pro features
- License keys are machine-bound and cryptographically signed (Ed25519)
- Redistribution of RDAPify-Pro is not permitted
- Modification of RDAPify-Pro is not permitted
- Decompiling or reverse-engineering RDAPify-Pro is not permitted

**Compliance:**
- RDAPify-Pro validates its license at startup (offline, via embedded public key)
- Online re-validation is required periodically (grace period: 24 hours)
- License details: see `RDAPify-Pro/LICENSE` and `RDAPify-Pro/docs/LICENSE_SYSTEM.md`

---

## Proprietary (RDAPify-Internal)

`RDAPify-Internal` contains the license server, signing service, Paddle billing integration, and admin dashboard. This code is **not distributed** — it runs exclusively on RDAPify infrastructure.

**Properties:**
- All rights reserved
- No redistribution, no public access
- Source code is never published
- Details: see `RDAPify-Internal/docs/LICENSE_API.md`

---

## SaaS Terms (RDAPify-Cloud — Future)

When RDAPify-Cloud launches, access will be governed by **SaaS Terms of Service**, not a software license. Users subscribe to the service; no software is distributed to them.

**Anticipated properties:**
- Subscription-based access
- Data processing agreement for GDPR compliance
- Usage limits per tier
- No on-premises installation rights

---

## Dependency Compliance

RDAPify-Pro depends on RDAPify (Apache-2.0) as a **peer dependency**. This means:

- RDAPify-Pro does not bundle the Apache-2.0 engine — users must install RDAPify separately
- The commercial license covers only the Pro plugin layer
- The Apache-2.0 engine used alongside Pro remains Apache-2.0-licensed and freely usable

This separation ensures that:
1. Users can always use the Apache-2.0 engine independently of Pro
2. The Apache-2.0 license terms are never contaminated by the commercial layer
3. Auditors can clearly identify what is Apache-2.0 and what is commercial

---

## Third-Party Licenses

RDAPify uses the following key dependencies. All are compatible with the Apache-2.0 license:

| Crate | License | Purpose |
|---|---|---|
| tokio | MIT | Async runtime |
| reqwest | MIT / Apache-2.0 | HTTP client |
| rustls | MIT / Apache-2.0 | TLS |
| serde | MIT / Apache-2.0 | Serialization |
| dashmap | MIT | Concurrent cache |
| idna | MIT / Apache-2.0 | Domain normalization |

Full dependency list: `cargo tree --all-features`

---

## License Questions

For licensing questions, contact: legal@rdapify.com
