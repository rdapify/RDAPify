# RdapifyRetrySpike — runbook

> **Severity:** warning · notify team.
> **Trigger:** retry rate is 3× the trailing-1h baseline for 10 m.
>
> **Co-firing:** retry spikes are leading indicators for `RdapifyHighErrorRate` and (if `class="rate_limited"` dominates) `RdapifyBreakerOpenSurge`. See [`high-error-rate.md`](high-error-rate.md), [`breaker-open-surge.md`](breaker-open-surge.md).

## 1. What it means

The engine is retrying requests three times more often than it has been
recently. Retries are normal; a sustained spike says an upstream
behaved differently in the last 10 minutes than in the previous hour.
Because retries are bounded by `max_attempts`, this rarely directly
causes user-visible failures — but it almost always precedes them.

## 2. Likely causes

| # | Cause | Dominant `class` |
|---|-------|------------------|
| 1 | One upstream registry having a bad minute (5xx blip) | `http_5xx` |
| 2 | Upstream has started rate-limiting | `rate_limited` |
| 3 | Network blip, packet loss | `network` / `timeout` |
| 4 | Engine read timeout too tight for current upstream latency | `timeout` |

## 3. Verify

Find the dominant class:

```promql
topk(3, sum by (class) (rate(rdap_retry_total[5m])))
```

Compare retry amplification to its baseline (numbers above 0.5 mean
"more than one retry per two requests"):

```promql
sum(rate(rdap_retry_total[5m]))
/ clamp_min(sum(rate(rdap_requests_total[5m])), 1)
```

Check whether actual retry delay is being inflated by upstream
`Retry-After`:

```promql
histogram_quantile(0.95, sum by (le) (rate(rdap_retry_delay_seconds_bucket[5m])))
histogram_quantile(0.95, sum by (le) (rate(rdap_retry_after_seconds_bucket[5m])))
```

## 4. Actions

- **`http_5xx` dominant** — upstream is briefly degraded. Watch for
  promotion to `RdapifyHighErrorRate`; usually self-resolves.
- **`rate_limited` dominant** — we're being throttled. Reduce
  upstream pressure (drop `concurrency_limit`, ask top callers to
  batch). Persistent rate limiting usually leads to
  `RdapifyBreakerOpenSurge`.
- **`network` / `timeout` dominant** — same handling as
  `RdapifyHighErrorRate` `network` arm: investigate egress.
- **`http_4xx` dominant** — should be rare; retries on 4xx are only
  for specific transient codes. If high, file a tuning ticket — we
  may be retrying something we shouldn't.

## 5. Escalate

- Retry rate stays above the 3× threshold for > 30 m → escalate to
  on-call and verify whether `RdapifyHighErrorRate` is about to fire.
- Retry amplification > 1.0 (more retries than original requests) →
  upstream is in a retry-storm pattern; involve the **engine team
  (Rust core)** to consider widening backoff.

## 6. Stop when

- `sum(rate(rdap_retry_total[5m]))` is back within 1× the trailing
  1-hour baseline for 10 minutes, **AND**
- `sum(rate(rdap_retry_total[5m])) / clamp_min(sum(rate(rdap_requests_total[5m])), 1) < 0.30`
  (retry amplification healthy).

If the dominant class was `rate_limited` and `concurrency_limit` was
dropped, leave the new value in place for at least one full hour
before considering raising it again.

## See also

- [`high-error-rate.md`](high-error-rate.md) — retry spikes often
  precede error-rate spikes.
- `../METRICS.md#rdap_retry_totalclass`.

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
