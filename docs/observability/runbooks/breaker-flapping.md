# RdapifyBreakerFlapping — runbook

> **Severity:** warning · notify team.
> **Trigger:** ≥ 15 closed→open or half_open→open transitions in 5 m.
>
> **Co-firing:** typically with `RdapifyBreakerOpenSurge` (when flapping degenerates into mostly-Open) and `RdapifySingleBreakerOpen`. See [`breaker-open-surge.md`](breaker-open-surge.md), [`breaker-open-info.md`](breaker-open-info.md).

## 1. What it means

The breaker is repeatedly tripping. Every cooldown ends with another
failure. The upstream is **intermittently** broken — bad enough to
trip, but not bad enough to stay tripped. From the user's point of
view this is the worst pattern: requests sometimes go through, often
fail with `circuit_open`, and there's no clean signal of recovery.

## 2. Likely causes

| # | Cause | Look at |
|---|-------|---------|
| 1 | Upstream is overloaded — recovers under low traffic, fails again when probed | check status page, then increase cooldown |
| 2 | Cooldown is too short for the upstream's actual recovery time | `half_open→open` transitions dominate |
| 3 | Failure threshold is too sensitive (false-trip on isolated 5xx) | low `rdap_errors_total{class}` overall but many trips per origin |
| 4 | Upstream blue/green deploy — half the backends are healthy, half aren't | flapping on a single origin, others fine |

## 3. Verify

Identify the origin:

```promql
topk(3,
  increase(rdap_circuit_breaker_transitions_total{from="closed",to="open"}[5m])
+ increase(rdap_circuit_breaker_transitions_total{from="half_open",to="open"}[5m])
)
```

Distinguish "fresh trips" from "probe failures":

```promql
sum by (origin) (increase(rdap_circuit_breaker_transitions_total{from="closed",to="open"}[15m]))
sum by (origin) (increase(rdap_circuit_breaker_transitions_total{from="half_open",to="open"}[15m]))
```

If `half_open→open` dominates: cooldown ends, probe immediately fails,
trip again. If `closed→open` dominates: every recovery handles a few
real requests then fails again.

## 4. Actions

- **`half_open→open` dominant** — extend the breaker cooldown for
  this origin (or globally). Default is 30 s; for this pattern,
  60–120 s usually breaks the cycle.
- **`closed→open` dominant** — failure threshold may be too low for
  current upstream noise. Raise `failure_threshold` (e.g. 5 → 10).
- **One specific origin only** — likely an upstream blue/green or a
  load-balancer health-check issue on their side. Notify the registry
  operator with timestamps.
- **Multiple origins simultaneously flapping** — likely network
  egress flapping on our side. Escalate to **network on-call**.

## 5. Escalate

- > 30 m of flapping on one origin → notify the registry operator.
- Multiple origins flapping → **network on-call**.
- Repeated false trips on the same origin across days → file a
  tuning ticket; consider per-origin breaker config (planned v0.7.0).

## 6. Stop when

- `increase(rdap_circuit_breaker_transitions_total{from="closed",to="open"}[5m]) + increase(rdap_circuit_breaker_transitions_total{from="half_open",to="open"}[5m]) < 5`
  for 10 minutes (well below the 15-trips alert threshold), **AND**
- a clean `half_open → closed` transition has occurred for the affected
  origin within the last 30 minutes.

If breaker `cooldown` or `failure_threshold` was tuned for this origin,
hold the change for at least one full upstream maintenance cycle
before generalising it.

## See also

- [`breaker-open-surge.md`](breaker-open-surge.md) — fires when
  flapping degenerates into mostly-Open.
- [`breaker-open-info.md`](breaker-open-info.md) — info-tier when
  a single breaker is Open without flapping.
- `../METRICS.md#rdap_circuit_breaker_transitions_totalorigin-from-to`.

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
