# Security Policy

## Supported Versions

| Version | Supported          | Notes                         |
| ------- | ------------------ | ----------------------------- |
| 0.2.x   | ✅ Active support  | Current stable (core + py)    |
| 0.1.x   | ❌ End of life     | Upgrade to 0.2.x              |

### Bindings

| Binding     | Version | Supported          |
| ----------- | ------- | ------------------ |
| rdapify-nd  | 0.1.3   | ✅ Active          |
| rdapify-py  | 0.2.1   | ✅ Active          |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Send a report to **security@rdapify.com** with:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You will receive a response within **48 hours**, and a patch within **7 days** for confirmed vulnerabilities.

## Security Features

- **SSRF Protection** — all outbound URLs are validated against private/loopback/link-local ranges before any network request
- **Zero OpenSSL** — uses `rustls` (pure Rust TLS), eliminating a large class of C-level vulnerabilities
- **No unsafe code** — `#![forbid(unsafe_code)]` enforced at the crate level
- **Dependency auditing** — `cargo-audit` runs on every CI push via GitHub Actions
