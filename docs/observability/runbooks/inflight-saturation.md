# RdapifyInflightSaturation — runbook

> **Severity:** critical · pages on-call.
> **Trigger:** `rdap_inflight_requests >= 240` for 3 m
> (≥ 95 % of the default 256 cap).
>
> **Co-firing:** typically appears with `RdapifySemaphoreWaitElevated` (capacity-bound) or `RdapifyP95LatencyAboveSlo` (latency-bound). See [`semaphore-wait.md`](semaphore-wait.md), [`p95-slo.md`](p95-slo.md).

## 1. What it means

The global upstream-concurrency semaphore is essentially full. New
requests must wait for a permit, so user-visible p95 latency is
inflated by however long the queue is. Either upstream is slow
(latency-bound) or our cap is too low (capacity-bound).

## 2. Likely causes

| # | Cause | Telltale signal |
|---|-------|-----------------|
| 1 | Upstream registry slow but not failing | high `rdap_latency_seconds` p95, low error rate, low `rdap_semaphore_wait_seconds{kind="global"}` p95 — every slot is busy on a slow upstream |
| 2 | Engine cap too low for current traffic | `rdap_semaphore_wait_seconds{kind="global"}` p95 high (> 100 ms), error rate normal — we're queueing internally |
| 3 | Permit leak (engine bug) | Inflight stays at cap even after traffic drops; this should be a Rust-team page |
| 4 | A burst that will subside on its own | request rate spiked recently; check ingress rate trend |

## 3. Verify

Quick decision split — latency-bound vs. capacity-bound:

```promql
# Latency-bound: upstream is slow.
histogram_quantile(0.95, sum by (le) (rate(rdap_latency_seconds_bucket[5m]))) > 0.3
  unless
histogram_quantile(0.95, sum by (le) (rate(rdap_semaphore_wait_seconds_bucket{kind="global"}[5m]))) > 0.1

# Capacity-bound: we're queueing internally.
histogram_quantile(0.95, sum by (le) (rate(rdap_semaphore_wait_seconds_bucket{kind="global"}[5m]))) > 0.1
```

Permit-leak check: stop traffic at the load balancer, watch for 30 s.
`rdap_inflight_requests` must drop to 0. If it doesn't, it's a leak.

```promql
rdap_inflight_requests
```

## 4. Actions

- **Latency-bound** — same handling as `RdapifyP95LatencyAboveSlo`:
  upstream is the bottleneck. Reducing concurrency won't help; it'll
  hurt. If saturation persists, raising `concurrency_limit` only
  trades inflight pressure for upstream-server stress, which can
  trigger 5xx — discuss with the upstream operator first.
- **Capacity-bound** — raise `concurrency_limit`. Default is 256;
  the documented ceiling is 4096. Bump in steps of 2× and watch
  `rdap_inflight_requests` and `rdap_errors_total{class="rate_limited"}`.
- **Permit-leak suspected** — page the **engine team (Rust core)**
  immediately. Capture a snapshot:

  ```sh
  curl -sS http://<engine>/metrics | grep -E '^rdap_inflight|^rdap_semaphore'
  ```

  Restart the affected pods to recover (the leak is in-process).
- **Burst** — check whether the request rate has already returned to
  baseline. If yes, watch for 5 more minutes and acknowledge.

## 5. Escalate

- Suspected leak → **engine team (Rust core)** immediately; restart
  is not a fix.
- Latency-bound for > 15 m and you have a contractual relationship
  with the slow upstream → notify their operator.
- Capacity-bound and you've already raised the cap to 1024 without
  relief → escalate to architecture: per-origin sub-pools (planned
  v0.7.0) or a horizontal scale-out is needed.

## 6. Stop when

- `rdap_inflight_requests` < 200 for 5 minutes (≥ 22 % headroom under
  the 256-cap default), **AND**
- the alert auto-resolves.

After any restart for suspected permit leak: confirm
`min_over_time(rdap_inflight_requests[5m]) == 0` during a quiet period
before considering the leak fixed.

## See also

- [`semaphore-wait.md`](semaphore-wait.md) — the warning-tier
  precursor to this alert.
- [`p95-slo.md`](p95-slo.md) — frequently co-fires when the cause
  is latency-bound.
- `../METRICS.md#rdap_inflight_requests`.

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
