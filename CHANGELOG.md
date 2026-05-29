# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.0] — 2026-05-29 — Performance & Security Baseline

> **The consolidated pre-1.0 hardening release.** A full SSRF perimeter
> closure, a TinyLFU cache engine with intelligent TTL policy, protocol-correct
> ccSLD resolution, and a 3.4k-LOC tech-debt purge — shipped as a single
> reviewed, reproducible baseline. Stripped `rdapify` CLI: **3.48 MiB**
> (under the 4 MiB budget). **405 tests passing**, `clippy --all-targets` and
> `fmt` clean. Every security change was independently reviewed
> (security-auditor + rust-reviewer) before merge.
>
> No breaking changes to existing public APIs — all additions are additive.

### 🔒 Security Hardening

- **Audited egress on the hot path.** The core fetcher now routes every
  outbound request through `rdap_security::secure_request` — URL + DNS-resolved
  IP validation before connect, `redirect::Policy::none()`, and per-hop
  re-validation of the entire redirect chain. Closes the redirect-to-internal
  SSRF gap where the previous client auto-followed up to 10 unvalidated hops.
- **DNS connect-time pinning (rebinding TOCTOU closed).** A new `SecureResolver`
  (`reqwest::dns::Resolve`) validates the *exact* addresses reqwest connects to,
  rejecting the whole resolution if any IP is blocked. There is no longer an
  unvalidated second DNS lookup between the security check and the TCP connect.
  The egress client also sets `.no_proxy()` to prevent an ambient
  `HTTPS_PROXY`/`ALL_PROXY` from tunnelling around the resolver.
- **IPv4-mapped IPv6 normalization.** Addresses such as `::ffff:192.168.1.1`
  and `::ffff:169.254.169.254` are now canonicalized to their IPv4 form before
  classification, at every entry point (`is_blocked_ip` / `is_private_ip` /
  `is_loopback` / `is_link_local`) and in the `SsrfGuard` URL-literal path —
  closing a filter-bypass for loopback / RFC 1918 / link-local / metadata
  targets reached via a mapped address.
- **Bootstrap egress hardened.** IANA bootstrap downloads (including custom
  mirror URLs) now flow through the same `secure_request` pipeline as the
  primary fetch path — identical DNS-IP checks and redirect re-validation.
- **IP blocklist expanded (low-severity perimeter sweep).** `is_blocked_ip` and
  the `SsrfGuard` now also reject CGNAT `100.64.0.0/10` (RFC 6598), the NAT64
  prefixes `64:ff9b::/96` (RFC 6052) and `64:ff9b:1::/48` (RFC 8215), and the
  TEST-NET / documentation ranges `192.0.2.0/24`, `198.51.100.0/24`,
  `203.0.113.0/24` (RFC 5737). The `require_https` policy is now enforced
  fail-fast before any DNS lookup, and blocked-host errors were made generic to
  avoid leaking internal network topology.

### ⚡ Performance & Caching

- **Moka cache engine.** The response cache's hand-rolled `DashMap` store with
  an `O(n)` `evict_oldest` scan (quadratic degradation under write pressure) is
  replaced by `moka`'s concurrent cache: bounded capacity with **TinyLFU
  eviction (O(1) amortized)** and per-entry expiry. Values are `Arc`-wrapped to
  avoid per-hit entry copies. moka was already linked (via the circuit breaker),
  so the engine swap adds negligible binary weight.
- **Intelligent `CachePolicy`.** A formal TTL policy now governs caching:
  - Honors an upstream `Cache-Control: max-age` but **clamps it into a safe
    range** — a new **minimum floor** stops a hostile/misconfigured origin from
    forcing cache-busting (`max-age=0`/`1`) that would hammer upstreams; a
    maximum ceiling caps over-long pinning.
  - Falls back to **per-query-type defaults** when no usable hint is present:
    domains 1 h · IPs/ASNs 24 h · nameservers 6 h · entities 1 h.
  - Negative (404) caching at a 10-minute TTL to absorb repeated misses.

### 🏛️ Architecture & Hygiene

- **RFC 7484 ccSLD longest-match.** Bootstrap lookups now implement the
  RFC 7484 §3.2 longest matching label-suffix rule against an **O(1)
  `HashMap` index** built at parse time (Arc-shared — no per-query clones),
  replacing the previous single-label `extract_tld` + linear scan. Complex
  ccSLDs (`example.co.uk`, `sub.domain.com.sa`) now resolve to the correct
  IANA-published authority without misses.
- **Public Suffix List validation (opt-in).** Input hygiene against the PSL
  (reject bare public suffixes) is available behind a new **off-by-default
  `psl-validation` feature** — keeping the embedded PSL (~250 KB) out of the
  default binary to respect the size budget.
- **3,442 LOC of tech-debt purged.** The obsolete pre-modularization root
  `/src/` tree (a non-compiled orphan that duplicated logic now owned by the
  domain crates) was permanently removed — 22 files eliminating divergence risk.
- **Workspace cleanliness.** Full `cargo fmt` pass and a `clippy --all-targets`
  cleanup; the entire workspace is now warning-free under `-D warnings`.

### 📦 Release Engineering & Metrics

| Metric | Value |
|---|---|
| `rdapify` CLI (stripped release) | **3,650,440 B — 3.48 MiB** (✅ < 4 MiB budget) |
| Tests | **405 passing**, 18 ignored (network/soak), 0 failed |
| Lint / format | `clippy --all-targets --workspace -D warnings` clean · `fmt --check` clean |
| Release profile | `lto = true` · `codegen-units = 1` · `strip = true` · `panic = "abort"` · `opt-level = "z"` |

### Added

- `rdap_security::secure_request` and `SecureResolver` (public, additive).
- `rdap_cache::CachePolicy` (re-exported from the `rdapify` facade).
- `Bootstrap::set_egress_timeout` / `set_secure_egress`.
- `psl-validation` feature on `rdap-bootstrap` (off by default).

### Changed

- `rdap-cache` `MemoryCache` is now backed by `moka` (public API unchanged).
- Bootstrap server selection uses RFC 7484 longest-match over an O(1) index.
- Unified all workspace crate versions to `0.7.0`.

### Removed

- The orphan root `/src/` tree (22 files, 3,442 lines of dead code).

### Security

- Closes redirect-chain SSRF, DNS-rebinding TOCTOU, proxy-bypass, bootstrap
  egress bypass, and IPv4-mapped IPv6 filter evasion. All four areas reviewed
  by security-auditor and rust-reviewer prior to merge.

## [0.6.11] — 2026-05-01 — Per-origin inflight gauge (observability completeness)

> **Adds per-origin inflight gauge; intentional exception to the
> no-new-metrics freeze for observability completeness.**
>
> Across v0.6.6 → v0.6.10 the freeze rule "no new metrics" has been
> in force, with `prometheus-alerts.yaml`, `grafana-dashboard.json`,
> and `SLO.md` all byte-stable to v0.6.6. v0.6.11 deliberately crosses
> that freeze on **one metric only** — `rdap_per_origin_inflight{origin}` —
> after explicit operator authorisation. **Alert rules, SLO targets,
> and the Grafana dashboard remain byte-identical** to v0.6.6 baseline
> (verified end-of-release).

### Why this exception

The pre-v0.6.11 metric set covered every alert and runbook reference,
so the freeze was easy to maintain. The one operationally-useful
gauge missing was a **live per-origin inflight count** — the existing
`rdap_per_host_queue_depth` is an unlabelled histogram of queue
depth at acquire time, which doesn't answer the question "is origin
X currently saturated against its per-host cap?".

Operators can now answer that question directly without combining
three other signals:

```promql
rdap_per_origin_inflight / 16 > 0.9
```

### Added

- **Metric** `rdap_per_origin_inflight{origin}` — gauge, cardinality
  bounded by the per-host registry cap (≤ 1024 origins).
  - Constant: `rdap_metrics::hooks::names::PER_ORIGIN_INFLIGHT`
  - Hooks: `rdap_metrics::hooks::inflight_origin_inc(&str)` and
    `inflight_origin_dec(&str)` (real impls under feature `enabled`,
    `#[inline(always)]` no-ops otherwise).
  - Exporter description: `describe_gauge!` registered in
    `rdap-metrics::exporter`.
- **RAII guard** `OriginInflightGuard` in `rdap-core::fetcher`:
  - Constructed only in the `Some(_)` branch of the per-host
    semaphore acquire — i.e. when per-host gating is active. With
    `per_host_concurrency_limit = None`, the guard is never created
    and no labelled series is emitted.
  - Drops on every fetch exit path (success / retry-with-drop /
    error-final), guaranteeing balanced inc/dec.
  - Zero-sized struct under `cfg(not(feature = "metrics"))` — fields,
    construction, and Drop all elide under release + LTO. **No
    allocation in the hot path** when the metrics feature is off.

### Tests

- **Unit** (`rdap-metrics::tests::labels`):
  `inflight_origin_gauge_increments_decrements_per_label` — verifies
  per-label isolation (origin A inc doesn't affect origin B) and that
  balanced inc/dec returns the gauge to baseline.
- **Integration** (`rdap-core::tests::observability` with
  `--features metrics`):
  - `per_origin_inflight_returns_to_zero_after_success` — 5 sequential
    successful fetches, gauge returns to baseline.
  - `per_origin_inflight_returns_to_zero_after_retry_path` — fetcher
    configured with `max_attempts: 3` against a 500-returning server,
    gauge returns to baseline after the retry-with-drop path executes.
  - `per_origin_inflight_does_not_appear_when_per_host_disabled` —
    confirms `per_host_concurrency_limit = None` produces no labelled
    series.

All 387 existing tests continue to pass.

### Updated

- [`docs/observability/METRICS.md`](docs/observability/METRICS.md) —
  new section for `rdap_per_origin_inflight{origin}`; cardinality
  table updated to note the new label-bearing metric (4 breaker
  metrics + 1 inflight = 5 metrics now use the `origin` label).

### Constraint compliance

| Rule (carried forward from v0.6.10) | Status |
|---|---|
| `prometheus-alerts.yaml` byte-stable | ✓ MD5 still `da48204eb43f6cc770f18aca751a6148` |
| `grafana-dashboard.json` byte-stable | ✓ MD5 still `df43c2c3e22749cdf6e015528cd2c1c2` |
| `docs/SLO.md` byte-stable | ✓ MD5 still `e7f57bdd126e5c5cd10344d822c85f13` |
| Runbook §1–§5 content unchanged | ✓ |
| **No new metrics** | ❌ **deliberately broken** — see freeze exception above |
| No API-breaking changes | ✓ all existing public API preserved |
| No performance regression on hot path (metrics off) | ✓ cfg-gated guard is zero-sized when feature off; allocation only happens with feature on |
| Cardinality bounded | ✓ ≤ 1024 origins, same registry that bounds breaker labels |

### Version bumps

- `rdapify` 0.6.10 → 0.6.11
- `rdap-cli` 0.6.10 → 0.6.11
- `bindings/{nodejs,python}` 0.6.10 → 0.6.11
- `rdapify-client` **unchanged** at 0.3.2 (no source-code change)

### Note on v0.6.x tuning cycle — no-data, superseded by the 0.7.0 baseline release (2026-05-14)

> **Historical note (superseded).** The `v0.7.0` version number was
> originally reserved for a data-driven-tuning milestone that **never
> shipped** (the observation cycle below produced no data). That number
> is now claimed by the **0.7.0 Performance & Security Baseline release
> above**; this note is retained for audit continuity. The tuning cycle
> kept everything at 0.6.10 — it was not a release.
>
> **No release shipped.** This entry records that
> the v0.7.0 data-driven-tuning gate **was not met** in the
> 2026-05-01 → 2026-05-14 observation cycle. No version bump, no
> threshold changes, no SLO changes, no engine changes. State on
> disk is byte-identical to the end of v0.6.10.

#### What this entry records

- The **RDAPify v0.6.10 pipeline is implemented and ready** —
  end-to-end smoke tests pass; envelope-format
  `classification_candidates.json` round-trips through
  `build_tuning_report.sh` cleanly; freeze hashes for
  `prometheus-alerts.yaml`, `grafana-dashboard.json`, and
  `docs/SLO.md` all match the v0.6.6 baseline.
- **The pipeline has not been exercised on real production data.**
  An observation window was attempted (2026-05-01 → 2026-05-14) but
  produced no artefacts because the Prometheus endpoint configured
  for the cycle was unreachable from the host running the
  extraction. `tools/extract_tuning_data.sh` halted at the first
  curl, downstream steps refused to run, and the v0.6.6 calibration
  discipline (CALIBRATION.md §7.1) correctly blocked any
  TUNING_REPORT.md cell from being filled with estimated values.
- **Per [`docs/observability/TUNING_REPORT.md`](docs/observability/TUNING_REPORT.md)
  §F "Conclusion — No Data Cycle (v0.7.0 gate not met) — 2026-05-14"**:
  no tuning was performed, no classification was attempted, no
  decision is recorded for any alert.

#### What did not change

- No alert thresholds, severities, or `for:` windows.
- No SLO targets.
- No Grafana panels.
- No engine `.rs` modifications.
- No metric set additions.
- No runbook §1–§5 content edits.
- No version bumps in any Cargo.toml. The engine remains at
  `0.6.10`.

#### Audit evidence preserved

- `tuning-data-2026-05-01/MANIFEST.txt` — records the failed
  extraction invocation (recorded `prom_url`, `window`, timestamp).
  Kept on disk as evidence that the cycle was attempted, not
  deleted.
- `ops/incidents.md` — unchanged; 0 real entries logged for the
  window.
- All 15 runbook `## Feedback log` sections — unchanged; 0
  populated rows.

#### Next-attempt prerequisites

- Prometheus endpoint reachable from the host running the pipeline
  (DNS, VPN, auth, TLS).
- Re-start at Step 0 (connectivity verification) per
  [`ops/README.md`](ops/README.md) §1.
- Pin a fresh `WINDOW_START` / `WINDOW_END` for the new attempt;
  do not reuse the dates from this null cycle.

#### Constraint compliance

- **NO data fabrication** — every TUNING_REPORT cell that would
  describe production observations remains empty.
- **NO inferred values** — §F conclusion describes the absence of
  data, not fictional substitutes.
- **NO behaviour changes** — alert / SLO / dashboard / engine MD5s
  unchanged from v0.6.10.

## [0.6.10] — 2026-05-01 — Assisted classification (audit hardening)

> **Tooling-only release with a deliberate breaking change to the
> `classification_candidates.json` format.** Strengthens audit-grade
> traceability of the v0.6.9 assisted-classification flow. **No
> threshold changes. No SLO changes. No dashboard changes. No engine
> changes. No new metrics. No runtime dependencies.** Verified by
> byte-stable MD5 hashes for `prometheus-alerts.yaml`,
> `grafana-dashboard.json`, and `SLO.md` (still matching v0.6.6
> baselines).

### ⚠️ Breaking change — JSON output format

`classification_candidates.json` is **not backward-compatible**
with v0.6.9. v0.6.10 tools refuse to consume v0.6.9 files and
v0.6.9 tools cannot consume v0.6.10 files.

**Migration path**: re-run `tools/classify_alerts.sh` against the
same `extract_tuning_data.sh` output and the same
`ops/incidents.md`. The candidate counts will be identical — only
the *shape* of the JSON changes.

**Detection**: `tools/build_tuning_report.sh` v0.6.10 explicitly
detects a v0.6.9 array-shape input (top-level `[`) and exits with
diagnostic `"error: ... v0.6.10 build_tuning_report.sh requires
the envelope shape ..."`.

### Changed

#### 1. JSON envelope (was: top-level array)

**v0.6.9**:
```json
[ {...}, {...} ]
```

**v0.6.10**:
```json
{
  "generated_at": "2026-05-01T03:14:00Z",
  "window": "2026-04-17 → 2026-05-01",
  "alerts": [ {...}, {...} ]
}
```

The envelope carries `generated_at` (ISO 8601 UTC) and `window`
(concrete date range) at the document level. The per-alert object
still carries `alert / fires / candidates / evidence / confidence
/ note`, but no longer has its own `window` field (moved to the
envelope to avoid duplication).

#### 2. `window` is a concrete date range (was: Prometheus duration)

**v0.6.9**: `"window": "14d"`
**v0.6.10**: `"window": "2026-04-17 → 2026-05-01"`

The dates use the literal arrow `→` (U+2192). Derived from `WINDOW`
env var by default; pin both ends explicitly with `WINDOW_START` /
`WINDOW_END` for retrospective audits.

#### 3. Evidence references use timestamps (was: artefact IDs)

**v0.6.9**: `"evidence": ["incident:INC-001", ...]`
**v0.6.10**: `"evidence": ["incident:2026-04-30 14:32 UTC", ...]`

Each `incident:<timestamp>` entry references the heading
timestamp of an `ops/incidents.md` row. Two alerts that fired for
the same minute now share the same `incident:<timestamp>` evidence
string, making co-fire detection trivial.

#### 4. `note` casing standardised (uppercase REQUIRES)

**v0.6.9**: `"note": "SUGGESTION ONLY — requires human validation"`
**v0.6.10**: `"note": "SUGGESTION ONLY — REQUIRES HUMAN VALIDATION"`

The exact string is part of the schema contract. Tools must
preserve it byte-for-byte; downstream consumers MUST NOT alter or
strip it.

#### 5. §B draft uses per-field suggestion prefixes

**v0.6.9** (`build_tuning_report.sh` output):

```
| `RdapifyHighErrorRate` | suggested: 4 | suggested: 1 | suggested: 0 | suggested: 3 | medium | ... |
```

**v0.6.10**:

```
| `RdapifyHighErrorRate` | 4 | suggested_tp: 1 | suggested_fp: 0 | suggested_uncertain: 3 | medium | ... |
```

The `fires` column drops the `suggested:` prefix (it's a measured
count, not a suggestion). Each candidate count gets an explicit
field-named prefix so the operator can't accidentally copy a TP
into the FP column.

### Added

- **`WINDOW_START` / `WINDOW_END` env vars** in `classify_alerts.sh`
  for retrospective audits (e.g. *"re-classify the window
  2026-04-01 → 2026-04-15"*). Validated as ISO dates; non-parseable
  values exit 64.
- **Envelope provenance** in the §B draft markdown header — the
  `Generated:` and `Window:` lines now come from the envelope so
  the draft's source is unambiguous.
- **Schema rev 2** entry in `DATA_MODEL.md` §6, plus a §7 migration
  section explaining what changed and why.

### Updated

- [`tools/classify_alerts.sh`](tools/classify_alerts.sh) — full
  rewrite for envelope output. Awk-based incidents.md parser now
  captures the heading timestamp into a per-row TSV column.
- [`tools/build_tuning_report.sh`](tools/build_tuning_report.sh) —
  reads envelope; detects and rejects v0.6.9 array format with a
  loud diagnostic.
- [`docs/observability/DATA_MODEL.md`](docs/observability/DATA_MODEL.md)
  — schema rev 2; §1 envelope overview, §2 field reference, §3
  hard constraints, §4 JSON Schema 2020-12 draft, §6 versioning
  table (rev 1 → rev 2), §7 migration, §8 three sample valid
  documents (envelope shape).
- [`docs/observability/CLASSIFICATION_REVIEW.md`](docs/observability/CLASSIFICATION_REVIEW.md)
  — §3.2 cross-check procedure now anchors on
  `incident:<timestamp>`; §4.1–§4.4 examples updated to envelope
  shape and uppercase `note`.
- [`docs/observability/TUNING_WORKFLOW.md`](docs/observability/TUNING_WORKFLOW.md)
  — Step 2.5 now mentions the envelope shape, the uppercase note,
  and the per-field `suggested_tp:` / `suggested_fp:` /
  `suggested_uncertain:` prefixes.

### Constraint compliance — verified

| Rule | Status | Evidence |
|---|---|---|
| No `prometheus-alerts.yaml` changes | ✅ | MD5 still `da48204eb43f6cc770f18aca751a6148` |
| No `grafana-dashboard.json` changes | ✅ | MD5 still `df43c2c3e22749cdf6e015528cd2c1c2` |
| No `SLO.md` changes | ✅ | MD5 still `e7f57bdd126e5c5cd10344d822c85f13` |
| No engine code changes | ✅ | Zero `.rs` modifications |
| No new metrics | ✅ | Tools still consume only the v0.6.8 query set |
| No mutation of `TUNING_REPORT.md` or `ops/incidents.md` | ✅ | Read-only on incidents.md; both scripts emit to stdout / `OUT=` |
| All outputs labelled suggestion-only | ✅ | Envelope `note` field uppercase per spec; per-cell `suggested_*:` prefixes |
| No new runtime dependencies | ✅ | bash + curl + standard `date` only |

### Validation

- `bash -n` syntax-clean on both scripts.
- Smoke test (3 fires across 2 alerts, with 4 ops/incidents.md
  rows): produces valid envelope JSON parseable by Python's
  `json.load()`. Top-level keys `generated_at` / `window` /
  `alerts` all present. Window correctly derived from
  `WINDOW_START=2026-04-17 WINDOW_END=2026-05-01`. Incident
  evidence `"incident:2026-04-30 14:32 UTC"` matches the heading
  exactly.
- v0.6.9-format input (top-level array) is rejected with the
  documented migration diagnostic — tested with
  `echo '[{"alert":"X","fires":1}]' > old.json && CANDIDATES=old.json
  build_tuning_report.sh` exits 65.
- Both scripts validate env vars and exit 64 on bad inputs (bad
  `WINDOW`, missing `DATA_DIR`, unparseable `WINDOW_START`).

### Version bumps (docs / tools-only release)

- `rdapify` 0.6.9 → 0.6.10
- `rdap-cli` 0.6.9 → 0.6.10
- `bindings/{nodejs,python}` 0.6.9 → 0.6.10
- `rdapify-client` **unchanged** at 0.3.2 (no source-code change)

## [0.6.9] — 2026-05-01 — Assisted classification

> **Tooling-only release — suggestion-only classification scripts +
> three docs.** Reduces operator friction in producing
> [`docs/observability/TUNING_REPORT.md`](docs/observability/TUNING_REPORT.md)
> §B without bypassing any human-validation discipline.
> **No threshold changes. No SLO changes. No dashboard changes. No
> engine changes. No new metrics. No runtime dependencies.**
> Verified by byte-stable MD5 hashes for `prometheus-alerts.yaml`,
> `grafana-dashboard.json`, and `SLO.md` (still matching v0.6.6
> baselines).

### Added — `tools/classify_alerts.sh`
Bash + curl script (no jq) that correlates:
- `B__alerts_fires_per_alert.json` (Prometheus fire counts from
  v0.6.8's `extract_tuning_data.sh`).
- `ops/incidents.md` (operator-curated `Real?: yes/no/partial`
  classifications).
- Per-metric §C scalars from the same extract output (advisory
  hints).

Emits `classification_candidates.json` — a JSON array of objects
with `alert / window / fires / candidates{TP,FP,uncertain} /
evidence[] / confidence{low,medium,high} / note`.

**Every object carries `note: "SUGGESTION ONLY — requires human
validation"`.** The script does not write to TUNING_REPORT.md,
prometheus-alerts.yaml, the dashboard, or any engine code. It is
read-only on ops/incidents.md.

Confidence semantics:
- `high` — every fire matches an `ops/incidents.md` row with
  explicit `Real?:`.
- `medium` — at least one fire matched; some uncertain remain.
- `low` — no operator classifications match this alert in the
  window (calibration-debt signal).

### Added — `tools/build_tuning_report.sh`
Bash script that consumes `classification_candidates.json` and
emits a §B markdown draft with every numeric cell prefixed
`suggested:`. The draft is markdown intended for review — NOT a
final TUNING_REPORT artefact. Operators copy *confirmed* values
manually into TUNING_REPORT.md after the
CLASSIFICATION_REVIEW.md walk-through.

The script never writes to TUNING_REPORT.md. By design.

The draft deliberately does NOT include:
- `incidents_caught` / `total_incidents` columns (recall — requires
  human cross-alert attribution per ALERT_CLASSIFICATION.md §4.5).
- The `proposed_change` column (only TUNING_REPORT.md §E reasoning
  may justify a proposed change).
- Suggested threshold values (assisted-classification release
  scope; threshold changes belong to a separate Path A tuning
  release).

### Added — `docs/observability/CLASSIFICATION_REVIEW.md`
- §1 Mental model: who is authoritative when two sources disagree
  (rule: ops/incidents.md > script; operator memory > both).
- §2 Decision tree per `confidence` level.
- §3 Validation procedure (cross-check against incidents.md grep,
  audit evidence references, re-classify uncertain fires).
- §4 Four illustrative review findings (clearly marked illustrative).
- §5 Do/don't summary.
- §6 Where to file fixes when the script and incidents.md disagree.

### Added — `docs/observability/DATA_MODEL.md`
- §1 Overview of `classification_candidates.json`.
- §2 Field-by-field reference.
- §3 Hard constraints (8 invariants).
- §4 JSON Schema 2020-12 draft for tooling that supports it.
- §5 What the model deliberately doesn't include.
- §6 Schema versioning policy.
- §7 Three sample valid documents (empty, single-row, mixed).

### Updated — `docs/observability/TUNING_WORKFLOW.md`
New **Step 2.5** between data export and alert classification:
"Assisted classification (optional, added v0.6.9)". Walks the
operator from `classify_alerts.sh` → `B_draft.md` →
CLASSIFICATION_REVIEW.md walk-through → manual §B promotion. Calls
out the four hard rules:
- Output is advisory.
- Every value can be wrong.
- `incidents_caught`/`total_incidents` are operator-computed.
- Do not skip Step 3 (alert classification per ALERT_CLASSIFICATION.md).

### Updated — `docs/observability/README.md`
Index now lists CLASSIFICATION_REVIEW.md, DATA_MODEL.md, and the
two new scripts. Existing rows unchanged.

### Constraint compliance
- **NO threshold changes** — `prometheus-alerts.yaml` MD5 still
  `da48204eb43f6cc770f18aca751a6148` (matches v0.6.6+).
- **NO SLO changes** — `docs/SLO.md` MD5 still
  `e7f57bdd126e5c5cd10344d822c85f13`.
- **NO dashboard changes** — `grafana-dashboard.json` MD5 still
  `df43c2c3e22749cdf6e015528cd2c1c2`.
- **NO engine changes** — zero `.rs` modifications.
- **NO new metrics** — every PromQL the new tools touch comes from
  v0.6.8's existing query set.
- **NO mutation of ops/incidents.md or TUNING_REPORT.md** — both
  scripts are read-only on those files. The §B draft goes to
  stdout (or to a separate file via `OUT=`) and the operator
  copies confirmed values into TUNING_REPORT.md by hand.
- **NO new runtime dependencies** — bash + curl only; jq remains
  optional for CSV conversion (documented in EXPORT_GUIDE.md §5).
- **All outputs labelled suggestion-only** — every candidate
  object carries the literal `note` field; every §B draft cell
  carries the `suggested:` prefix; documentation states the
  advisory nature throughout.

### Validation
- `bash -n` syntax-clean on both scripts.
- `classify_alerts.sh` smoke test (3 fires across 2 alerts, 4 ops/incidents.md
  rows): produces valid JSON parseable by `python3 -c 'import json;
  json.load(...)'`. High-confidence FP detection works (3 `Real?: no`
  rows → confidence `high`, FP=3, uncertain=0). Mixed-confidence
  case works (1 TP + 3 unclassified fires → confidence `medium`).
- `build_tuning_report.sh` consumes the smoke-test output cleanly,
  emits a markdown draft with `suggested:` prefixes on every
  numeric cell.
- Both scripts validate env vars and exit cleanly (rc 64) on
  missing inputs.

### Version bumps (docs / tools-only release)
- `rdapify` 0.6.8 → 0.6.9
- `rdap-cli` 0.6.8 → 0.6.9
- `bindings/{nodejs,python}` 0.6.8 → 0.6.9
- `rdapify-client` **unchanged** at 0.3.2 (no source-code change)

## [0.6.8] — 2026-04-30 — Observability tooling

> **Tooling-only release.** Five new docs + one shell script that
> reduce the time and friction required to populate
> [`docs/observability/TUNING_REPORT.md`](docs/observability/TUNING_REPORT.md).
> **No threshold changes. No SLO changes. No engine changes. No
> runtime dependencies. No new metrics.** Verified by byte-stable
> MD5 hashes for `prometheus-alerts.yaml`, `grafana-dashboard.json`,
> and `SLO.md` (still matching v0.6.6/v0.6.7 baselines).

### Added — `docs/observability/QUERIES.md`
Copy-paste PromQL queries grouped by TUNING_REPORT section:
- §A scope (engine UP, total / average / peak request rate).
- §B alert evaluation (`changes(ALERTS{...})`, firing-time, per-tier
  noise, current-firing sanity check).
- §C.1 latency baselines (median p50/p95/p99, max-window, by type).
- §C.2 error rate / availability (typical, worst 5-min, by class).
- §C.3 cache (hit ratio, freshness breakdown, eviction rate, peak
  resident entries).
- §C.4 concurrency (semaphore wait p95 by kind, inflight peak, leak
  check via 15-min idle floor).
- §C.5 retries (rate, amplification, top class, delay p95).
- §C.6 breaker (top origins by open rate, total flaps, distinct
  origins ever Open, recovery rate per origin).
- Cross-cutting helpers (saturation snapshot, burn-rate projection,
  cardinality probe, "engine is producing metrics" check).

Each query carries an *Explanation* note and an *Expected
interpretation* note so the operator can validate the value against
expectation before pasting it into TUNING_REPORT.

### Added — `docs/observability/EXPORT_GUIDE.md`
Three paths to extract data from Prometheus:
- **Prometheus UI** for one-off lookups.
- **`curl /api/v1/query` and `/api/v1/query_range`** for scriptable
  extraction (with auth, time-window, step, and aggregation tips).
- **Grafana panel CSV export** for visual baselines.
Plus a §5 "JSON → CSV via `jq`" appendix for operators who want
spreadsheet-ready output (`jq` is optional; the bundled script
emits raw JSON to stay dependency-free).

### Added — `tools/extract_tuning_data.sh`
**Pure bash + curl, no external dependencies.** Runs every
canonical PromQL query from QUERIES.md against a live Prometheus
and writes per-query JSON files into a timestamped directory:

```
PROM=https://prometheus.example WINDOW=14d SCRAPE=30 \
  tools/extract_tuning_data.sh
```

- 30+ queries covering all of §A / §B / §C.1–§C.6 + cross-cutting.
- Emits `MANIFEST.txt` recording the invocation parameters.
- Emits `INDEX.txt` mapping each output file to its TUNING_REPORT
  section.
- Validates `WINDOW` shape (must match `^[0-9]+[dhm]$`) and
  `SCRAPE` (positive integer seconds).
- Supports basic auth (`AUTH_USER` / `AUTH_PASS`) and bearer tokens
  (`AUTH_TOKEN`).
- Read-only: hits only `GET /api/v1/query` against Prometheus —
  modifies nothing.

### Added — `docs/observability/ALERT_CLASSIFICATION.md`
Decision tree for the four boxes (TP / FP / Missed / Correct
silence). Defines:
- What counts as a "fire" (one transition into the firing state per
  the `ALERTS{alertstate="firing"}` series).
- What counts as a "real issue" — *user-visible failure OR
  operator action OR postmortem filed*.
- Three worked examples (TP, FP, Missed), all clearly marked
  **illustrative** — no synthetic data passed off as real.
- Five edge-case rules (alert flapped, co-fired, "not sure",
  mid-deploy, multiple alerts caught the same incident).
- The precision / recall formulas with a worked numeric example
  (also marked illustrative).

### Added — `docs/observability/TUNING_WORKFLOW.md`
Step-by-step end-to-end checklist:
1. Collect metrics (manual or automated).
2. Export data + attach artefacts.
3. Classify alerts (TP / FP / Missed).
4. Fill TUNING_REPORT §A–§F.
5. Validate completeness against admissibility / evidence /
   per-change / sign-off rules.
6. Open the v0.6.x PR — either Path A (tuning, §E has rows) or
   Path B (calibration confirmed, §E empty — what shipped in
   v0.6.7).
7. Post-application: update runbook Feedback log "Last calibration
   review" lines, archive the report.

### Updated — `docs/observability/README.md`
Index now lists the five new files plus the `tools/` script entry.
No content changes to existing rows.

### Constraint compliance
- **NO threshold changes** — `prometheus-alerts.yaml` MD5 still
  `da48204eb43f6cc770f18aca751a6148`.
- **NO SLO changes** — `docs/SLO.md` MD5 still
  `e7f57bdd126e5c5cd10344d822c85f13`.
- **NO dashboard changes** — `grafana-dashboard.json` MD5 still
  `df43c2c3e22749cdf6e015528cd2c1c2`.
- **NO engine changes** — zero `.rs` modifications.
- **NO new metrics** — every PromQL in QUERIES.md uses metrics
  already in [`METRICS.md`](docs/observability/METRICS.md).
- **NO new runtime dependencies** — script is pure bash + curl;
  optional jq is documented as optional.
- **NO synthetic data** — all examples in ALERT_CLASSIFICATION.md
  are explicitly labelled illustrative.

### Version bumps (docs / tools-only release)
- `rdapify` 0.6.7 → 0.6.8
- `rdap-cli` 0.6.7 → 0.6.8
- `bindings/{nodejs,python}` 0.6.7 → 0.6.8
- `rdapify-client` **unchanged** at 0.3.2 (no source-code change)

## [0.6.7] — 2026-04-30 — Calibration confirmed

> **Calibration confirmation release.** The first scheduled
> data-driven tuning window completed without producing tuning-worthy
> evidence. Per [`docs/observability/CALIBRATION.md`](docs/observability/CALIBRATION.md)
> §7.3, this outcome is itself a valid v0.6.x deliverable — the
> [`docs/observability/TUNING_REPORT.md`](docs/observability/TUNING_REPORT.md)
> §F sign-off records the conclusion.

### What this release ships
- **No alert threshold changes.** [`docs/observability/prometheus-alerts.yaml`](docs/observability/prometheus-alerts.yaml)
  byte-identical to v0.6.6 (MD5 `da48204eb43f6cc770f18aca751a6148`).
- **No SLO changes.** [`docs/SLO.md`](docs/SLO.md) byte-identical to
  v0.6.6 (MD5 `e7f57bdd126e5c5cd10344d822c85f13`).
- **No dashboard changes.** [`docs/observability/grafana-dashboard.json`](docs/observability/grafana-dashboard.json)
  byte-identical to v0.6.6 (MD5 `df43c2c3e22749cdf6e015528cd2c1c2`).
- **No runbook content changes.** No §1–§5 edits to any of the 15
  runbooks.
- **No engine changes.** Zero `.rs` modifications.
- **No new metrics, labels, or dependencies.**

### Reason
Observation window completed with no tuning-worthy findings:

- **No false positives observed** — §B `false_positives` column empty
  for every alert. The ≥ 3-FP-per-alert trigger for relaxing
  sensitivity (CALIBRATION §7.2) was not met.
- **No missed incidents** — every populated `incidents_caught` row
  matches `total_incidents`. No `(no alert fired)` row in
  [`ops/incidents.md`](ops/incidents.md). The recall trigger for
  tightening sensitivity was not met.
- **Insufficient evidence** — populated cell count below the
  threshold required by CALIBRATION §7.1 to anchor any tuning PR.
  Making changes now would be unjustified by definition.

### What did change
- [`docs/observability/TUNING_REPORT.md`](docs/observability/TUNING_REPORT.md)
  §F — "Conclusion (v0.6.7 — 2026-04-30)" subsection added recording
  the sign-off, rationale, and recalibration triggers.
- Version bumps: `rdapify` · `rdap-cli` · `bindings/{nodejs,python}`
  0.6.6 → 0.6.7. `rdapify-client` unchanged at 0.3.2.

### Recalibration triggers
This sign-off is current as of 2026-04-30 and remains valid until any
of the following changes the input distribution:

- A new caller is onboarded.
- Request rate grows ≥ 2× the v0.6.6/v0.6.7 baseline.
- A new query type starts seeing material volume.
- A new upstream registry is added.
- An incident occurs that is not surfaced by an existing alert (see
  [`PRODUCTION_CHECKLIST.md`](docs/observability/PRODUCTION_CHECKLIST.md)
  Phase 5).

When any of those happens, open a new observation window per
[`ops/README.md`](ops/README.md) §4 and a fresh
[`TUNING_REPORT.md`](docs/observability/TUNING_REPORT.md).

### Constraint compliance
- **NO threshold changes** — three MD5 hashes above prove byte-stability.
- **NO synthetic data** — the §F conclusion does not invent any
  numbers; every cell that would describe production data remains
  empty.
- **NO undocumented changes** — every change in this release is in
  this CHANGELOG entry.

## [0.6.6] — 2026-04-30

> **Tuning-harness release.** Pure docs / templates that prepare for
> evidence-based threshold tuning when production data exists.
> **Zero source-code changes**, **zero threshold edits**, **zero
> alert edits**, **zero SLO target changes**, no metric / dashboard
> behaviour changes. Verified: `cargo test --workspace --release
> --lib` clean.
>
> Why no tuning happened in this release: there is no production
> data to anchor evidence-based changes to. The v0.6.5 calibration
> discipline explicitly forbids tuning without measurements.
> v0.6.6's job is to make the *next* tuning release fast and
> auditable.

### Added — `docs/observability/TUNING_REPORT.md`
Fill-in template for evidence-based tuning. Six sections, all
deliberately empty:

- §A Scope — environment, time window, data sources, window
  admissibility checks.
- §B Alert Evaluation — per-alert table for fires / true_positives
  / false_positives / precision / recall, pre-populated for all
  15 alerts with empty cells.
- §C Metric Baselines — canonical PromQL for p50/p95/p99 latency,
  error rate, cache hit ratio, semaphore wait p95, retry rate, and
  breaker open rate. Each metric has an `Observed / Min / Avg / Max`
  table.
- §D Runbook Effectiveness — per-runbook (15 rows) clarity rating,
  missing steps, action-PR link.
- §E Threshold Change Ledger — every proposed change recorded with
  evidence cited from §B / §C / §D before review.
- §F Sign-off — operator / reviewer / stakeholder signatures plus
  attached PromQL permalinks and incident IDs.

Approval rules in §E enforce: lowering sensitivity needs ≥ 3 false
positives, raising sensitivity needs missed-incident evidence, SLO
changes need stakeholder sign-off, panel removal needs §D evidence.

### Added — `docs/observability/PANEL_INVENTORY.md`
Inventory of every panel in `grafana-dashboard.json`:

- 18 data panels + 1 stat (Engine health) + 7 row separators = 26.
- Classified: 11 high-signal, 7 diagnostic-only, 0 candidate-for-removal,
  8 structural.
- Each entry has: panel id, title, metric/query, question it answers,
  category, notes.
- Removal procedure documented; *no* panels removed in this release.

### Added — `docs/observability/PATTERNS.md`
Cross-runbook index of five common failure shapes, derived
**only from the existing runbooks** (no production-data
extrapolation):

1. **Upstream degradation** — circuit_open / network errors, breaker
   Open dominant.
2. **Retry amplification** — retry_total spikes, often as Shape 1
   precursor.
3. **Concurrency saturation** — inflight pinned, semaphore wait p95
   high.
4. **Cache inefficiency** — hit ratio drops, working set ≥ cap.
5. **Breaker instability** — flapping or sustained-Open without
   clean recovery.

Each shape lists: signals, alerts that fire, primary runbooks, and
typical actions. Plus a "shape interactions" table for common
chains.

### Updated — `CALIBRATION.md`
New **§7 "When NOT to tune"** — hard preconditions for any tuning PR:

- 7.1 Required: completed TUNING_REPORT with real data.
- 7.2 Required: ≥ 3 false positives before lowering sensitivity.
- 7.3 Required: baseline window ≥ 7 days (≥ 14 d preferred).
- 7.4 Prohibited: tuning during an active incident.
- 7.5 Prohibited: any threshold in the §6 "do not tune" list.
- 7.6 Prohibited: panel removal without §D evidence.
- 7.7 Prohibited: SLO change without stakeholder sign-off.

Plus a summary checklist that reviewers tick before merging any
tuning PR. Existing §7 "References" renumbered to §8 (no external
docs reference §7 by number).

### Updated — `docs/observability/README.md`
Index now lists `TUNING_REPORT.md`, `PANEL_INVENTORY.md`, and
`PATTERNS.md`. CALIBRATION row updated to mention §7.

### Constraint compliance
- **NO code changes**: zero `.rs` modifications.
- **NO new metrics**: every PromQL in TUNING_REPORT / PATTERNS uses
  existing surface.
- **NO new dependencies**: only Markdown + version bumps.
- **NO threshold edits**: every value in `prometheus-alerts.yaml`,
  `grafana-dashboard.json`, and `SLO.md` is byte-identical to v0.6.5.
- **NO fictional numbers**: every cell that would describe production
  data is left empty.

### Version bumps (docs-only release)
- `rdapify` 0.6.5 → 0.6.6
- `rdap-cli` 0.6.5 → 0.6.6
- `bindings/{nodejs,python}` 0.6.5 → 0.6.6
- `rdapify-client` **unchanged** at 0.3.2 (no source-code change)

## [0.6.5] — 2026-04-30

> **Operational calibration release.** Pure docs / operational
> guidance. **Zero source-code changes** — no engine, retry, cache,
> breaker, alert thresholds, or metric surface modified. No new
> metrics; no new runtime dependencies. Verified:
> `cargo test --workspace --release --lib` clean.

### Added — `docs/observability/CALIBRATION.md`
- Threshold-tuning procedure: capture-before-changing, decision
  matrix, "don't tune mid-incident", reviewable PR template.
- Trend interpretation per metric family: latency, cache, concurrency,
  circuit breakers, retries.
- **Alert noise tracking** with formal definitions (precision /
  recall), per-severity targets (critical ≥ 0.80 precision,
  warning ≥ 0.50, recall ≥ 0.90), per-alert tracking sheet,
  monthly-review template.
- Workload-specific calibration guidance (many origins / few origins
  high volume / cache-bypass / burst).
- "What you should *not* tune" list anchored to the SLO contract
  and engine internals.
- Four-week calibration schedule for first-month deployments.

### Added — `docs/observability/PRODUCTION_CHECKLIST.md`
- Phase 0 (pre-deploy): engine config, observability wiring, SLO
  sign-off, engine-team sign-off.
- Phase 1 (soft launch, week 1): paging suppressed, baseline capture.
- Phase 2 (warning paging, week 2): tracked-precision rollout.
- Phase 3 (critical paging, week 3): on-call drills.
- Phase 4 (steady state): monthly noise review · quarterly SLO
  re-baseline · quarterly runbook review · post-incident updates.
- Phase 5 (capacity / growth events): re-baseline triggers.

### Added — runbook Feedback log
- All **15 runbooks** in `docs/observability/runbooks/` now end with
  a uniform `## Feedback log` section: per-fire tracking table,
  precision-target reference, last-calibration-review marker, and a
  per-incident "update at least one of §2 / §3 / §4 / §5" prompt.
- Closes the loop between an alert firing, the runbook being used,
  and the runbook being improved.

### Updated — `docs/SLO.md`
- New §7 "Real-world validation":
  - 30-day baseline queries for each SLI.
  - Decision matrix (headroom comfortable / one-bad-day-from-breach
    / persistent ceiling / over-achieving).
  - "Fix latency or relax SLO" framing — three honest options vs.
    silent miss.
  - Workload-specific (per-type) SLO guidance.
  - Validation cadence: 30-day · quarterly · post-incident · post-
    workload-change.
  - Calibration discipline tied to `CALIBRATION.md`.
- Footer updated to reflect v0.6.5 authority.

### Updated — `docs/observability/README.md`
- Adds rows for `PRODUCTION_CHECKLIST.md` and `CALIBRATION.md` in
  the file index. Runbook description updated to reflect six
  sections (added Feedback log).

### Constraint compliance
- **NO code changes**: zero `.rs` file modifications.
- **NO new metrics**: every PromQL in CALIBRATION / SLO §7 uses
  existing metrics.
- **NO behaviour changes**: only Markdown + Cargo.toml version bumps.

### Version bumps (docs-only release)
- `rdapify` 0.6.4 → 0.6.5
- `rdap-cli` 0.6.4 → 0.6.5
- `bindings/{nodejs,python}` 0.6.4 → 0.6.5
- `rdapify-client` **unchanged** at 0.3.2 (no source-code change)

## [0.6.4] — 2026-04-29

> **Incident readiness release.** Docs and alert refinement only.
> **Zero source-code changes** — no engine, retry, cache, or breaker
> behaviour modified. No new metrics; no new runtime dependencies.
> Verified: `cargo test --workspace --release` clean.

### Added — Runbooks (`docs/observability/runbooks/`)
- **15 runbooks**, one per alert (11 from v0.6.3 + 4 new burn-rate
  alerts below). Each follows the same five-section structure so an
  on-call can scan-read at 03:00: *what it means · likely causes ·
  verify · actions · escalate.*
- `runbooks/README.md` — index, organised by severity tier.

### Added — SLO burn-rate alerts (Google SRE MWMBR)
Two budget targets get four new multi-window multi-burn-rate alerts:

- **Error budget** — 1 % of requests / 30 d.
  - `RdapifyErrorBudgetFastBurn` (critical) — 14.4× burn over 5 m **and**
    1 h windows; for 2 m. Exhausts the budget in ~2 h if sustained.
  - `RdapifyErrorBudgetSlowBurn` (warning) — 6× burn over 30 m **and**
    6 h windows; for 15 m. Exhausts the budget in ~5 d.
- **Latency budget** — 5 % of requests above the 300 ms p95 SLO / 30 d.
  - `RdapifyLatencyBudgetFastBurn` (critical) — 14.4× over 5 m + 1 h.
  - `RdapifyLatencyBudgetSlowBurn` (warning) — 6× over 30 m + 6 h.

  The latency-budget alerts use `rdap_latency_seconds_bucket{le="0.3"}` /
  `rdap_latency_seconds_count` to compute the fraction of requests
  above SLO — no new metric required.

Total alert count: **15** (5 critical / 7 warning / 3 info), up from
11 in v0.6.3.

### Added — Engine health stat panel (Grafana)
- New top-of-dashboard **`Engine health`** stat panel renders
  `OK / DEGRADED / FAILING` from a single PromQL expression keyed off
  the same SLIs that drive the alerts:
  - **FAILING** — error rate > 5 %, p95 latency > 1 s, or
    `rdap_inflight_requests >= 240`.
  - **DEGRADED** — error rate > 1 % or p95 latency > 300 ms.
  - **OK** — otherwise.
- Existing 25 panels shifted down 4 rows; total 26 panels. Schema
  version unchanged (39, Grafana 10+).

### Added — Incident response guide (`docs/observability/INCIDENT.md`)
- Severity tiers, "first 5 minutes" checklist, communication
  template, four common incident shapes (error spike, latency spike,
  upstream down, queue growing) with runbook entry-points,
  major-incident declaration criteria, and a 10-row mitigation table
  ranked by reversibility.

### Changed — Alert annotations
- Every alert now ships with a real `runbook_url` pointing at the
  matching file in `docs/observability/runbooks/`. The placeholder
  `${RUNBOOK_BASE}/rdapify/<name>` form has been replaced with the
  canonical
  `https://github.com/rdapify/RDAPify/blob/main/rdapify-rust/docs/observability/runbooks/<name>.md`
  prefix; operators who mirror docs internally can sed-replace at
  deploy time (documented in the README).

### Constraint compliance
- **NO engine changes**: zero `.rs` file modifications.
- **NO new metrics**: burn-rate alerts re-use the existing histogram
  and counter surface from v0.6.3.
- **NO behaviour changes**: only YAML, JSON, Markdown.
- **Low-noise discipline preserved**: every burn-rate alert requires
  *both* windows to exceed threshold (MWMBR), suppressing
  single-spike false positives.

### Version bumps (docs-only release)
- `rdapify` 0.6.3 → 0.6.4
- `rdap-cli` 0.6.3 → 0.6.4
- `bindings/{nodejs,python}` 0.6.3 → 0.6.4
- `rdapify-client` **unchanged** at 0.3.2 (no source-code change)

## [0.6.3] — 2026-04-29

> **Operability release.** Docs and tooling only. **Zero source-code
> changes** — no engine, retry, cache, or breaker behaviour modified.
> No new runtime dependencies. Verified: `cargo test --workspace
> --release` clean; Stage E E3 unchanged.

### Added — Operator-facing observability artefacts
- **`docs/observability/grafana-dashboard.json`** — importable Grafana
  dashboard (Grafana 10+, schema version 39). 25 panels organised
  across 7 sections: latency · throughput · errors-by-class · cache
  (ratio + flow + entries + evictions) · concurrency (inflight,
  semaphore wait p95, utilization) · circuit breaker (state,
  transitions, open-time rate) · retries (rate-by-class, delay
  histogram) · per-host pressure (heatmap of queue-depth distribution)
  · slow requests. Templating variable `DS_PROMETHEUS` for portable
  datasource binding; `type` query-type filter populated from labels.
- **`docs/observability/prometheus-alerts.yaml`** — 11 alerts in 3
  severity tiers (3 critical · 5 warning · 3 info). All queries use
  `rate()` / `increase()` / `histogram_quantile()` over time windows;
  no instantaneous-gauge alerts except where the gauge itself is the
  signal (inflight saturation). Every annotation includes an
  actionable `description` and a `runbook_url` placeholder.
  - **Critical**: `RdapifyHighErrorRate` (>5 % for 5 m),
    `RdapifyBreakerOpenSurge` (>30 s/s open per origin),
    `RdapifyInflightSaturation` (≥240/256 for 3 m).
  - **Warning**: `RdapifySemaphoreWaitElevated` (p95 wait > 100 ms),
    `RdapifyRetrySpike` (3× the 1 h baseline),
    `RdapifyCacheHitRatioLow` (<50 % for 30 m, gated on rate >1 rps),
    `RdapifyBreakerFlapping` (≥15 closed↔open transitions in 5 m),
    `RdapifyP95LatencyAboveSlo` (>300 ms sustained).
  - **Info**: `RdapifySlowRequestRising`, `RdapifySingleBreakerOpen`,
    `RdapifyCacheCapacityPressure`.
- **`docs/observability/METRICS.md`** — full reference for every
  `rdap_*` metric the engine emits. Per metric: type, labels and
  cardinality bound, source code location, meaning, canonical
  example PromQL. Includes a "common compound queries" section
  (availability, error rate, hit ratio, p95 latency, breaker open
  rate, semaphore saturation, retry-storm detection, breaker flap
  rate) and an "operator wiring quickstart".
- **`docs/observability/README.md`** — directory README explaining
  how to import the dashboard and load the alert rules; also
  documents what's deliberately *not* shipped (no built-in OTLP
  exporter, no `/debug/metrics-summary` endpoint — see entry below).

### Decided to defer
- **`/debug/metrics-summary`** endpoint on `rdap-service` (marked
  optional in the v0.6.3 spec). A clean implementation would require
  a small additive `RdapClient::cache_len()` accessor — borderline
  against the v0.6.3 "NO changes to engine logic" constraint.
  Operators wanting a JSON snapshot of cache size / inflight /
  breaker count can derive it from `/metrics` or wait for v0.7.0.
  Documented in `docs/observability/README.md` under "What's
  deliberately not here".

### Constraint compliance
- **NO behaviour changes**: zero `.rs` file modifications.
- **NO new dependencies**: only docs (Markdown, JSON, YAML).
- **NO cardinality increase**: every label in the dashboard /
  alerts is bounded; the `origin` label is capped by the breaker
  registry's 1024-entry moka LRU.
- **Actionable, low-noise alerts**: `for:` windows ≥ 5 m for
  critical, ≥ 10 m for warning, ≥ 15 m for info; thresholds chosen
  above measured noise floor.

### Version bumps (docs-only release)
- `rdapify` 0.6.2 → 0.6.3
- `rdap-cli` 0.6.2 → 0.6.3
- `bindings/{nodejs,python}` 0.6.2 → 0.6.3
- `rdapify-client` **unchanged** at 0.3.2 (no source-code change)

## [0.6.2] — 2026-04-29

> **Minor observability patch.** Production-visibility additions only.
> No behaviour changes, no new dependencies, no detectable performance
> regression (Stage E E3 re-run: p95 7.13 ms vs. 7.16 ms at 0.6.1 — within
> run-to-run noise).

### Added — Task 1: Semaphore wait histogram
- **`rdap_semaphore_wait_seconds{kind}`** histogram — time spent waiting
  for a concurrency permit. `kind ∈ {global, per_host}` distinguishes
  the two stacked semaphores. Cardinality bound: 2 series.
- Wired at both acquire sites in `Fetcher::fetch_with_retry`. Wait
  measurement uses a single `Instant::now()` before/after the
  `acquire_owned().await`; cost is one syscall-free monotonic clock
  read per attempt.

### Added — Task 2: Circuit breaker open-duration counter
- **`rdap_circuit_breaker_open_seconds_total{origin}`** counter —
  cumulative seconds the per-origin breaker spent in the `Open` state.
  Incremented exactly once per `Open→HalfOpen` transition with the
  elapsed window.
- New public method `CircuitBreaker::opened_at_ms()` (single Acquire
  load on `AtomicU64`) plus `CircuitBreaker::now_ms_public()` exposing
  the same time source so the fetcher computes the delta consistently.
- Resolution: whole seconds (truncating). Sub-second open windows are
  skipped — the `metrics` 0.23 counter API takes `u64` only and the
  default cooldown is 30 s, so this is fine for typical operation.

### Added — Task 3: Per-host queue depth histogram
- **`rdap_per_host_queue_depth`** histogram (no `origin` label —
  cardinality is bucket-bound, not per-host). Observed once per fetch
  attempt as `total_permits − available_permits` *before* acquiring
  the per-host permit. Captures the contention distribution operators
  need without an unbounded label set.
- Activated only when `per_host_concurrency_limit = Some(_)`; off
  when per-host gating is disabled.

### Added — Task 4: Sampled invalid-env-var warning
- `FetcherConfig::with_env_overrides()` now logs a `tracing::warn!` line
  when an env value fails to parse (previously silent). The warn is
  **once per (key, process)**: a typo is visible exactly once and
  never spams the log on repeated config loads.
- Implementation: per-env-var `OnceLock<()>` latch (5 of them, one
  per recognised key plus a defensive "other" bucket). No new deps.
- Logged value is truncated to 64 chars so a malicious huge env value
  can't fill the log buffer.
- Event name: `rdap_env_override_invalid` with fields `key`,
  `value` (truncated), `expected` (e.g. `"f32 in [0.0, 1.0]"`).

### Test counts (with `metrics` feature on)
- `rdap-core`: 104 lib + 12 obs + 3 redaction + 2 doc = **121**
  (was 117 at 0.6.1 → +4 new metric coverage tests + 1 env-warn test)
- `rdap-cache`: **17** (unchanged)
- `rdap-metrics`: 19 unit + 9 integration = **28** (unchanged)

### Sample metrics output

```
# HELP rdap_semaphore_wait_seconds Time spent waiting to acquire a concurrency permit, partitioned by kind={global,per_host}.
# TYPE rdap_semaphore_wait_seconds histogram
rdap_semaphore_wait_seconds_bucket{kind="global",le="0.001"} 1998
rdap_semaphore_wait_seconds_bucket{kind="global",le="0.005"} 2000
rdap_semaphore_wait_seconds_count{kind="global"} 2000
rdap_semaphore_wait_seconds_sum{kind="global"} 0.000123

# HELP rdap_per_host_queue_depth Per-host semaphore depth (used permits) at acquire time.
# TYPE rdap_per_host_queue_depth histogram
rdap_per_host_queue_depth_bucket{le="0"} 1980
rdap_per_host_queue_depth_bucket{le="5"} 1995
rdap_per_host_queue_depth_count 2000

# HELP rdap_circuit_breaker_open_seconds_total Cumulative seconds the per-origin circuit breaker spent in the Open state. Truncated to whole seconds.
# TYPE rdap_circuit_breaker_open_seconds_total counter
rdap_circuit_breaker_open_seconds_total{origin="https://rdap.example.com:443"} 30
```

### Performance
- Default-feature build still pays zero overhead (verified via
  `cargo tree --no-default-features` — no metrics deps linked).
- Hot-path overhead with `metrics` ON: one extra `Instant::now()` per
  permit acquire (× 2 stacked semaphores), one extra `available_permits()`
  read per per-host acquire. Both are sub-µs operations.
- Hot-path overhead with `metrics` OFF: every new hook compiles to
  `#[inline(always)]` no-ops; LTO elides them entirely.
- Stage E E3 re-run: p95 **7.13 ms** vs. **7.16 ms** at 0.6.1 — no
  detectable regression.

### Version bumps
- `rdapify` 0.6.1 → 0.6.2
- `rdapify-client` 0.3.1 → 0.3.2 (no API change; recompiled)
- `rdap-cli` 0.6.1 → 0.6.2
- `bindings/{nodejs,python}` 0.6.1 → 0.6.2
- Path-dep constraints in `rdapify`, `rdap-cli`, `rdap-batch`,
  `rdap-service`, `bindings/nodejs` updated to `0.3.2` / `0.6.2` as
  applicable.

## [0.6.1] — 2026-04-29

> **Patch release.** Production-behaviour improvements without changing
> system design. No breaking API changes. Verified non-regressing against
> the Stage E load-test harness (E3 burst p95 = 7.16 ms vs. 7.05 ms at
> 0.6.0 — within run-to-run noise).

### Added — Task 1: Per-host concurrency limit
- **`FetcherConfig::per_host_concurrency_limit: Option<usize>`** — caps
  simultaneous attempts per upstream origin. Default `Some(16)`.
  Stacks under the global `concurrency_limit`: per-host permit is
  acquired *first* (so a slow host can't park global permits while
  waiting for its own quota), then the global permit.
- New constants in `rdap-core`:
  `DEFAULT_PER_HOST_CONCURRENCY` (16), `PER_HOST_REGISTRY_CAPACITY`
  (1 024 — soft cap on the per-host registry, fail-open when exceeded).
- New `Fetcher::per_host_semaphore(&Origin)` private helper backed by
  `Arc<DashMap<Origin, Arc<Semaphore>>>`. Lazy creation; soft-capped
  registry; the existing global `Semaphore` is unchanged.
- Validator extended (Stage F · F2): rejects
  `per_host_concurrency_limit = Some(0)` (use `None` to disable) and
  `per_host > concurrency_limit` (meaningless).
- 4 new unit tests + 2 integration tests (`per_host_cap_binds_against_single_origin`,
  `per_host_disabled_means_no_per_host_gate`).

### Added — Task 2: Circuit-breaker transition metrics
- **`rdap_circuit_breaker_transitions_total{origin, from, to}`** —
  counter incremented on every state change. Captured by reading
  `breaker.state()` before and after each `before_call` /
  `on_success` / `on_failure` and emitting only when the state moved.
- `CircuitState::label() -> &'static str` returns stable
  `closed` / `open` / `half_open` strings for the labels.
- Cardinality bound: `≤ 1024 origins × 4 transitions = 4096 series`.

### Added — Task 3: Cache metrics
- **`rdap_cache_evictions_total`** counter — incremented on every
  oldest-by-`inserted_at` eviction (capacity pressure), every
  fully-expired entry dropped on read, every entry dropped by
  `evict_expired`, and every entry dropped by `clear()`.
- **`rdap_cache_entries_current`** gauge — set on every cache mutation
  (insert / evict). Renders only after first set, so dashboards see
  a value that always reflects the most recent post-mutation cache size.

### Added — Task 4: Retry delay histogram
- **`rdap_retry_delay_seconds`** histogram — observes the *actual*
  delay applied between retry attempts (`max(backoff_jitter, Retry-After)`,
  capped at `RETRY_AFTER_MAX = 60 s`). Distinct from the existing
  `rdap_retry_after_seconds`, which records only the server-supplied
  hint. The new histogram tells operators what the engine actually
  waited; the old one tells them what the upstream asked for.

### Added — Task 5: Env config overrides
- **`FetcherConfig::with_env_overrides()`** — overlay these vars on
  any config (typically chained off `default()`):
  - `RDAP_TIMEOUT_SECS` → `timeout`
  - `RDAP_MAX_ATTEMPTS` → `max_attempts`
  - `RDAP_CONCURRENCY_LIMIT` → `concurrency_limit`
  - `RDAP_PER_HOST_CONCURRENCY` → `per_host_concurrency_limit` (`0` ⇒ `None`)
  - `RDAP_TRACE_SAMPLE_RATE` → `trace_sample_rate`
- Unparseable values are silently ignored — operators leaving
  variables empty don't break the engine.
- Combine with `validate()` to refuse a config whose env-overlaid
  values fall outside the production-safety bounds.
- 4 new tests (with serial-test mutex since env is process-global).

### Changed
- `loadtest/harness/src/main.rs` — Stage E client builder now sets
  `per_host_concurrency_limit: None` explicitly. Single-origin load
  tests would otherwise be bottlenecked by the new default cap of 16.
- `rdapify-client` 0.3.0 → 0.3.1 (no API change; recompiled against
  the extended `FetcherConfig`).
- Version bumps: `rdapify` 0.6.0 → 0.6.1, `rdap-cli` 0.6.0 → 0.6.1,
  `bindings/{nodejs,python}` 0.6.0 → 0.6.1.

### Performance
- Default-feature build still pays zero overhead (verified via
  `cargo tree --no-default-features` — no metrics deps linked).
- With per-host gating ON: one extra atomic load + DashMap lookup +
  one `acquire_owned` on the hot path; cost is negligible against
  upstream RTT.
- With per-host gating OFF (`None`): the registry isn't allocated
  and the acquire helper short-circuits at the `is_none()` check.
- Stage E E3 re-run: p95 7.16 ms (was 7.05 ms at 0.6.0) — no
  detectable regression. p50/p99/error rate all within noise.

### Test counts (with `metrics` feature on)
- `rdap-core`: 104 lib + 9 obs + 2 redaction + 2 doc = **117** (was 102)
- `rdap-cache`: **17** (unchanged)
- `rdap-metrics`: 19 unit + 9 integration = **28** (unchanged)

## [0.6.0] — 2026-04-29

> **Production release gate (Stage F).** Rolls up the Stage D observability
> stack (D1–D6), the Stage E load-test validation (E1–E6), and the Stage F
> production-safety hardening (F1–F8). Marks the v0.6 → v1.0 release
> candidate cycle. The v1.0.0 release remains targeted at February 2027
> per `RDAPify-Internal/DECISIONS.md`.

### Added — Stage F · F1/F2 (Safe defaults + config validation)
- **`rdap-core::DEFAULT_TIMEOUT`** = 5 s. Lowered from 10 s — the upper end
  of the production-safe window (Stage F · F1).
- **`rdap-core::MAX_TIMEOUT`** = 30 s, **`MAX_ATTEMPTS_CEILING`** = 10,
  **`MAX_CONCURRENCY_LIMIT`** = 4 096 — hard caps enforced by the validator.
- **`FetcherConfig::validate()`** — rejects unsafe values at the
  programmatic API boundary: zero / negative / above-ceiling timeout,
  zero `max_attempts`, zero `concurrency_limit`, `initial_backoff` >
  `max_backoff`, zero slow-request threshold, NaN / inf / out-of-range
  `trace_sample_rate`, zero `max_connections_per_host`. Surfaces via
  `Result` from every `Fetcher::with_*` constructor. **13 new unit tests.**
- `rdap-config::validate.rs` — `rdap.timeout_seconds` upper bound
  tightened from 60 → 30 s (TOML loader now matches the programmatic cap).

### Added — Stage F · F4 (Public API freeze)
- `rdapify` facade gains a `metrics` feature + `pub mod metrics` exposing
  `rdap-metrics::{install_recorder, render, hooks, types, redact, sampling, …}`.
  Operators can now opt into the Prometheus surface without a direct
  dep on `rdap-metrics`.
- **Fixed long-standing `rdapify::rate_limit::RateLimiter` typo** — was
  importing a non-existent name; correct name is `RdapRateLimiter`.
  This fixes `cargo build --features rate-limit` for downstream
  consumers.
- Skeleton modules (`sqlite` / `postgres` / `mysql` / `service`)
  documented as "reserved namespace — impl in `rdap-{sqlite,…}`".

### Added — Stage F · F5/F8 (Docs)
- **`docs/PERFORMANCE.md`** — latency expectations from real Stage E
  numbers (E1–E6), scaling notes, configuration tuning table, memory
  footprint, observability overhead with feature on/off.
- **`docs/KNOWN_LIMITS.md`** — eight documented limits (in-memory
  cache, global semaphore, static concurrency, lazy bootstrap, SSRF
  guard URL-only, pre-1.0 metrics surface, no built-in OTLP, Pro
  features external) plus a "what we explicitly do NOT have" reverse
  table covering bounded-by-design properties.

### Changed
- `RdapConfig::timeout_seconds` default 15 → 5 (TOML).
- Default-feature `rdapify` build now exposes `pub mod metrics` placeholder
  (resolves only with `--features metrics`).

### Performance / behaviour
- Validator runs on every `Fetcher` construction. Cost: a handful of
  bound checks on a struct that only exists once per process. Negligible.
- Default-feature build still pays zero overhead — verified by
  `cargo tree --no-default-features` (no `metrics` /
  `metrics-exporter-prometheus` linked).

### Added — Stage E · E2/E4/E5/E6 (full SLO validation)
- **`harness/src/scenarios/e2.rs`** — cold cache / fan-out. 200 concurrent
  clients × 1 000 unique domains = 200 000 client operations. Validates
  single-flight collapse by scraping `mock-upstream:/stats` for the
  upstream-call delta. **Result: 1 000 upstream calls (1.00× fan-out
  factor — perfect dedup).**
- **`harness/src/scenarios/e4.rs`** — 50 % upstream-failure injection.
  1 000 requests at 200 concurrent, 20 ms upstream. **Result: p95
  128.83 ms, retry amplification 1.72× (max attempts ceiling 3.0×).**
  Note: with random 50 % failures the breaker rarely sees 5 consecutive
  failures, so it stays closed by design — concentrated-failure breaker
  test lives in `rdap-core::tests/observability.rs`.
- **`harness/src/scenarios/e5.rs`** — 100 % 429 with `Retry-After: 2`,
  50 queries × 10 concurrent. Validates Retry-After honouring and
  retry-storm prevention via per-query latency floor + upstream-call
  ceiling. **Result: p50 = 4 003.84 ms = 2 × Retry-After (sub-1 % jitter);
  exactly 150 upstream calls = 50 × max_attempts (no storm, no
  short-circuit).**
- **`harness/src/scenarios/e6.rs`** — 50 000 unique domains at 256
  concurrent. RSS measurement before/after via `/proc/self/status`.
  **Result: RSS delta 47.4 MiB, bounded by the cache's working-set cap
  (≈ 1 KiB per active domain) rather than input cardinality.**
- **`harness/src/outcome.rs`** — new `ScenarioOutcome` (`Stats` plus
  scenario-specific notes and `extra_failures`). Lets a scenario fail
  the SLO verdict for reasons that aren't latency or error rate (e.g.
  fan-out leak, retry storm, RSS growth).
- **`ClientOverrides`** in `harness/src/main.rs` — per-scenario
  `max_attempts` / `timeout` / `cache_max_entries` so E4/E5 actually
  exercise retries (max_attempts=3) without affecting the baseline
  scenarios.
- **`k6/{e2_cold_cache,e4_upstream_failure,e5_rate_limit,e6_adversarial}.js`**
  — operator-facing scripts for the production-faithful path against
  `rdap-service`. Each writes a `reports/eN_summary.json` for CI.
- **`run.sh`** dispatch extended to E2/E4/E5/E6 with sensible per-scenario
  default chaos knobs (failure rate, rate-limit rate, Retry-After secs).
- **`reports/STAGE_E_SLO_REPORT.md`** rewritten as a six-scenario report.
  Production-readiness verdict: all six scenarios pass; engine validated.

### Added — Stage E · E1/E3 (load testing + SLO validation)
- **`loadtest/`** — load-test infrastructure as standalone Cargo projects
  (excluded from the engine workspace so they don't slow down `cargo test
  --workspace`):
  - `mock-upstream/` — axum-based deterministic RDAP mock with chaos knobs
    (`--latency-ms`, `--failure-rate`, `--rate-limit-rate`, `--retry-after-secs`,
    `--cache-max-age`).
  - `harness/` — in-process Rust load driver. Drives the `rdapify` library
    directly with the `metrics` feature on so post-run SLO validation can
    inspect the Prometheus surface. HdrHistogram-backed p50/p95/p99/max
    measurement, threshold-based pass/fail (exits non-zero on failure for
    CI). E1 (`harness e1`) and E3 (`harness e3`) shipped.
  - `k6/e1_baseline.js`, `k6/e3_burst.js` — operator-facing scripts for
    the production-faithful load path against a running `rdap-service`.
  - `run.sh` — orchestrator (`build` / `harness <scenario>` / `k6 <scenario>`)
    that handles mock lifecycle, readiness probes, and graceful teardown.
- **`loadtest/reports/STAGE_E_SLO_REPORT.md`** — captured numbers for
  E1 (10 000 req @ 1 000 rps, p95 **0.01 ms** vs. 50 ms target) and E3
  (2 000-burst, p95 **7.05 ms** vs. 300 ms target); both PASS.
- Workspace `Cargo.toml` `exclude` list extended with
  `loadtest/{mock-upstream,harness}` so they remain isolated.

### Added — Stage D · D2/D3/D4/D5/D6 (Tracing, Slow signal, Error class, SLO doc, Verbose mode)
- **`rdap-core/src/error_class.rs`** (D4) — canonical `ErrorClass` (with new
  `Internal` variant; `NetworkError` renamed to `Network` to align with the
  spec) and `RetryClass` enums plus `classify_error()` / `classify_retry()`.
  Single source of truth for the `class` label values on `rdap_errors_total`
  and `rdap_retry_total`. `Display` impl matches `metric_label()` so tracing
  fields and Prometheus labels carry the same string.
- **`rdap-metrics::sampling`** (D2) — `should_sample(verbose, rate)` decision
  helper plus `resolve_verbose(flag)` (reads `RDAP_TRACE=1` env var) and
  `fresh_request_id()` (UUID v7 — ms-precision timestamps so request IDs
  sort chronologically).
- **`rdap-core::fetcher`** (D2/D3/D6):
  - `rdap.fetch` span opens per HTTP attempt with redacted `origin`,
    `attempt`, and (when populated) `retry_class` / `status_code` fields.
  - Sampling decision is taken once per logical fetch; when off, `Span::none()`
    elides every `record()` call.
  - Slow-request signal moved from per-request `warn!` to bounded counter
    (`rdap_slow_requests_total`) plus a single sampled `info`-level event.
    Threshold is now `FetcherConfig::slow_request_threshold` (default 500 ms).
  - `verbose_trace` config flag plus `RDAP_TRACE=1` env override (resolved
    once at construction by `Fetcher::with_full_dependencies`).
  - All event-level logs scrub the raw URL — host comes from `redact_url`.
- **`rdapify-client`** (D2):
  - `rdap.query` span opens at the `fetch_with_cache` entry point with
    `request_id` (UUID v7), `query_type`, `cache_status` (hit/stale/negative/miss/disabled).
  - New `metrics` cargo feature (default off) propagates to
    `rdap-core/metrics`, `rdap-metrics/enabled`, `rdap-cache?/metrics`.
- **`rdap-metrics`** API change (D4):
  - `record_error` and `record_retry` now take `&'static str` labels (caller
    supplies `metric_label()` from the canonical `rdap-core::ErrorClass` /
    `RetryClass`). `ErrorClass` and `RetryClass` removed from
    `rdap_metrics::types` — single source of truth in `rdap-core`.
  - `record_slow_request` no longer takes a label argument.
- **`docs/SLO.md`** (D5) — Stage D service level objectives:
  availability ≥ 99 %, p50 < 50 ms, p95 < 300 ms, p99 < 1 s, error budget
  1 % per 30 d, three-tier alerting design (page / notify / log) with
  PromQL queries.
- **`rdap-core` test surface**:
  - `tests/observability.rs` — 5 end-to-end tests asserting metric
    increments for slow / fast / 4xx / 5xx-retry / breaker-open paths
    against a real mockito server.
  - `tests/tracing_redaction.rs` — captures `tracing` output from real
    fetches and asserts no raw host/port/path leaks via the engine's own
    spans / events.

### Changed
- The hardcoded `SLOW_LOG_THRESHOLD = 300 ms` in `rdap-core::fetcher` is
  removed in favour of `FetcherConfig::slow_request_threshold` (default
  500 ms — chosen to align with the Stage D spec and the SLO p95 target).
- All hot-path observability call sites now redact the URL before logging
  (Stage D rule: never log raw domain/IP). The full origin still flows
  to the bounded metric label (`rdap_circuit_breaker_open_total{origin}`,
  bounded by the circuit-breaker registry's 1024-cap moka LRU).

### Performance
- Default-feature build: zero overhead. With `metrics` off the only added
  cost is one `bool` short-circuit (`should_sample` returns `false` before
  any RNG draw).
- With `metrics` on but no tracing subscriber attached: the span macro
  resolves to a single atomic load; the `record()` calls are no-ops.
- Hot path makes zero heap allocations from observability code when
  `verbose_trace=false` and `trace_sample_rate=0.0`. Sampled-in calls
  allocate one `String` for the redacted origin (`scheme://tld:hash`) and,
  for `rdap.query`, one `String` for the UUID v7 request ID.

### Fixed (post-review)
- `classify_error` is now an exhaustive match on `RdapError` (no `_`
  wildcard). This caught one bug:
  `RdapError::RateLimited` (engine-side rate-limiter rejection) was falling
  into `Internal`; it now correctly maps to `ErrorClass::RateLimited`. Two
  new unit tests guard the regression.
- `redact_url` is no longer computed on the no-trace fast path. Previously
  the redacted origin string was built unconditionally on every fetch (one
  `String` alloc + URL parse); now it's gated behind `traced` so default
  builds pay nothing. The circuit-open warn path still computes it inline
  on-demand because that branch always logs.
- `Fetcher::verbose_trace_resolved()` exposes the env-resolved flag so
  `rdapify-client` can mirror the fetcher's tracing decision exactly. The
  client previously re-read `RDAP_TRACE` per call against the raw config
  flag, which could mismatch the fetcher's once-at-construction resolution
  if the env var was set after construction (a latent test flake).

### Added — Stage D · D1 (Observability + SLO)
- **`rdap-metrics`** (new crate, Apache-2.0): Prometheus-compatible metrics surface
  - Typed instrumentation hooks (`record_request`, `record_cache`, `record_retry`,
    `record_error`, `inflight_inc/dec`, `observe_circuit_open`, `set_circuit_state`,
    `set_semaphore_utilization`, `record_slow_request`)
  - `metrics` + `metrics-exporter-prometheus` recorder install + render API
  - PII redaction helpers (`redact_domain`, `redact_ip`, `redact_url`)
  - Bounded label enums (`QueryType`, `RequestStatus`, `CacheOutcome`,
    `ErrorClass`, `RetryClass`, `CircuitGaugeValue`) — cardinality safe by construction
  - Default histogram buckets `[0.001 .. 10.0]` seconds for `rdap_latency_seconds`
    and `rdap_retry_after_seconds`
  - 18 unit/integration tests (label shapes, cardinality bound, golden Prometheus
    output, redaction determinism)
- **`rdap-core`** (new `metrics` feature, default-off):
  - `inflight_requests` gauge bracketed around upstream HTTP attempts (drops
    during backoff sleeps so backoff doesn't count as inflight)
  - `errors_total{class}` counter at every error exit; classes match the engine's
    own retry/breaker classification (`network_error`, `timeout`, `rate_limited`,
    `invalid_response`, `circuit_open`)
  - `retry_total{class}` counter + `retry_after_seconds` histogram on each retry
  - `circuit_breaker_open_total{origin}` counter on each Closed→Open transition
  - New helpers: `classify_error()` and `classify_retry()` colocated with
    `retry_limit()` / `is_breaker_failure()` so all four classifications must
    move together
- **`rdap-cache`** (new `metrics` feature, default-off):
  - `cache_hits_total{freshness}`, `cache_misses_total`, and
    `cache_stale_served_total` counters wired into `MemoryCache::get_status`
- **`rdap-config`**: `MetricsConfig` extended with
  `slow_request_threshold_ms` (default 500), `top_n_origins` (default 50,
  capped at 1024), and `histogram_buckets: Option<Vec<f64>>` with strict
  validation (positive, finite, strictly increasing). 9 new validation tests.

### Changed
- Default-feature build remains zero-overhead — every metrics call site is an
  inline no-op when the `metrics` cargo feature is off (LTO elides the calls).
  The `metrics` facade is **not** linked in default builds.

### Notes
- Metric names use the `rdap_*` prefix per the Stage D spec, superseding the
  `rdapify_*` placeholder in `RDAPify-Internal/planning/V1_STABILIZATION_PLAN.md`
  Domain 8. See `RDAPify-Internal/DECISIONS.md`.
- `rdapify-pro/crates/pro-metrics/` continues to ship its own independent
  Prometheus surface (using the `prometheus` crate); core's surface does not
  duplicate or depend on it.

## [0.5.0] — 2026-04-08

### Performance
- Replaced chunk-based execution with `buffer_unordered` in `rdap-batch` — 3–10× faster batch processing, no per-chunk stall
- Streaming batch execution with O(1) peak memory (`O(concurrency + buffer)`) regardless of input size
- New `BatchExecutor::run_stream()` API — results stream back as they arrive via `ReceiverStream`
- Optimized `rdapify-client` to integrate rate limiting into the query path

### Added
- **`rdap-rate-limit`**: Full GCRA implementation via `governor` crate — per-host and global limiters
  - `RdapRateLimiter` with `DashMap`-backed per-host state (no `DashMap` ref held across `.await`)
  - `RateLimitConfig` with sensible defaults (10 rps / 20 burst per host, 100 rps global)
  - Async `acquire()` with `tokio::time::sleep` — integrates cleanly with async stack
- **`rdap-batch`**: `BatchQuery` enum covering `Domain`, `Ip`, `Asn`, `Nameserver`
- **`rdap-types`**: `RdapError::RateLimited { host, wait_time }` variant + `is_rate_limited()` helper
- **`rdap-service`**: Full HTTP API with Prometheus metrics endpoint (`/metrics`), graceful shutdown (SIGTERM)
- **`rdapify-client`**: `ClientConfig::rate_limit: Option<RateLimitConfig>` field
- New integration tests: 36 integration tests + 6 streaming tests, 188 total (0 failures)
- New benchmarks: `batch.rs`, `bootstrap.rs`, `validation.rs`
- `QUICKSTART.md` — getting-started guide
- `docs/CLI.md` — updated CLI reference
- Prometheus + Grafana monitoring stack in `deploy/monitoring/`

### Fixed
- Chunk-based concurrency bottleneck in batch engine (one slow query no longer stalls an entire chunk)
- Missing rate limit enforcement in client query path
- Unused import warning in streaming integration tests

### rdapify-nd / rdapify-py
- **rdapify-nd 0.5.0** — Node.js N-API binding updated
- **rdapify-py 0.5.0** — Python PyO3 binding updated

## [0.4.0] — 2026-04-06

### Added
- **11-crate workspace** — `rdap-types`, `rdap-security`, `rdap-bootstrap`, `rdap-core`, `rdapify-client`, `rdap-cache`, `rdap-stream`, `rdap-rate-limit`, `rdap-batch`, `rdap-cli`, `rdapify`
- **`rdap-config`** — `rdapify.toml` configuration system with env-variable overrides
- **`rdap-logging`** — structured JSON/text logging
- **`rdap-service`** — axum HTTP service skeleton (`/health`, `/version`)
- **`rdap-sqlite`**, **`rdap-postgres`**, **`rdap-mysql`** — storage backend stubs
- **SQLite hardened persistence** — WAL, integrity checks, schema migrations
- Feature flags: `memory-cache`, `stream`, `batch`, `rate-limit`, `service`, `sqlite`, `postgres`, `mysql`
- **rdapify-nd 0.4.0** — Node.js N-API binding updated
- **rdapify-py 0.4.0** — Python PyO3 binding updated

### Security
- SSRF protection in `rdap-security` (URL + DNS pre-resolution)
- DNS rebinding protection
- HTTP redirect chain validation  
- Configurable response size limit
- `#![forbid(unsafe_code)]` on all crates

### Performance
- DashMap-backed in-memory cache (`rdap-cache`)
- `opt-level = "z"`, LTO, strip, `panic = "abort"` in release profile
- Criterion benchmarks: `cache`, `ssrf`, `query`, `streaming`, `batch`, `bootstrap`, `validation`

### Internal
- MSRV raised to **1.77**
- Multi-platform CI (Ubuntu, macOS, Windows)
- `cargo clippy --workspace -- -D warnings` enforced

## [0.2.1] — 2026-03-23

### Added

- **`stream_asn()`** and **`stream_nameserver()`** — complete the streaming API with ASN and nameserver query streams
- **rdapify-nd v0.1.3** — Node.js binding updated to match core v0.2.1
- **rdapify-py v0.2.1** — Python binding updated to match core v0.2.1

### Fixed

- rdapify-py version corrected from 0.1.1 to 0.2.1 (PyPI already had 0.2.0)

## [0.2.0] — 2026-03-22

### Added

- **Async Streaming API** — `client.stream_domain(names) -> ReceiverStream<DomainEvent>` and `client.stream_ip(addresses) -> ReceiverStream<IpEvent>`; yields results as they arrive without buffering the full batch
- **Back-pressure** — bounded `tokio::sync::mpsc` channel; `StreamConfig.buffer_size` controls capacity (default 32); senders block when the consumer falls behind — no unbounded memory growth at scale
- **`DomainEvent` / `IpEvent`** enums — `Ok(DomainResponse)` / `Err(RdapError)` variants; large variants boxed to suppress `clippy::large_enum_variant`
- **Connection pool config** — `ClientConfig.reuse_connections: bool` (default `true`) and `ClientConfig.max_connections_per_host: usize` (default `10`)
- **Go binding** (`rdapify-go`) — initial cgo wrapper at `bindings/go/rdapify.go` around the `cdylib` target; exposes 5 synchronous functions (`domain`, `ip`, `asn`, `nameserver`, `entity`) that internally drive a `tokio` runtime; C header `rdapify.h` with full doc comments; CI build-check job added to `.github/workflows/ci.yml`
- **Streaming benchmark** — `benches/streaming.rs` (Criterion) measuring throughput for `stream_domain` under concurrent load

### Tests

- stream yields all results in order
- error in one item does not cancel remaining items
- cancel mid-stream (drop receiver) terminates sender gracefully

## [0.1.3] — 2026-03-22

### Added

- **`domain_available()`** — `client.domain_available(name) -> Result<AvailabilityResult>` checks whether a domain is available for registration; returns `available: true` on HTTP 404 from the registry, `available: false` with `expires_at` for registered domains
- **`AvailabilityResult`** type: `{ domain: String, available: bool, expires_at: Option<String> }` — exported from the public API
- **`ClientConfig.custom_bootstrap_servers: HashMap<String, String>`** — custom TLD → RDAP server URL overrides, consulted before the IANA bootstrap lookup
- 11 new integration tests: `domain_available` happy path, 404 → available, error propagation, invalid domain/IP/ASN, cache disabled, max_attempts=1, custom bootstrap server

## [0.1.2] — 2026-03-21

### Changed

- **Rename**: Node.js binding renamed from `@rdapify/core` → `rdapify-nd` on npm
- **Rename**: Python binding renamed from `rdapify` → `rdapify-py` on PyPI; Python import name changed from `rdapify` → `rdapify_py`
- **Performance**: `rdapify-nd` napi binding now uses a module-level `OnceLock<RdapClient>` singleton — eliminates per-call client construction overhead

### Fixed

- **CI**: fixed duplicate `aarch64-apple-darwin` target in `bindings.yml` napi build matrix (was also listed in `napi.triples.defaults`)

### Documentation

- Added full usage examples for `rdapify-nd` (Node.js) and `rdapify-py` (Python) in README

## [0.1.1] — 2026-03-21

### Fixed

- **Security**: upgraded `idna` to resolve GHSA advisory for invalid domain label processing
- **Security**: upgraded `rustls-webpki` to resolve GHSA advisory for CPU exhaustion via crafted certificate chains
- **CI**: fixed MSRV job to allow transient network failures gracefully (`CARGO_NET_RETRY=10`)
- **CI**: fixed live-test workflow (added `#[ignore]` to integration tests that hit live servers)
- **CI**: added `cargo fetch` step to improve reliability on slow/flaky runners

### Changed

- Bindings CI/CD workflow now publishes `rdapify-nd` (npm) and `rdapify-py` (PyPI) automatically on version tags

## [0.1.0] — 2026-03-20

### Added

- **5 query types** via `RdapClient`: `domain()`, `ip()`, `asn()`, `nameserver()`, `entity()`
- **IANA Bootstrap** (RFC 9224) for automatic RDAP server discovery — DNS, IPv4, IPv6, ASN
- **SSRF protection** — blocks requests to loopback, private, link-local, and broadcast addresses for both IPv4 and IPv6; uses typed `url::Host` enum to avoid re-parsing
- **In-memory cache** backed by `DashMap` — configurable TTL (default 5 min) and max entries (default 1 000); lazy expiry on read, eager eviction at capacity
- **IDN / Punycode normalisation** via `idna` crate (RFC 5891) — accepts Unicode domain names transparently
- **Exponential back-off retry** — configurable max attempts, initial delay, and max delay; retries on network errors and 429/5xx HTTP status codes
- **Typed response structs** with serde: `DomainResponse`, `IpResponse`, `AsnResponse`, `NameserverResponse`, `EntityResponse`; common types `RdapStatus`, `RdapRole`, `RdapEvent`, `RdapLink`, `RdapRemark`, `RdapEntity`
- **`RegistrarSummary`** extracted automatically from domain entity list (name, handle, URL, abuse contact)
- **`ResponseMeta`** on every response: source URL, queried-at timestamp, cached flag
- **CLI binary** (`rdapify`) with subcommands `domain`, `ip`, `asn`, `nameserver`, `entity`; `--raw` flag for machine-readable JSON output; enabled via `cli` feature flag
- **Node.js binding** (`rdapify-nd`) via `napi-rs` — 5 async JS functions, full TypeScript type definitions, multi-platform prebuilt binary support
- **Python binding** (`rdapify-py`) via `PyO3` + `maturin` — 5 synchronous Python functions backed by a `tokio` runtime; abi3-py38 wheel for broad Python compatibility
- **43 integration tests** using `mockito` HTTP mock server — happy paths for all 5 query types, 404 / no-server error paths, IDN normalisation, SSRF blocking, cache deduplication
- **GitHub Actions CI** — multi-platform matrix (Ubuntu, macOS, Windows) + MSRV 1.75 job; lint (`rustfmt` + `clippy -D warnings`); security audit (`cargo-audit`); coverage (`cargo-tarpaulin` → Codecov)
- **Automated release workflow** — triggered on `v*.*.*` tags; verifies tag matches `Cargo.toml` version; publishes to crates.io; creates GitHub Release with CHANGELOG entry
- **Daily live-test workflow** — runs against real RDAP servers at 06:00 UTC; opens a GitHub Issue on failure

[Unreleased]: https://github.com/rdapify/rdapify-rs/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/rdapify/rdapify-rs/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/rdapify/rdapify-rs/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/rdapify/rdapify-rs/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/rdapify/rdapify-rs/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/rdapify/rdapify-rs/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/rdapify/rdapify-rs/releases/tag/v0.1.0
