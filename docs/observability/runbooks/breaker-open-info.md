# RdapifySingleBreakerOpen — runbook

> **Severity:** info · log / digest only.
> **Trigger:** `rdap_circuit_breaker_state == 1` for 5 m on any
> origin (i.e. one breaker has been Open ≥ 5 m).
>
> **Co-firing:** if `RdapifyBreakerOpenSurge` (critical) or `RdapifyBreakerFlapping` (warning) starts firing, those runbooks supersede this one — see [`breaker-open-surge.md`](breaker-open-surge.md), [`breaker-flapping.md`](breaker-flapping.md).

## 1. What it means

One upstream registry's breaker is in the Open state. The engine is
serving cached responses for that origin and failing fast (with
`circuit_open` errors) for everything else. This is **expected
background noise** — registries occasionally have bad days, and the
breaker is what protects the engine from cascading failures.

The alert exists for *context*, so the team has visibility into which
origins are unhealthy when they look at the dashboard.

## 2. Likely causes

| # | Cause | Indicator |
|---|-------|-----------|
| 1 | Upstream registry transient outage | Single origin Open for < 30 m, then HalfOpen → Closed |
| 2 | Upstream maintenance | Predictable, often announced |
| 3 | Network path issue specific to one origin | Multiple regions disagree about reachability |

## 3. Verify

Which origin?

```promql
rdap_circuit_breaker_state == 1
```

How long has it been open?

```promql
rate(rdap_circuit_breaker_open_seconds_total[5m]) > 0
```

## 4. Actions

- If the origin recovers on its own (HalfOpen → Closed within ~30 m):
  log only, no action.
- If you want a heads-up signal, subscribe to the registry's status
  page.
- Surface in the team's daily digest if multiple distinct origins
  cycle through Open over a 24 h window — that suggests our network
  egress is flaky.

## 5. Escalate

- This alert never escalates on its own. If it stays Open and the
  Open-time-per-second exceeds 30, `RdapifyBreakerOpenSurge` fires
  (critical) — follow that runbook.
- If multiple breakers go Open simultaneously,
  `RdapifyHighErrorRate` will likely fire — follow that runbook.

## 6. Stop when

- `rdap_circuit_breaker_state{origin="<this-origin>"} == 0` (Closed) for
  at least 5 minutes, **OR**
- a `half_open → closed` transition has been observed for this origin.

This alert auto-resolves cleanly under those conditions; no operator
action is required to dismiss it.

## See also

- [`breaker-open-surge.md`](breaker-open-surge.md) — the
  critical-tier escalation when Open is sustained.
- [`breaker-flapping.md`](breaker-flapping.md) — the warning-tier
  alert when the breaker can't stay closed.

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
