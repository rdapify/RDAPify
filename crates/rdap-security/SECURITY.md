# rdap-security — Network Security Policy

## Rule: All outbound HTTP requests must go through `rdap-security`

**All outbound HTTP requests in RDAPify must go through the `rdap-security`
crate. Direct HTTP requests using `reqwest` or any other HTTP client are not
allowed in `rdapify-rust`, `rdapify-pro`, or any downstream crate.**

This rule exists to ensure every outbound network call is subject to the full
security pipeline described below, including SSRF protection, DNS rebinding
defense, redirect validation, response-size limiting, and content-type
enforcement.

---

## Primary API

```rust
use rdap_security::{secure_fetch, HttpSecurityPolicy};
use url::Url;

let client = reqwest::Client::builder()
    .redirect(reqwest::redirect::Policy::none())   // required
    .build()?;

let bytes = secure_fetch(
    &client,
    Url::parse("https://rdap.verisign.com/com/v1/domain/EXAMPLE.COM")?,
    &HttpSecurityPolicy::default(),
)
.await?;
```

The `reqwest::Client` **must** be configured with
`redirect::Policy::none()` so that redirects are intercepted and re-validated
by `secure_fetch` rather than followed transparently.

---

## Security layers

| # | Check | Module | Default |
|---|-------|--------|---------|
| 1 | URL scheme must be `https` | `url` | enforced |
| 2 | No embedded credentials | `url` | enforced |
| 3 | Host must not be `localhost` or an IP literal in a blocked range | `url` + `ip` | enforced |
| 4 | DNS resolution — all resolved IPs validated before TCP connect | `dns` | enforced |
| 5 | Redirect chain — each hop re-runs checks 1–4 | `redirect` | up to 5 hops |
| 6 | Response `Content-Type` must be `application/rdap+json` or `application/json` | `content_type` | enforced |
| 7 | Response body truncated at `max_response_size` | `limits` | 5 MiB |
| 8 | Per-request timeout | `http_policy` | 15 s |

### Blocked IP ranges

IPv4: `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`,
`169.254.0.0/16` (incl. `169.254.169.254` cloud-metadata), `0.0.0.0/8`

IPv6: `::1`, `fc00::/7`, `fe80::/10`

---

## Backward-compatible guard

`SsrfGuard` / `SsrfConfig` are retained for use in `rdap-core`. They provide
synchronous URL-level SSRF protection (no DNS resolution). New code must use
`secure_fetch`.

---

## Enforcement

- Code review must reject any PR that introduces a direct `reqwest` call
  outside `rdap-security`.
- `cargo clippy` in CI will flag `#![forbid(unsafe_code)]` violations.
- The `security-auditor` agent reviews this crate before every release.
