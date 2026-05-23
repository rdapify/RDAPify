# RdapifyLatencyBudgetSlowBurn — runbook

> **Severity:** warning · notify team.
> **Trigger:** latency budget burning at **≥ 6×** the steady rate
> over both the **30 m** and **6 h** windows.
>
> **Co-firing:** the chronic counterpart to `RdapifyLatencyBudgetFastBurn`; investigate alongside `RdapifyP95LatencyAboveSlo` if both fire — see [`latency-budget-fast-burn.md`](latency-budget-fast-burn.md), [`p95-slo.md`](p95-slo.md).

## 1. What it means

The latency budget (5 % of requests above 300 ms p95 SLO over 30 d)
is burning fast enough to exhaust in roughly **5 days**. Sustained
across two windows, so this is not a momentary blip — but it's slow
enough to investigate during business hours.

## 2. Likely causes

Same root-cause taxonomy as
[`latency-budget-fast-burn.md`](latency-budget-fast-burn.md), but with
the patterns that produce *chronic*, not acute, slowdown:

| # | Cause | Look at |
|---|-------|---------|
| 1 | One query type (often nameserver) has gradually drifted upward | `histogram_quantile(0.95, sum by (le, type) (rate(rdap_latency_seconds_bucket[6h])))` per `type` |
| 2 | Cache TTL too short for the workload — more queries reach upstream | hit ratio `sum(rate(rdap_cache_hits_total[6h])) / clamp_min(sum(rate(rdap_cache_hits_total[6h])) + sum(rate(rdap_cache_misses_total[6h])), 1)` (target > 70 %) |
| 3 | Engine sized below steady-state need — small persistent queue | `histogram_quantile(0.95, sum by (le) (rate(rdap_semaphore_wait_seconds_bucket{kind="global"}[6h])))` |

## 3. Verify

Confirm both windows are firing:

```promql
1 - (
  sum(rate(rdap_latency_seconds_bucket{le="0.3"}[30m]))
  / clamp_min(sum(rate(rdap_latency_seconds_count[30m])), 1)
) > (6 * 0.05)

1 - (
  sum(rate(rdap_latency_seconds_bucket{le="0.3"}[6h]))
  / clamp_min(sum(rate(rdap_latency_seconds_count[6h])), 1)
) > (6 * 0.05)
```

Find the slowest type:

```promql
histogram_quantile(0.95,
  sum by (le, type) (rate(rdap_latency_seconds_bucket[6h]))
)
```

## 4. Actions

- **One type slow** — investigate that type's bootstrap path or
  upstream registries.
- **Cache hit ratio chronically below target** — tune `fresh_ttl`
  or `max_entries`; see [`cache-hit-low.md`](cache-hit-low.md).
- **Persistent queue wait** — raise `concurrency_limit` during the
  next maintenance window; see [`semaphore-wait.md`](semaphore-wait.md).

## 5. Escalate

- Burn stays at ≥ 6× for > 24 h → escalate to a capacity-planning
  ticket.
- Accelerates to fast-burn (14.4×) → `RdapifyLatencyBudgetFastBurn`
  fires; switch to that runbook.

## 6. Stop when

- The 30-minute and 6-hour fractions of requests above 300 ms are **both**
  below the `6 × 0.05 = 30 %` MWMBR threshold for at least 1 hour.

If the chronic cause was a slow-drifting query type, also confirm
`histogram_quantile(0.95, sum by (le, type) (rate(rdap_latency_seconds_bucket[6h])))`
shows the affected `type` returned to its pre-drift baseline.

## See also

- [`latency-budget-fast-burn.md`](latency-budget-fast-burn.md).
- [`p95-slo.md`](p95-slo.md).
- `../SLO.md` §2 — formal latency SLO.

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
