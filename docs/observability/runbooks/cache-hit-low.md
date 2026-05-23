# RdapifyCacheHitRatioLow — runbook

> **Severity:** warning · notify team.
> **Trigger:** cache hit ratio < 50 % for 30 m, with request rate > 1 r/s
> (below 1 r/s the ratio is too noisy to trust).
>
> **Co-firing:** typically preceded by `RdapifyCacheCapacityPressure` and (if upstream pressure rises) followed by `RdapifyP95LatencyAboveSlo`. See [`cache-pressure.md`](cache-pressure.md), [`p95-slo.md`](p95-slo.md).

## 1. What it means

Less than half of the queries are being served from cache. Operational
target is > 70 % under steady production load. Low hit ratio doesn't
directly break anything, but it inflates upstream pressure and latency
across the board — so this often precedes other alerts.

Note: hit ratio is **a property of workload**, not of the engine.
A genuinely diverse workload simply has a low hit ratio. The alert
exists to flag a *change* in that ratio, not to demand a specific value.

## 2. Likely causes

| # | Cause | Look at |
|---|-------|---------|
| 1 | Working set exceeds `cache.max_entries` (default 1000); LRU eviction is making the cache forget recent entries | `rdap_cache_entries_current` near cap and `rdap_cache_evictions_total` non-zero |
| 2 | TTL too short for the workload | `rdap_cache_hits_total{freshness="fresh"}` low vs. `freshness="stale"` |
| 3 | Workload pattern shift — new caller is generating unique queries | request rate up but hit ratio down |
| 4 | Cache was just cleared (deploy / restart) | one-off; hit ratio recovers in minutes |

## 3. Verify

Cache pressure check:

```promql
rdap_cache_entries_current
rate(rdap_cache_evictions_total[5m])
```

Freshness breakdown — are stale hits crowding out fresh ones?

```promql
sum by (freshness) (rate(rdap_cache_hits_total[5m]))
```

Recent restart? Look for `rdap_cache_entries_current` dropping to ~0
in the last hour on the cache panel.

## 4. Actions

- **Working-set pressure** — raise `cache.max_entries`. The cap is a
  soft trade-off: more entries = more memory. In practice, doubling
  is safe; the cache is small per-entry. Watch
  `rdap_cache_entries_current` flatten under the new cap.
- **TTL too short** — raise `cache.fresh_ttl`. Default fresh TTL is
  5 minutes for most query types; some workloads (registry data
  changes slowly) tolerate hours.
- **Workload shift** — usually self-corrects as the new caller's
  working set warms the cache.
- **Recent deploy / restart** — wait. The cache warms in proportion
  to traffic; expect 10–30 minutes to reach steady-state at moderate
  load.

## 5. Escalate

- Hit ratio stays below 30 % for > 2 h with no obvious cause →
  involve the **engine team (Rust core)** to investigate whether
  cache keys are being computed inconsistently (a real bug in this
  area would be visible as a high `freshness="negative"` rate).
- Memory budget for the cache is the concern stopping you from
  raising `max_entries` → architecture conversation about a tiered
  cache (planned for a future minor release).

## 6. Stop when

- Hit ratio
  `sum(rate(rdap_cache_hits_total[5m])) / clamp_min(sum(rate(rdap_cache_hits_total[5m])) + sum(rate(rdap_cache_misses_total[5m])), 1)`
  is > 70 % (operational target) for 10 minutes, **OR**
- the alert auto-resolves.

If `cache.max_entries` was raised, expect 10–30 minutes of cache warming
before hit ratio reflects the new cap.

## See also

- [`cache-pressure.md`](cache-pressure.md) — the info-tier alert
  for cache near cap with eviction; often fires first.
- `../METRICS.md#rdap_cache_hits_totalfreshness`.

---

## Feedback log

Append a row after every fire (or near-miss where this alert *should*
have fired but didn't). The 30-day rolling **precision target** is
**≥ 0.80 for critical** alerts, **≥ 0.50 for warning** — see
[`../CALIBRATION.md`](../CALIBRATION.md) §4 for definitions and the
tracking template.

| Date | Fired? | Real? | Threshold change? | Notes (incident / PR link) |
|------|--------|-------|-------------------|----------------------------|
| _yyyy-mm-dd_ | yes / no | yes / no | none / `for:` / threshold / severity | one-line context |

> _Replace the example row with real entries. Older entries can be
> archived once a quarterly calibration review has signed off on
> them._

**Last calibration review:** _yyyy-mm-dd — outcome (kept / tuned /
downgraded / deleted)_

### Post-incident review

After every incident in which this runbook was actually used, append a
row capturing the operator-judged effectiveness of the runbook itself:

| Date | Clarity (1–5) | Missing steps | Action taken | Outcome |
|------|---------------|---------------|--------------|---------|
| _yyyy-mm-dd_ | 1–5 | free text or "none" | one-line summary | mitigated / escalated / no-op / runbook-failed |

Clarity scale: see `../TUNING_REPORT.md` §D. Outcome:
- **mitigated** — operator action returned the system to baseline.
- **escalated** — handed off per §5; not yet resolved when this row was filed.
- **no-op** — alert self-resolved before any action was needed (often FP).
- **runbook-failed** — runbook did not point at the cause; file a runbook-quality ticket per the closing paragraph below.

A row of `clarity ≤ 2` or `outcome == runbook-failed` is a higher-priority
calibration signal than a missing alert — do not let it sit.

### After every incident this runbook was used in

Update **at least one of** the runbook sections with what you
learned, even if the change is small:

- §2 **Likely causes** — did the dominant cause match what the table
  predicted? If a new cause appears, add it.
- §3 **Verify** — did the diagnostic queries point at the cause
  fast? If not, replace them with what *did* work.
- §4 **Actions** — was the suggested action the right one? If a
  different mitigation worked, document it.
- §5 **Escalate** — was the escalation path correct, or did you
  end up paging the wrong team?

If the runbook didn't help at all, that's a higher-priority signal
than a missing alert — file a runbook-quality ticket and rewrite
the section that failed.
