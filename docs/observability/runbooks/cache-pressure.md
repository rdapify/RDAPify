# RdapifyCacheCapacityPressure — runbook

> **Severity:** info · log / digest only.
> **Trigger:** `rdap_cache_entries_current >= 950` and
> `rate(rdap_cache_evictions_total[5m]) > 0.1` for 30 m
> (≈ 95 % of the default 1 000-entry cap, with active eviction).
>
> **Co-firing:** the precursor to `RdapifyCacheHitRatioLow` if working-set continues to grow beyond the cap. See [`cache-hit-low.md`](cache-hit-low.md).

## 1. What it means

The cache is full and is actively evicting entries to make room for
new ones. Working set ≥ configured cap. Not a problem on its own —
the LRU policy is doing what it's designed to do — but it's a leading
indicator: if the workload's working set grows past the cap, hit
ratio drops and `RdapifyCacheHitRatioLow` follows.

## 2. Likely causes

| # | Cause | Confirmation |
|---|-------|--------------|
| 1 | Working set genuinely larger than the cap | hit ratio still healthy (> 70 %) but evictions non-zero |
| 2 | Workload churning through unique keys (e.g. a scanner) | high request rate with low hit ratio |
| 3 | TTL too short — entries expire and re-enter rapidly | high eviction rate with stable entry count |

## 3. Verify

Hit ratio still healthy?

```promql
sum(rate(rdap_cache_hits_total[5m]))
/ clamp_min(sum(rate(rdap_cache_hits_total[5m])) + sum(rate(rdap_cache_misses_total[5m])), 1)
```

Eviction rate trend:

```promql
rate(rdap_cache_evictions_total[5m])
```

## 4. Actions

- Hit ratio still > 70 % → this is informational. Note it in the
  digest; consider raising `cache.max_entries` proactively if memory
  budget allows.
- Hit ratio < 50 % → see [`cache-hit-low.md`](cache-hit-low.md).
- If a scanner-pattern caller is identified → ask them to batch /
  cache responses on their side before this becomes a problem.

## 5. Escalate

- Does not escalate on its own. The natural successor alert is
  `RdapifyCacheHitRatioLow` — follow that one if it fires.

## 6. Stop when

- `rdap_cache_entries_current < 900` (90 % of the 1 000-default cap) for
  10 minutes, **OR**
- `rate(rdap_cache_evictions_total[5m]) < 0.05` for 30 minutes (working
  set has stabilised below cap).

If `cache.max_entries` was raised, neither condition will trigger
naturally — confirm hit ratio stayed > 70 % at the new cap and dismiss
manually.

## See also

- [`cache-hit-low.md`](cache-hit-low.md) — the warning-tier
  successor when hit ratio actually drops.
- `../METRICS.md#rdap_cache_evictions_total`.

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
