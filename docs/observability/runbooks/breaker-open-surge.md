# RdapifyBreakerOpenSurge — runbook

> **Severity:** critical · pages on-call.
> **Trigger:** `rate(rdap_circuit_breaker_open_seconds_total[5m]) > 30`
> for 5 m on a single `origin` — i.e. that origin's breaker has been
> Open for more than half of every wall-clock second.
>
> **Co-firing:** typically appears with `RdapifyHighErrorRate` (`class="circuit_open"` dominates) and sometimes `RdapifyBreakerFlapping` — see [`high-error-rate.md`](high-error-rate.md), [`breaker-flapping.md`](breaker-flapping.md).

## 1. What it means

For one specific upstream RDAP server, the breaker has been protecting
the engine almost continuously for the last 5 minutes. Cache hits for
that origin still serve; everything else short-circuits with
`CircuitOpen`. **The breaker is doing its job** — the alert is about
the upstream being effectively down, not about RDAPify being broken.

## 2. Likely causes

| # | Cause | Confirms via |
|---|-------|--------------|
| 1 | Upstream registry outage | registry status page; their public RDAP URL returns 5xx / timeout |
| 2 | Upstream rate-limited us with no `Retry-After` (or one too long to honour) | `rdap_retry_after_seconds` p95 climbed before the breaker opened |
| 3 | Network path to one origin broken (DNS, peering) | reachable from a different region but not ours |
| 4 | Cooldown is too short to ride out their incident — flapping can mimic surge | `RdapifyBreakerFlapping` is also firing |

## 3. Verify

Identify the origin:

```promql
topk(3, rate(rdap_circuit_breaker_open_seconds_total[5m]))
```

Check whether they recover at all (HalfOpen → Closed transitions):

```promql
sum by (origin) (
  increase(rdap_circuit_breaker_transitions_total{from="half_open",to="closed"}[15m])
)
```

Direct probe (replace ORIGIN):

```sh
curl -m 5 -sS -o /dev/null -w "%{http_code} %{time_total}\n" \
  https://<ORIGIN>/domain/example
```

## 4. Actions

- **Single registry outage confirmed** — no engine-side action.
  Communicate to stakeholders ("queries to .xyz domains are failing,
  upstream out") and let the breaker continue. Subscribe to the
  registry's status page.
- **They recovered but the breaker isn't reclosing** — see
  [`breaker-flapping.md`](breaker-flapping.md). Cooldown may be too
  short for their recovery cadence; or HalfOpen probes are landing on
  a still-broken backend.
- **Alert fires for an origin you don't recognise** — confirm the
  bootstrap registry didn't recently change. Check
  `RDAPify-Internal/audits/` if a bootstrap snapshot was rotated.
- **Multiple origins firing this alert simultaneously** — escalate;
  this is a network-side incident, not an upstream-side one.

## 5. Escalate

- One origin > 30 m without any HalfOpen→Closed transitions → notify
  the registry operator (their abuse / status address) and update
  customers.
- Three or more origins firing simultaneously → declare a major
  incident; involve **network on-call**.
- If you suspect the engine's failure threshold is too sensitive
  (false-positive trips) → file a tuning ticket and discuss in the
  next on-call review; do not change `failure_threshold` mid-incident.

## 6. Stop when

- `rate(rdap_circuit_breaker_open_seconds_total[5m]) < 5` for the
  affected `origin` for 10 minutes (well below the 30 s/s alert threshold), **AND**
- `rdap_circuit_breaker_state{origin="<this-origin>"} == 0` (Closed).

A clean `half_open → closed` transition since the trigger is the
strongest signal that the upstream is genuinely back.

## See also

- [`breaker-flapping.md`](breaker-flapping.md) — frequently fires
  alongside this one.
- [`breaker-open-info.md`](breaker-open-info.md) — info-level
  variant for non-sustained openings.
- `../METRICS.md#rdap_circuit_breaker_open_seconds_totalorigin`.

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
