# RDAPify — Known Limits

> **Purpose**: surface the limits that an operator needs to understand
> before deploying the engine. None of these are "bugs" — they are
> deliberate trade-offs documented here so the operator can size their
> deployment and choose between rdapify and a future enhancement
> accordingly.

---

## L1. The cache is in-memory only — no persistence

**What it means**: When the process restarts, every cached response is
lost. The next query for any cached domain will incur a fresh upstream
RTT until the cache re-warms.

**Why**: The cache is a `DashMap<String, Entry>` in process memory. We
deliberately did not bolt on a disk-backed or distributed cache for v1.0
because:
- Disk persistence makes the cache the source-of-truth for stale data
  semantics, which is a correctness landmine.
- Distributed caches (Redis / memcached) trade latency for capacity —
  rdapify's cache hits are sub-microsecond; a Redis round-trip is at
  least 100× slower.
- The IANA-assigned `Cache-Control: max-age` for most RDAP registries is
  in the 1 hour range; the warm-up cost amortises quickly under sustained
  load.

**What to do**:
- For low-traffic deployments: accept the warm-up cost.
- For high-traffic shared deployments: deploy multiple replicas behind a
  load balancer with a hash-based sticky session per domain (so the
  same domain always hits the same replica's cache).
- For multi-region or multi-process cache sharing: build a cache layer
  *outside* rdapify (e.g. a thin Redis pre-cache in your application).
  The engine's API is designed for this — the
  `RdapClient::*` methods take simple inputs and return parsed types.

The persistence backends in `rdap-{sqlite,postgres,mysql}` are
**audit-log** crates (history of queries), not response caches. They
do not change this property.

---

## L2. Upstream concurrency is a single global semaphore — no per-host fairness

**What it means**: When you set `concurrency_limit = 256`, that's
**process-wide** — across all upstream registries. A spike of 256
concurrent queries against a single slow .com registry will saturate
the cap and stall queries to .net, .org, etc., even though those
upstreams are healthy.

**Why**: A simple, observable, bounded permit pool is dramatically
easier to reason about and metric than a per-host fairness scheme.
For most workloads this is the right trade-off — the typical user is
querying a small handful of TLDs and the cap is sized for upstream
total capacity, not per-host capacity.

**What it doesn't mean**: this is **not** the same as a retry storm or
breaker flap. The semaphore queues internally; backoff sleeps drop the
permit; circuit-breaker open events still fail-fast without consuming
the cap.

**What to do**:
- If you query many TLDs concurrently: tune `concurrency_limit` upward
  toward the per-host total, accepting that one slow upstream can
  consume a larger share of the cap.
- If you need strict per-host isolation: run separate `Fetcher`
  instances per upstream class. The
  `Fetcher::with_full_dependencies` constructor lets you pass an
  external `Arc<Semaphore>`, which lets you build a multi-fetcher
  setup with one semaphore per host class.
- Per-host *rate* limiting (different from concurrency) **is**
  available: the `rdap-rate-limit` crate provides per-host GCRA
  limiters. Enable it via the `rate-limit` feature.

A future minor release may add per-origin sub-pools as an opt-in
config; the current contract is: **one global semaphore**.

---

## L3. Concurrency is static — no adaptive sizing

**What it means**: The semaphore size is fixed at construction. The
engine does not raise or lower it based on observed upstream
behaviour, success rate, or latency.

**Why**: Adaptive concurrency (TCP-BBR-style, BIC-style, AIMD) is
notoriously hard to tune in a way that doesn't hurt as often as it
helps. Without a control loop the operator's tuning intent is
preserved across deploys; with one, a misbehaving upstream can drag
the cap toward zero and cause a self-induced outage.

**What to do**:
- Right-size the cap for your sustained workload (Stage E benchmarks
  and `loadtest/` are designed for this exact tuning task).
- If you observe steady-state queueing on the cap (`rdap_inflight_requests`
  near `concurrency_limit`, `rdap_slow_requests_total` climbing), that's
  the signal to raise the cap by ~ 1.5× and re-measure.
- If you observe upstream 5xx / timeouts climbing under load, the
  upstream is the bottleneck, not the cap; lowering the cap will reduce
  the failure rate but won't change throughput.

---

## L4. Bootstrap is fetched on first use — first-call latency includes IANA RTT

**What it means**: `RdapClient::new()` is fast (no network), but the
first query against an unfamiliar TLD triggers an IANA bootstrap
fetch (~ 100–300 ms). Subsequent queries against any TLD in the
same bootstrap registry are instant.

**Why**: Eager IANA fetches at startup add fragility — the engine
can't start if IANA is briefly unreachable.

**What to do**:
- For service-mode deployments expecting steady traffic: warm the
  bootstrap by issuing one query per top-N TLD at startup. The
  registry caches the result for `bootstrap_refresh_hours` (default
  24).
- The first cold call may exceed the engine's own latency SLO by
  the bootstrap RTT; this is amortised across the next thousands
  of queries.

---

## L5. SSRF guard is on by default but does NOT reach the connection layer

**What it means**: The SSRF guard validates the resolved URL **before**
the fetch begins. It blocks private IPs, loopback, link-local, and
RFC 1918 ranges. However, it does **not** intercept post-DNS
re-resolution: a TOCTOU between `validate()` and the actual
`reqwest::get()` is theoretically possible if a public hostname is
re-resolved to a private IP between validation and connect.

**Why**: Hooking reqwest's connector to enforce IP-level checks at
connect time is possible but adds significant complexity. The
v1.0 surface validates at the URL boundary, which is correct for
the typical RDAP flow (server URLs come from the IANA bootstrap
registry, which won't return private addresses).

**What to do**:
- Deploy in an environment where outbound network egress to private
  ranges is firewalled at the kernel / network layer. This is the
  defence-in-depth posture; the SSRF guard is the application layer.
- If you control the bootstrap registry (custom URLs via
  `ClientConfig::custom_bootstrap_servers`), audit the URLs you
  inject — the guard will refuse private IPs there too, but
  hostnames that *resolve to* private IPs slip through the URL-only
  check.

---

## L6. Metrics surface is not a feature-frozen contract pre-1.0

**What it means**: The `rdap_*` Prometheus metrics shipped in Stage D
(see `RDAPify-Internal/DECISIONS.md` D-008) are the engine's first
public Prometheus surface. The metric names are stable and committed,
but **histogram buckets, label cardinality, and the set of metrics
themselves** may grow in minor releases. We will not silently rename
existing metrics; we may add new ones.

**What it doesn't mean**: this is **not** an excuse to break
dashboards. The names listed in `docs/SLO.md` are the v1.0 contract.

---

## L7. No built-in distributed tracing exporter

**What it means**: `tracing` spans are emitted in JSON / text via
`rdap-logging`. There's no built-in OpenTelemetry / OTLP exporter.

**What to do**: If you need distributed tracing, install your own
`tracing-subscriber` layer (tracing-opentelemetry, tracing-honeycomb,
etc.) before constructing the `RdapClient`. The engine's spans
(`rdap.query`, `rdap.fetch`) are correctly nested and will flow
through any subscriber.

---

## L8. The Apache-2.0 core is stand-alone — Pro features are not in this repo

**What it means**: Background monitoring, webhooks, license validation,
and analytics are in the proprietary `rdapify-pro` crate. Trying to
enable those features via the rdapify facade's `monitoring` /
`webhooks` / `analytics` / `history` feature flags **does nothing** —
those flags exist as namespace placeholders only.

**What to do**: Use the open-core engine for query, cache, breaker,
metrics, and tracing. For production monitoring features, contact
the RDAPify Pro team.

---

## Limits we explicitly do NOT have

For clarity, here are limits that may surprise operators coming from
WHOIS or other RDAP libraries — but that rdapify *does* address:

| Concern | Status |
|---|---|
| Unbounded breaker registry growth | **Bounded** — 1 024-cap moka LRU + 10-min idle TTL |
| Unbounded retry under sustained 5xx | **Bounded** — `retry_limit_429 = 3`, `retry_limit_5xx = 2`, breaker trips on 5 consecutive |
| Unbounded refresh stampede on cache stale | **Bounded** — `try_acquire_refresh` single-flight + `MAX_INFLIGHT_REFRESHES = 4 096` cap |
| Unbounded JSON depth on response parse | **Bounded** — `RdapValidationLimits` enforces nesting + array sizes |
| Unbounded response body size | **Bounded** — `read_limited` with `max_response_size_mb` config |
| `Retry-After` header ignored | **Honoured** — verified by Stage E E5 (p50 = 2 × `Retry-After`) |
| Random domain → unbounded breaker thrash | **Idempotent** — breaker is per-origin, not per-domain |
| Cache stampede under thundering herd | **Bounded** — single-flight collapse verified at 1.00× fan-out factor in Stage E E2 |

Each line is a Stage B/C/D test. See `loadtest/reports/STAGE_E_SLO_REPORT.md`
for the validations.
