# RdapifyErrorBudgetFastBurn — runbook

> **Severity:** critical · pages on-call.
> **Trigger:** error budget burning at **≥ 14.4×** the steady rate over
> both the **5 m** and **1 h** windows (Google SRE multi-window
> multi-burn-rate, MWMBR).
>
> **Co-firing:** always paired with `RdapifyHighErrorRate` for severe events — see [`high-error-rate.md`](high-error-rate.md). Work them as one alert.

## 1. What it means

We're burning the 30-day error budget at a rate that, if sustained,
exhausts it in about **2 hours**. Multi-window means the burn is real
in both a short window (5 m) and a longer one (1 h), so this is not a
spike of a single bad minute — it's a sustained event happening right
now.

> **Why this alert exists alongside `RdapifyHighErrorRate`.**
> `RdapifyHighErrorRate` triggers on **instantaneous** error rate
> (>5 % for 5 m). `RdapifyErrorBudgetFastBurn` triggers on **budget
> burn** — the same condition expressed against the SLO instead of an
> absolute threshold. They fire together for severe events; the
> burn-rate formulation is what gives you the language ("we will
> exhaust the budget in N hours") to talk to stakeholders. Treat them
> as a single alert for response purposes.

## 2. Likely causes

Same as [`high-error-rate.md`](high-error-rate.md). Read that
runbook's "Likely causes" and "Verify" sections — the cause taxonomy
is identical. The burn-rate framing only changes the urgency
language, not the diagnosis.

## 3. Verify

Confirm both windows are firing (single-window false-positives are
exactly what MWMBR is designed to suppress):

```promql
# Fast window (5 m) — multiplied by 14.4 against 1 % SLO target.
(
  sum(rate(rdap_errors_total[5m]))
  / clamp_min(sum(rate(rdap_requests_total[5m])), 1)
) > (14.4 * 0.01)

# Slow window (1 h) — same threshold.
(
  sum(rate(rdap_errors_total[1h]))
  / clamp_min(sum(rate(rdap_requests_total[1h])), 1)
) > (14.4 * 0.01)
```

If only the 5-m window is firing, the burn isn't sustained — wait it
out. The alert's `for: 2m` clause should already filter most of these.

## 4. Actions

Follow [`high-error-rate.md`](high-error-rate.md) §4. Add to the
incident message: "we will exhaust the 30-day error budget in
~2 hours at this rate" — that framing accelerates approval for
mitigations like raising concurrency caps or shedding load.

## 5. Escalate

- Burn rate stays at ≥ 14.4× for > 30 m → declare a **major
  incident** (see [`../INCIDENT.md`](../INCIDENT.md)).
- Budget already projected to exhaust within the day → freeze any
  non-rollback deploys until the burn rate drops below 1×.

## 6. Stop when

- The 5-minute and 1-hour error rates are **both** below the
  `14.4 × 0.01 = 14.4 %` MWMBR threshold for at least 30 minutes, **AND**
- the paired `RdapifyHighErrorRate` (if firing) has resolved.

Additionally: confirm the burn rate over the last 1 hour is < 1× (i.e.,
the 30-day budget is no longer being eroded faster than it accrues).

## See also

- [`error-budget-slow-burn.md`](error-budget-slow-burn.md) — the
  warning-tier counterpart for slower, longer burns.
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
