# RDAPify: Comparison and Positioning

This document provides a comprehensive overview of how RDAPify compares to raw RDAP, WHOIS tools, other libraries, and in-house solutions. For detailed benchmarks, migration paths, and protocol-level analysis, see the comparison guides in `docs/comparisons/`.

---

## RDAPify vs Raw RDAP

Raw RDAP is the protocol; RDAPify is the platform built on top of it.

| Feature          | Raw RDAP | RDAPify |
|------------------|----------|---------|
| RDAP query       | Yes      | Yes     |
| Caching          | No       | Yes     |
| Rate limiting    | No       | Yes     |
| Batch queries    | No       | Yes     |
| Monitoring       | No       | Yes     |
| Change detection | No       | Yes     |
| Webhooks         | No       | Yes     |
| Metrics          | No       | Yes     |
| Docker           | No       | Yes     |
| CLI              | No       | Yes     |
| Service mode     | No       | Yes     |

Raw RDAP gives you a lookup; RDAPify gives you observability, automation, and production-grade operations around that lookup. With RDAPify, you get caching to reduce redundant queries, rate limiting to stay within server quotas, change detection to track meaningful updates, and webhooks to trigger downstream automation. For any workload beyond one-off queries, RDAPify handles the operational burden that raw protocol clients leave to you.

---

## RDAPify vs WHOIS Tools

WHOIS is a legacy plain-text protocol; parsing it requires custom, fragile code per registrar. RDAP (RFC 7480/7483) returns structured JSON with a standardized schema—consistent across registries. RDAP natively exposes events (expiry, registration, last changed), status flags, and contacts in a machine-readable format. RDAPify adds monitoring, change detection, webhooks, and automation on top of RDAP.

For new projects, there is no reason to use WHOIS. RDAP is the IANA-mandated successor and is universally supported across domain and IP registries. If you are maintaining legacy WHOIS integrations, plan a migration to RDAPify—the effort is modest, and the payoff is immediate.

See [vs-whois.md](comparisons/vs-whois.md) for a detailed protocol and feature comparison.

---

## RDAPify vs Python RDAP Libraries

Python packages such as `python-rdap`, `ipwhois`, and `rdap` (PyPI) are thin RDAP/WHOIS client wrappers. They do a lookup and return data—nothing more. If all you need is a one-off query, one of these libraries is fine. If you need continuous monitoring, alerting, or automation, RDAPify is purpose-built for that.

| Capability       | python-rdap / ipwhois / rdap | RDAPify |
|------------------|------------------------------|---------|
| RDAP lookup      | Yes                          | Yes     |
| Caching          | No                           | Yes     |
| Monitoring       | No                           | Yes     |
| Webhooks         | No                           | Yes     |
| Metrics          | No                           | Yes     |
| Service/API mode | No                           | Yes     |
| Docker           | No                           | Yes     |
| License system   | No                           | Yes (Pro) |

Similarly, Node.js libraries like `node-rdap` and `@netlify/rdap` are single-purpose RDAP clients. They work fine for scripts and light integrations; RDAPify is for production workloads. RDAPify is available as an npm package, a Rust crate, and a Python package, making it accessible regardless of your tech stack.

See [vs-other-libraries.md](comparisons/vs-other-libraries.md) for a comprehensive library-level comparison.

---

## RDAPify vs Building In-House

Building a production-grade RDAP monitoring system from scratch is a multi-month engineering project. Below is a realistic effort estimate:

| Component         | Build yourself | RDAPify  |
|-------------------|----------------|----------|
| RDAP client       | ~1 week        | Built-in |
| Caching layer     | ~2 weeks       | Built-in |
| Change detection  | ~2 weeks       | Built-in |
| Monitoring/alerts | ~4 weeks       | Built-in |
| Webhooks          | ~2 weeks       | Built-in |
| Metrics (Prometheus) | ~2 weeks    | Built-in |
| Docker packaging  | ~1 week        | Built-in |
| Rate limiting     | ~1 week        | Built-in |
| License system    | ~4 weeks       | Built-in (Pro) |
| **Total**         | **~2–3 months**| **Day 1** |

These estimates assume an experienced engineer, no unplanned scope creep, and do not include ongoing maintenance, refactoring, or incident response. RDAPify ships all of this tested and production-ready. Your team can focus on your domain logic instead of plumbing.

---

## When to Use RDAPify

Use RDAPify if you need any of the following:

- Domain availability or expiry monitoring
- IP ownership and ASN monitoring
- Compliance tracking and asset inventory
- Security monitoring (detecting unauthorized transfers, status changes)
- Webhook-driven automation on RDAP events
- Batch RDAP queries at scale
- A high-performance RDAP client with caching and rate-limit awareness
- A self-hosted RDAP API service

If your use case is a single one-off lookup in a script, a thin library (e.g., `node-rdap`, `python-rdap`) may be sufficient. RDAPify is designed for production workloads that run continuously.

---

## Summary

RDAPify is not a client—it is an RDAP monitoring and automation platform. It handles the operational concerns (caching, rate limiting, change detection, alerting, metrics) that raw protocol clients leave to the caller. The comparison documents in `docs/comparisons/` provide benchmark data, protocol analysis, and migration guides for teams moving from existing tools.

### Related Documentation

- [vs-whois.md](comparisons/vs-whois.md) — detailed WHOIS vs RDAP protocol comparison
- [vs-other-libraries.md](comparisons/vs-other-libraries.md) — library-level comparison with Node.js and Python alternatives
- [benchmarks.md](comparisons/benchmarks.md) — performance benchmark results
- [migration-guide.md](comparisons/migration-guide.md) — migrating from WHOIS tools or other RDAP clients
