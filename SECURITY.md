# Security Policy

RDAPify is a library that makes outbound network requests on behalf of applications, querying RDAP servers operated by public internet registries. Because of this network role, security is a first-class design concern: SSRF protection, strict input validation, PII redaction, and circuit breaking are enabled by default.

This document covers the **`rdapify` npm package** (open-source core, MIT license). For the commercial `@rdapify/pro` plugin — which adds license validation, payment webhook handling, and billing integration — see [`@rdapify/pro` Security Policy](https://github.com/rdapify/RDAPify-Pro) (private repository; contact security@rdapify.com for access).

---

## 1. Supported Versions

| Version     | Supported            | Notes                                              |
| ----------- | -------------------- | -------------------------------------------------- |
| 0.3.x       | ✅ Active support    | Current stable — all fixes applied here first      |
| 0.2.x       | ✅ Security fixes    | Previous minor — critical fixes backported when feasible |
| 0.1.x       | ❌ End of life       | No further updates; upgrade to 0.3.x               |
| 0.1.x-alpha | ❌ End of life       | Development-only; never intended for production    |

**Support policy (pre-1.0):** The current minor version receives full support. The immediately preceding minor version receives security-fix backports when technically feasible. Starting with v1.0.0, long-term support windows will be documented separately.

---

## 2. Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.** Public disclosure before a fix is available puts all users at risk.

### Reporting channels

| Channel | Use for | Acknowledgement target |
|---------|---------|------------------------|
| [GitHub Security Advisories](https://github.com/rdapify/rdapify/security/advisories/new) | All severities (preferred) | 48 hours |
| security@rdapify.com | All severities | 48 hours |
| emergency@rdapify.com | Critical or actively exploited | 4 hours |

GitHub Security Advisories are the preferred channel: they enable structured private disclosure, automatic CVE eligibility, and a private discussion space with maintainers.

### What to include

- **Description:** Clear explanation of the vulnerability and how it can be triggered
- **Impact:** What an attacker could achieve (data access, request forgery, denial of service, etc.)
- **Reproduction:** Step-by-step instructions; proof-of-concept code if available
- **Affected versions:** Which version(s) you tested against
- **Suggested fix:** Optional, but always appreciated

---

## 3. Security Scope

The following components are considered security-sensitive in this repository. Reports about any of these are treated as security issues, not bug reports.

| Component | What we protect against |
|-----------|------------------------|
| **SSRF protection** (`SSRFProtection`) | Private/loopback/link-local IP bypass; protocol smuggling; DNS rebinding |
| **Input validation** | Injection via malformed domain, IP, ASN, or entity handle inputs |
| **RDAP response handling** | Malformed JSON; unexpected `objectClassName`; oversized payloads |
| **Caching layer** | Cache key collision; poisoning via crafted RDAP server responses; TTL manipulation |
| **PII redaction** | Data surviving redaction unintentionally; `redactPII` bypass |
| **Telemetry system** (`UsageTelemetry`) | Opt-in bypass; PII leaking into telemetry pings |
| **Native bindings** (`rdapify-nd`) | FFI boundary memory safety; unexpected panics crossing the boundary |
| **TLS / HTTPS enforcement** | Certificate validation weakening; HTTP downgrade |
| **Rate limiter** | Bypass vectors; integer overflow in sliding-window counters |
| **Circuit breaker** | State manipulation that forces permanently open or closed circuits |
| **Cryptographic implementations** | HMAC comparisons (timing attacks); key handling in cache implementations |

**Out of scope for this repository:**

- License key generation, validation, and activation → `@rdapify/pro`
- Paddle payment webhook handling → `@rdapify/pro`
- Cloudflare Worker license API → contact security@rdapify.com

---

## 4. Security Practices

### SSRF protection

`SSRFProtection` validates every outbound URL before any network call. Blocked ranges:

- **RFC 1918 private:** 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
- **Loopback:** 127.0.0.0/8, ::1
- **Link-local:** 169.254.0.0/16, fe80::/10
- **Multicast and reserved:** 224.0.0.0/4 and others

Protocol enforcement: only `https:` and `http:` are permitted. `file:`, `data:`, `javascript:`, and other schemes are rejected before any DNS resolution.

### Input validation

All inputs are validated and normalized before reaching the network layer. Malformed inputs throw `ValidationError` and never produce an outbound request. Validation covers domains (FQDN + IDN/Punycode), IPv4, IPv6, ASNs, nameservers, and entity handles.

### RDAP response handling

Response JSON is parsed and validated against the expected `objectClassName`. Unexpected structure throws `ParseError`. There is no `eval` or dynamic code execution in the response path.

### Telemetry is opt-in and PII-free

`UsageTelemetry.ping()` is a no-op until `UsageTelemetry.enable()` is explicitly called. Telemetry payloads contain: an anonymous install ID (randomly generated UUID), library version, platform, and Node.js version. No query inputs (domain names, IP addresses) are ever included.

### HTTPS-only for RDAP registries

All RDAP bootstrap server URLs are HTTPS. The `Fetcher` class does not disable or weaken TLS certificate validation.

### Dependency scanning

`npm audit` runs on every CI push. Dependabot is enabled for automated pull requests on security-relevant dependency updates.

### Security test suite

`npm run test:security` covers SSRF bypass attempts (private IP variants, protocol smuggling), input injection, and cache behavior under adversarial inputs.

---

## 5. Key Rotation & Revocation

The `rdapify` open-source library does not manage or distribute cryptographic keys. There is no shared secret between library installations.

**Persistent cache encryption (user-configured):** If users configure an encrypted persistent cache adapter, the encryption key lives entirely in their own environment. Rotating it requires clearing the cache; no coordination with other installations is needed.

For **license key** rotation and revocation in `@rdapify/pro`, see the [Pro Security Policy](https://github.com/rdapify/RDAPify-Pro) or contact security@rdapify.com.

---

## 6. Disclosure Policy

RDAPify follows coordinated responsible disclosure:

1. **Reporter submits** a vulnerability report via GitHub Advisories or email
2. **Acknowledgement** within 48 hours (4 hours for emergency@rdapify.com)
3. **Severity triage** within 7 days; reporter is informed of the assessment
4. **Fix developed** in a private fork; reporter may be invited to review
5. **Security release published** — patch version with a `### Security` entry in CHANGELOG
6. **Advisory published** simultaneously on GitHub Security Advisories; CVE requested if applicable
7. **Reporter credited** by name or handle (unless anonymity is requested)

**Maximum embargo: 90 days** from the date of initial report. If no fix is available at 90 days, a limited advisory describing the risk and available mitigations is published regardless.

**Patch timeline targets by severity:**

| Severity | Examples | Target |
|----------|---------|--------|
| Critical | SSRF bypass, RCE, data exfiltration | 7 days |
| High | DoS, sensitive data exposure, auth bypass | 14 days |
| Medium | Cache poisoning, information disclosure in errors | 30 days |
| Low | Documentation with security implications, non-exploitable edge cases | Next release |

---

## 7. Security Updates

Security fixes are released as **patch versions** (e.g., 0.3.2 → 0.3.3).

Critical vulnerabilities may trigger an **out-of-band release** independent of the normal release schedule. These are announced immediately via GitHub Security Advisories.

Every security release includes:
- A `### Security` section in [`CHANGELOG.md`](CHANGELOG.md) describing the fix and affected versions
- A published [GitHub Security Advisory](https://github.com/rdapify/rdapify/security/advisories)
- An npm security advisory (for CVE-eligible issues)

**Subscribe to security notifications:**
- GitHub: Watch this repository → "Security alerts only"
- npm: Run `npm audit` in your project after updating; or subscribe to the advisory feed

---

## Security Architecture Reference

| Document | Contents |
|----------|----------|
| [`security/whitepaper.md`](security/whitepaper.md) | Full security whitepaper |
| [`security/threat_model.md`](security/threat_model.md) | STRIDE threat model |
| [`security/audit_reports/`](security/audit_reports/) | Third-party audit reports |

---

> Last reviewed: 2026-03-25 · security@rdapify.com
> RDAPify is provided under the MIT License. See [LICENSE](LICENSE) for full terms.
