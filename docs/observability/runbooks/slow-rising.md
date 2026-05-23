# RdapifySlowRequestRising — runbook

> **Severity:** info · log / digest only.
> **Trigger:** `rate(rdap_slow_requests_total[5m]) > 1` for 15 m.
>
> **Co-firing:** the info-tier precursor to `RdapifyP95LatencyAboveSlo`. If both fire, defer to the warning-tier runbook — see [`p95-slo.md`](p95-slo.md).

## 1. What it means

More than one request per second is exceeding the configured
slow-request threshold (default 500 ms — deliberately above the p95
SLO of 300 ms, so the counter only ticks on outliers). This is a
**leading indicator**: by itself not actionable, but if it's climbing
alongside semaphore wait or upstream latency, the next thing to fire
is likely `RdapifyP95LatencyAboveSlo`.

## 2. Likely causes

Same root causes as `RdapifyP95LatencyAboveSlo` but at lower
intensity. Also includes:

- A small set of queries that are inherently slow (e.g. nameserver
  lookups across many TLDs) — this is workload, not engine health.
- An upstream that's drifted from "fast enough" to "borderline".

## 3. Verify

Are the slow requests spread across types or concentrated?

```promql
sum by (type) (
  histogram_quantile(0.95,
    sum by (le, type) (rate(rdap_latency_seconds_bucket[5m]))
  )
)
```

Is the slow-request rate climbing in a way that predicts a p95 break?

```promql
deriv(rate(rdap_slow_requests_total[5m])[30m:])
```

A positive derivative for 30 m is a soft warning — eyeball the trend.

## 4. Actions

> This alert is intentionally **info-tier**: it surfaces a leading
> indicator, not a live problem. None of the actions below requires
> paging. If no other alert is co-firing, the only "action" is to
> note the row in the digest and move on.

- **Read-only acknowledgement** — note the row in the daily digest;
  no engine-side change.
- **Climbing > 1 hour** — open [`p95-slo.md`](p95-slo.md) and walk
  its §3 verify queries preemptively. If wait p95 or upstream p95 is
  also rising, the warning-tier alert is likely next; act there.
- **One `type` dominates** — check whether that query type's cache
  sizing is appropriate. Concrete check:
  `sum by (type) (increase(rdap_cache_hits_total[1h]))` vs.
  `sum by (type) (increase(rdap_cache_misses_total[1h]))`. If miss
  rate is disproportionate, consider raising `cache.max_entries` for
  the next maintenance window (no live change required).

## 5. Escalate

- Generally, do not. If this alert fires alongside any warning-tier
  alert, defer to that one's escalation path.

## 6. Stop when

- `rate(rdap_slow_requests_total[5m]) < 1` for 15 minutes
  (below the alert's `for:` window).

This alert never requires immediate action; the stop condition exists
mainly so the daily digest can clear it from the active set.

## See also

- [`p95-slo.md`](p95-slo.md) — the warning-tier sibling.
- `../METRICS.md#rdap_slow_requests_total`.

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
