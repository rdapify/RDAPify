# RdapifyErrorBudgetSlowBurn — runbook

> **Severity:** warning · notify team.
> **Trigger:** error budget burning at **≥ 6×** the steady rate over
> both the **30 m** and **6 h** windows (Google SRE MWMBR — slow tier).
>
> **Co-firing:** the chronic counterpart to `RdapifyErrorBudgetFastBurn`; if the latter starts firing, escalate the slow-burn diagnostic per [`error-budget-fast-burn.md`](error-budget-fast-burn.md).

## 1. What it means

The error budget is burning fast enough to exhaust it in roughly
**5 days** if the trend continues. Not paging-grade: the engine is
not down, and a few days of headroom is enough time to investigate
during business hours. But the burn is real (sustained across two
windows), and the budget is being eaten.

## 2. Likely causes

This rate of burn is what you see for *chronic* problems rather than
acute outages. Common patterns:

| # | Pattern | Typical cause |
|---|---------|---------------|
| 1 | One small registry consistently 5xx-ing 5–10 % of the time | upstream is half-broken; not enough to trip the breaker but enough to count against the budget |
| 2 | Persistent rate-limiting from one upstream | their cap has been lowered; we haven't adjusted ours |
| 3 | Engine-side bug producing rare `internal` errors | look for an `internal` class climb after a recent deploy |
| 4 | A new caller producing queries to dead TLDs | systemic `circuit_open` errors for a specific class of names |

## 3. Verify

Confirm both windows are firing:

```promql
(
  sum(rate(rdap_errors_total[30m]))
  / clamp_min(sum(rate(rdap_requests_total[30m])), 1)
) > (6 * 0.01)

(
  sum(rate(rdap_errors_total[6h]))
  / clamp_min(sum(rate(rdap_requests_total[6h])), 1)
) > (6 * 0.01)
```

Decompose by class over 6 h to see what's chronic:

```promql
sum by (class) (increase(rdap_errors_total[6h]))
```

## 4. Actions

- **Chronic upstream issue** — bring it up with the registry operator
  (low priority; ticket, not a page).
- **Internal errors after a deploy** — investigate during business
  hours. Roll back if the rate is climbing.
- **New caller producing failures** — coordinate with that caller's
  team to filter dead inputs before they reach RDAPify.
- **Rate-limiting** — coordinate `concurrency_limit` reduction with
  the registry operator.

## 5. Escalate

- Burn rate stays at ≥ 6× for > 24 h → escalate to a tech-debt
  ticket; this is not a one-off.
- Burn rate accelerates to fast-burn threshold (14.4×) →
  `RdapifyErrorBudgetFastBurn` will fire; switch to that runbook.

## 6. Stop when

- The 30-minute and 6-hour error rates are **both** below the
  `6 × 0.01 = 6 %` MWMBR threshold for at least 1 hour, **AND**
- the dominant chronic-cause class (per §3) has been mitigated or its
  contribution reduced.

This alert often resolves slowly — give it a full hour of clean signal
before promoting to "fixed".

## See also

- [`error-budget-fast-burn.md`](error-budget-fast-burn.md) — the
  acute counterpart.
- [`high-error-rate.md`](high-error-rate.md) — useful for the
  cause taxonomy.
- `../SLO.md` §3 — formal error budget definition.

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
