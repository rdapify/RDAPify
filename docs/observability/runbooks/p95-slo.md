# RdapifyP95LatencyAboveSlo — runbook

> **Severity:** warning · notify team.
> **Trigger:** p95 latency > 300 ms for 10 m (the SLO ceiling).
>
> **Co-firing:** typically with `RdapifyLatencyBudgetFastBurn`/`SlowBurn` (budget-burn framing of the same condition) and `RdapifySemaphoreWaitElevated` when queue-bound. See [`latency-budget-fast-burn.md`](latency-budget-fast-burn.md), [`semaphore-wait.md`](semaphore-wait.md).

## 1. What it means

End-to-end p95 latency at the `RdapClient` boundary has been above the
documented SLO of 300 ms for 10 minutes. 5 % of users are seeing
slower-than-promised lookups. Not paging unless paired with
inflight saturation or an error spike, but actionable.

## 2. Likely causes

| # | Cause | Verify |
|---|-------|--------|
| 1 | Upstream registries are slower than usual | upstream is the bottleneck — see "Verify" below |
| 2 | Engine is queueing on the global semaphore | `rdap_semaphore_wait_seconds{kind="global"}` p95 > 100 ms |
| 3 | One query type has slowed (e.g. nameserver lookups) | latency p95 by `type` |
| 4 | Cache hit ratio dropped — more queries reach upstream | `rdap_cache_hits_total / (hits+misses)` < 50 % |
| 5 | Per-host pressure: one origin has a deep queue | `rdap_per_host_queue_depth` p95 climbs |

## 3. Verify

Decompose the p95 by source:

```promql
# By query type — does one type dominate?
histogram_quantile(0.95,
  sum by (le, type) (rate(rdap_latency_seconds_bucket[5m]))
)

# Is wait time the cause?
histogram_quantile(0.95,
  sum by (le) (rate(rdap_semaphore_wait_seconds_bucket{kind="global"}[5m]))
)

# Is upstream the cause? (latency high, wait normal = upstream is slow)
histogram_quantile(0.95, sum by (le) (rate(rdap_latency_seconds_bucket[5m])))
  -
histogram_quantile(0.95, sum by (le) (rate(rdap_semaphore_wait_seconds_bucket{kind="global"}[5m])))
```

## 4. Actions

- **Upstream slow** — confirm with their status page; if intermittent,
  watch for it to spread to `RdapifyRetrySpike` →
  `RdapifyHighErrorRate`. No engine-side action.
- **Wait p95 high** — see [`semaphore-wait.md`](semaphore-wait.md);
  raise `concurrency_limit` or reduce caller pressure.
- **One query type slow** — check whether that type has special
  bootstrap behaviour (nameserver and entity types fan out to more
  registries than domain).
- **Cache hit ratio low** — see [`cache-hit-low.md`](cache-hit-low.md).
- **Per-host queue depth high** — see
  [`semaphore-wait.md`](semaphore-wait.md) `kind=per_host`. Raise
  `per_host_concurrency_limit` for the affected origin.

## 5. Escalate

- p95 > 1 s for 10 m → upgrade to incident handling (this is also
  the boundary at which `RdapifyLatencyBudgetFastBurn` fires).
- p95 > 300 ms sustained for > 1 h with no obvious cause →
  **engine team (Rust core)**; check for permit leak (see
  [`inflight-saturation.md`](inflight-saturation.md)) or runtime
  contention.

## 6. Stop when

- `histogram_quantile(0.95, sum by (le) (rate(rdap_latency_seconds_bucket[5m]))) < 0.300`
  for 10 minutes (back under the SLO ceiling), **AND**
- the partner latency-budget alert (if firing) has resolved.

## See also

- [`latency-budget-fast-burn.md`](latency-budget-fast-burn.md) and
  [`latency-budget-slow-burn.md`](latency-budget-slow-burn.md) —
  budget-burn versions of the latency SLO.
- `../SLO.md` — formal SLO definition.

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
