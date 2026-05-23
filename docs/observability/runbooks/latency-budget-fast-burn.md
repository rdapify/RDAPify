# RdapifyLatencyBudgetFastBurn — runbook

> **Severity:** critical · pages on-call.
> **Trigger:** latency budget burning at **≥ 14.4×** the steady rate
> over both the **5 m** and **1 h** windows.
>
> **Co-firing:** typically with `RdapifyP95LatencyAboveSlo` and sometimes `RdapifyInflightSaturation` (latency-bound). See [`p95-slo.md`](p95-slo.md), [`inflight-saturation.md`](inflight-saturation.md).
>
> Latency budget definition: at most **5 %** of requests may exceed
> the p95 SLO ceiling of 300 ms over 30 days.

## 1. What it means

Far more than 5 % of requests are exceeding the 300 ms latency SLO
right now, sustained across short and medium windows. Users are
seeing slow lookups *systemically*. If sustained, the latency budget
exhausts in about **2 hours**.

## 2. Likely causes

Ranked by frequency:

| # | Cause | Look at |
|---|-------|---------|
| 1 | Upstream registry slow but not failing | `rdap_latency_seconds{type}` p95 climbing, error rate normal |
| 2 | Engine queueing on the global semaphore | `rdap_semaphore_wait_seconds{kind="global"}` p95 high |
| 3 | Cache hit ratio dropped — more queries reach upstream | hits / (hits + misses) dropping |
| 4 | Per-host saturation on a busy origin | `rdap_per_host_queue_depth` p95 high |

## 3. Verify

Confirm both windows are firing:

```promql
# Fast window (5 m) — fraction of requests above 300 ms.
1 - (
  sum(rate(rdap_latency_seconds_bucket{le="0.3"}[5m]))
  / clamp_min(sum(rate(rdap_latency_seconds_count[5m])), 1)
) > (14.4 * 0.05)

# Slow window (1 h) — same.
1 - (
  sum(rate(rdap_latency_seconds_bucket{le="0.3"}[1h]))
  / clamp_min(sum(rate(rdap_latency_seconds_count[1h])), 1)
) > (14.4 * 0.05)
```

Decompose: is the cause upstream slowness, queueing, or both?

```promql
# p95 latency, p95 wait — if wait is most of latency, we're queueing.
histogram_quantile(0.95, sum by (le) (rate(rdap_latency_seconds_bucket[5m])))
histogram_quantile(0.95, sum by (le) (rate(rdap_semaphore_wait_seconds_bucket{kind="global"}[5m])))
```

## 4. Actions

Follow [`p95-slo.md`](p95-slo.md) §4. The burn-rate framing adds
urgency; the diagnostic and remediation steps are the same. Add to
the incident message: "we will exhaust the 30-day latency budget in
~2 hours at this rate".

## 5. Escalate

- Burn rate stays at ≥ 14.4× for > 30 m → declare a **major
  incident** (see [`../INCIDENT.md`](../INCIDENT.md)).
- p95 above 1 s sustained → at this point users are visibly
  unhappy; involve customer-facing teams.

## 6. Stop when

- The 5-minute and 1-hour fractions of requests above 300 ms are **both**
  below the `14.4 × 0.05 = 72 %` MWMBR threshold for at least 30 minutes, **AND**
- p95 latency < 300 ms for 10 minutes.

Confirm the burn rate over the last 1 hour is < 1× before declaring
recovery.

## See also

- [`latency-budget-slow-burn.md`](latency-budget-slow-burn.md) —
  the warning-tier counterpart.
- [`p95-slo.md`](p95-slo.md) — instantaneous-threshold sibling
  with the same root-cause taxonomy.
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
