# RdapifySemaphoreWaitElevated — runbook

> **Severity:** warning · notify team.
> **Trigger:** global semaphore wait p95 > 100 ms for 10 m.
>
> **Co-firing:** the warning-tier precursor to `RdapifyInflightSaturation` and often co-fires with `RdapifyP95LatencyAboveSlo`. See [`inflight-saturation.md`](inflight-saturation.md), [`p95-slo.md`](p95-slo.md).

## 1. What it means

Requests are spending more than 100 ms p95 just waiting for a
concurrency permit before any HTTP work begins. The global cap is
meaningfully constraining throughput. End-user p95 latency includes
this wait — every 100 ms of wait is 100 ms added to user-visible
latency, on top of upstream time.

This is the precursor to `RdapifyInflightSaturation`. If wait climbs
without ever paging, you're operating right at capacity; if it climbs
*and* inflight saturates, you're past capacity.

## 2. Likely causes

| # | Cause | Look at |
|---|-------|---------|
| 1 | Cap is sized below current traffic | `rdap_inflight_requests` near `concurrency_limit` |
| 2 | Upstream got slower so each permit is held longer | `rdap_latency_seconds` p95 climbing in parallel |
| 3 | Workload mix shifted toward query types with longer responses (e.g. nameserver lookups) | latency p95 by `type` |
| 4 | Caller suddenly stopped batching / caching responses upstream of RDAPify | request rate spiked |

## 3. Verify

Capacity-bound vs. latency-bound:

```promql
# Capacity-bound: wait is high AND inflight is high.
(
  histogram_quantile(0.95, sum by (le) (rate(rdap_semaphore_wait_seconds_bucket{kind="global"}[5m]))) > 0.1
)
and
(rdap_inflight_requests > 200)

# Latency-bound: wait is high because each request takes longer.
(
  histogram_quantile(0.95, sum by (le) (rate(rdap_semaphore_wait_seconds_bucket{kind="global"}[5m]))) > 0.1
)
and
(
  histogram_quantile(0.95, sum by (le) (rate(rdap_latency_seconds_bucket[5m]))) > 0.3
)
```

## 4. Actions

- **Capacity-bound, traffic is normal** — raise `concurrency_limit`
  in the engine config (default 256, documented ceiling 4096). Bump
  in steps of 2×.
- **Latency-bound** — see [`p95-slo.md`](p95-slo.md). Raising
  concurrency just moves the queue into upstream; it won't help and
  may cause `rate_limited` errors.
- **Spike in caller traffic** — coordinate with the producing service
  (back-pressure or caching at their layer is usually cheaper than
  scaling RDAPify).

## 5. Escalate

- Wait > 500 ms p95 sustained → upgrade to incident-level handling
  (this is the same threshold above which `RdapifyInflightSaturation`
  typically follows within minutes).
- Cap already at the documented ceiling and still saturating →
  architecture conversation about per-origin sub-pools (planned
  v0.7.0) or horizontal scale-out.

## 6. Stop when

- `histogram_quantile(0.95, sum by (le) (rate(rdap_semaphore_wait_seconds_bucket{kind="global"}[5m]))) < 0.05`
  (50 ms — half the alert threshold) for 10 minutes.

If `concurrency_limit` was raised, watch for 30 minutes that the wait
stays low at the new cap before declaring the change accepted.

## See also

- [`inflight-saturation.md`](inflight-saturation.md) — the
  critical-tier sibling.
- `../METRICS.md#rdap_semaphore_wait_secondskind`.

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
