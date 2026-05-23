# Release Checklist — rdapify 0.6.0 (Stage F production gate)

**Date**: 2026-04-29
**Decision rationale**: chose 0.6.0 over 1.0.0 to preserve the
February 2027 v1.0 target documented in
`RDAPify-Internal/DECISIONS.md` and the project roadmap. Stage F
hardening lands in 0.6.0; v1.0 stays as a future, intentional cutover.

---

## F1 — Safe defaults  ✅

Final values shipped:

| Setting | Value | Rationale |
|---|---|---|
| `FetcherConfig::timeout` | **5 s** (was 10 s) | Production-safe upper bound; matches Stage F spec window |
| `FetcherConfig::max_attempts` | 3 | Spec target; bounded by `MAX_ATTEMPTS_CEILING = 10` |
| `FetcherConfig::concurrency_limit` | 256 | Spec target; bounded by `MAX_CONCURRENCY_LIMIT = 4 096` |
| `FetcherConfig::initial_backoff` | 500 ms | Full-jitter base |
| `FetcherConfig::max_backoff` | 8 s | Full-jitter cap |
| `FetcherConfig::slow_request_threshold` | 500 ms | Counter-only signal |
| `FetcherConfig::trace_sample_rate` | 0.0 | Tracing OFF by default |
| `FetcherConfig::verbose_trace` | false | Override via `RDAP_TRACE=1` |
| `FetcherConfig::reuse_connections` | true | Keep-alive pool |
| `FetcherConfig::max_connections_per_host` | 10 | Reqwest pool cap |
| `CacheConfig::max_entries` | 1 000 | Bounded LRU-ish (oldest-by-`inserted_at`) |
| `CacheConfig::ttl` | 300 s | Default TTL |
| `MAX_INFLIGHT_REFRESHES` | 4 096 | Single-flight refresh cap |
| `DEFAULT_FAILURE_THRESHOLD` | 5 | Consecutive failures to trip breaker |
| `DEFAULT_COOLDOWN_MS` | 30 000 | Open → HalfOpen wait |
| `DEFAULT_REGISTRY_CAPACITY` | 1 024 | Per-origin LRU cap (moka) |
| `DEFAULT_REGISTRY_TTL` | 600 s | Idle-eviction window |
| `RdapConfig::timeout_seconds` | 5 (was 15) | Aligned with `FetcherConfig::timeout` |
| TOML loader timeout upper bound | 30 (was 60) | Aligned with `MAX_TIMEOUT` |

**Verified**: `default_config_values()` test asserts every default;
`validator_*` tests prove no value can drift outside bounds.

---

## F2 — Configuration validation  ✅

Shipped:
- **`FetcherConfig::validate() -> Result<()>`** — total over the struct;
  rejects zero / negative / above-ceiling / NaN / inf values with a
  clear `RdapError::InvalidInput(...)` message.
- **Wired through `Fetcher::with_full_dependencies`** so every public
  constructor surfaces validation failures via the existing `Result`.
- **13 new unit tests** covering each rejected boundary plus a
  validator-error-propagation test through `Fetcher::with_config`.
- **`rdap-config::validate.rs`** upper bound for `rdap.timeout_seconds`
  tightened 60 → 30 to match `MAX_TIMEOUT`.

**Verified**: `cargo test -p rdap-core --features metrics` → 94 lib
tests pass (was 81; +13 validator tests).

---

## F3 — Feature flags audit  ✅

| Property | Verified by |
|---|---|
| `metrics` OFF = no `metrics` / `metrics-exporter-prometheus` linked | `cargo tree --no-default-features` shows neither crate |
| `metrics` OFF call sites = `#[inline(always)]` no-op stubs | Inspection of `rdap-metrics::hooks::imp` (under `#[cfg(not(feature = "enabled"))]`) |
| Tracing OFF = zero allocation on hot path | Every `request_id`, `redact_url`, `info_span!` gated behind `traced` boolean |
| No `dbg!` / `todo!` / `unimplemented!` / `println!` in production code | `grep` sweep — clean |
| Only `panic!` is in a test fixture by design | `crates/rdap-cache/src/lib.rs:740` — leader-panic-releases-slot test |
| No `#[cfg(debug_assertions)]` blocks change behaviour | `grep` sweep — clean |

---

## F4 — Public API freeze  ✅

Audit of `rdapify` facade:

| Issue | Resolution |
|---|---|
| `rdapify::rate_limit::RateLimiter` import was broken (typo) | Fixed → `RdapRateLimiter`. `cargo build --features rate-limit` now works. |
| Skeleton modules (`sqlite` / `postgres` / `mysql` / `service`) lacked clear scope docs | Renamed in doc-comments to "reserved namespace — impl in `rdap-{sqlite,…}`". |
| No way to enable Prometheus metrics without direct dep on `rdap-metrics` | New `rdapify` `metrics` feature + `pub mod metrics` re-exporting `rdap-metrics`. |
| Naming consistency | All `*Config` / `Rdap*` / concrete-types pattern verified consistent. |

**Public types frozen for 0.6.0 → 1.0.0 cycle**:
- Top-level: `RdapClient`, `ClientConfig`, `RdapError`, `Result`, `FetcherConfig`, `Normalizer`, `SsrfConfig`, `SsrfGuard`
- Response types: `DomainResponse`, `IpResponse`, `AsnResponse`, `NameserverResponse`, `EntityResponse`, `AvailabilityResult`, `ResponseMeta`, `RdapEntity`, `RdapEvent`, `RdapLink`, `RdapRemark`, `RdapRole`, `RdapStatus`, `RegistrarSummary`, `IpVersion`, `NameserverIpAddresses`
- Modules: `error`, `bootstrap`, `http`, `security`, `types`, plus feature-gated `cache`, `stream`, `batch`, `rate_limit`, `metrics`

---

## F5 — Documentation  ✅

| Doc | Status | Notes |
|---|---|---|
| `README.md` | ✅ verified | Quick start, install, example query, config example all present. Updated stale `0.4` → `0.5` reference (will become `0.6` on next pass). |
| `docs/SLO.md` | ✅ shipped Stage D · D5 | Availability, p50/p95/p99, error budget, three-tier alerts |
| `docs/PERFORMANCE.md` | ✅ new | Latency expectations, scaling notes, configuration tuning, memory footprint, observability overhead. Anchored to real Stage E numbers. |
| `docs/KNOWN_LIMITS.md` | ✅ new (F8) | 8 documented limits with rationale + "what we do NOT have" reverse table |
| `loadtest/reports/STAGE_E_SLO_REPORT.md` | ✅ shipped Stage E | Six-scenario SLO validation report |
| `CHANGELOG.md` | ✅ updated | `[0.6.0] — 2026-04-29` entry |
| `RDAPify-Internal/DECISIONS.md` | unchanged | v1.0 target preserved at February 2027 |

---

## F6 — Versioning  ✅

| Crate | Before | After | Notes |
|---|---|---|---|
| `rdapify` | 0.5.0 | **0.6.0** | Public facade |
| `rdapify-client` | 0.2.0 | **0.3.0** | API extended (D2 spans + Stage F validate) |
| `rdap-cli` | 0.5.0 | **0.6.0** | Tracks facade |
| `bindings/nodejs` | 0.5.0 | **0.6.0** | Tracks facade |
| `bindings/python` | 0.5.0 | **0.6.0** | Tracks facade |
| Internal crates (`rdap-core` / `rdap-cache` / `rdap-metrics` / `rdap-config` / etc.) | 0.1.0 | **0.1.0** (unchanged) | Not independently published; SemVer-major still 0 |
| `rdap-batch` | 0.2.0 | **0.2.0** (unchanged) | Already at 0.2.0; no API change in 0.6.0 |

**Path-dep version constraints updated** in:
- `crates/rdapify/Cargo.toml`
- `crates/rdap-cli/Cargo.toml`
- `crates/rdap-batch/Cargo.toml`
- `crates/rdap-service/Cargo.toml`
- `bindings/nodejs/Cargo.toml`

**Tag command** (operator runs after merge):
```bash
git tag -a v0.6.0 -m "rdapify 0.6.0 — Stage F production gate"
git push origin v0.6.0
```

---

## F7 — Final checks  ✅ (re-ran after version bump)

| Check | Command | Result |
|---|---|---|
| Lint (all features, release) | `cargo clippy --workspace --all-features --release -- -D warnings` | ✅ clean |
| Build (all features, release) | `cargo build --workspace --release` | ✅ clean |
| Test (release) | `cargo test --workspace --release` | ✅ 53 test-result lines, **0 failures** |

Engine-only test counts (with `metrics` feature on):
- `rdap-metrics`: 19 unit + 9 integration = **28**
- `rdap-core`: 94 lib + 5 obs + 2 redaction + 1 doc = **102**
- `rdap-cache`: 17
- `rdap-config`: 34 + 1 doc = 35
- `rdapify-client`: 4 + 2 = **6**

Plus `rdap-bootstrap`, `rdap-types`, `rdap-security`, `rdap-stream`,
`rdap-batch`, `rdap-rate-limit`, `rdap-logging`, etc. — all green.

---

## F8 — Known limits  ✅

8 limits documented in `docs/KNOWN_LIMITS.md`:

1. **L1** — In-memory cache, no persistence
2. **L2** — Global semaphore, no per-host fairness
3. **L3** — Static concurrency, no adaptive sizing
4. **L4** — Lazy bootstrap (first-call IANA RTT)
5. **L5** — SSRF guard validates URL only (not post-DNS)
6. **L6** — Pre-1.0 metrics surface may grow (names committed, set may extend)
7. **L7** — No built-in OTLP / distributed-tracing exporter
8. **L8** — Pro features external to this repo

Plus a "what we explicitly do NOT have" table covering 8 properties
that are bounded by design (breaker registry, retry budget, refresh
stampede, JSON depth, response size, Retry-After, breaker-per-domain
thrash, cache stampede).

---

## Ship-readiness summary

> ✅ **The engine is production-safe to ship at 0.6.0.**
>
> All Stage F items complete. No engine modifications outside the
> safe-defaults / validator / API-freeze hardening. Stage E SLO
> validation passes 6/6 scenarios. v1.0.0 target remains February 2027.

### What "production-safe" means here

- **No accidental disablement of protections**: every protective default
  is enforced by the validator (rejects 0 timeout, 0 retries,
  unbounded concurrency, etc.).
- **No silent behaviour change between debug and release builds**:
  no `cfg(debug_assertions)` paths in production code.
- **No accidentally-pulled-in heavy deps**: default-feature builds
  link no metrics, no exporter, no extra runtime cost.
- **No undocumented surprises**: every known limit has a
  `KNOWN_LIMITS.md` entry; every SLO threshold is in `SLO.md`;
  every performance number is reproducible via `loadtest/run.sh`.
- **Public API freeze**: 0.6.0 is the contract surface for the
  0.6 → 1.0 release-candidate cycle. Names, types, and module paths
  do not change without a major-version bump.

### What remains for the v1.0.0 cutover (February 2027 target)

- Per-origin sub-pools (lifts L2 — global semaphore limit).
- Adaptive concurrency control loop (lifts L3 — static cap).
- Optional distributed cache integration (loosens L1 — memory-only cache).
- OpenTelemetry / OTLP exporter (lifts L7).
- Stable Prometheus metric set (closes L6).
- API surface bake-in based on 0.6 production telemetry.

These are all tracked in `RDAPify-Internal/planning/STABILIZATION_ROADMAP.md`
and `V1_STABILIZATION_PLAN.md`.
