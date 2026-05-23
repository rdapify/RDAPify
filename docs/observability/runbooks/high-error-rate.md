# RdapifyHighErrorRate — runbook

> **Severity:** critical · pages on-call.
> **Trigger:** 5-minute error rate > 5 % sustained for 5 m.
>
> **Co-firing:** if also paired with `RdapifyBreakerOpenSurge` or `RdapifyErrorBudgetFastBurn`, work the partner runbook in parallel — see [`breaker-open-surge.md`](breaker-open-surge.md), [`error-budget-fast-burn.md`](error-budget-fast-burn.md).

## 1. What it means

Five-times the SLO ceiling (1 %) of all queries are returning errors to
callers right now. Users are seeing failed lookups. The engine itself
may be healthy — the dominant `class` label tells you whether the cause
is upstream, the engine, or the network.

## 2. Likely causes

Ranked from most to least common in production:

| # | Cause | Dominant `class` | Look at |
|---|-------|------------------|---------|
| 1 | One major upstream registry is down | `circuit_open` | `RdapifyBreakerOpenSurge`, breaker state panel |
| 2 | Upstream is rate-limiting us | `rate_limited` | retry-by-class panel, `rdap_retry_after_seconds` |
| 3 | Network egress is degraded | `network` / `timeout` | infra side: NAT gateway, DNS, peering |
| 4 | Engine misconfiguration (bad bootstrap, expired CA) | `internal` / `invalid_response` | engine logs at `event=rdap_*`, recent deploys |
| 5 | Workload pattern shift (queries to dead TLDs) | `circuit_open` over many origins | top-N origins by trip count |

## 3. Verify

Confirm the dominant class:

```promql
topk(3, sum by (class) (rate(rdap_errors_total[5m])))
```

Confirm whether one origin or many are responsible:

```promql
count(rdap_circuit_breaker_state == 1)
topk(5, increase(rdap_circuit_breaker_open_total[15m]))
```

Confirm the engine itself is alive (cache hits should still flow even
if upstream is dead):

```promql
sum(rate(rdap_cache_hits_total[5m]))
```

## 4. Actions

- **`circuit_open` dominant, single origin** — confirm with that
  registry's status page; the breaker is already protecting the engine.
  No action on RDAPify side.
- **`circuit_open` dominant, many origins** — likely network egress.
  Check infra (NAT, DNS, peering). Page network on-call if needed.
- **`rate_limited` dominant** — lower request rate from this engine
  (drop `concurrency_limit` or add caller back-pressure). Check
  whether one client is producing the storm — reduce its share.
- **`internal` / `invalid_response` dominant** — recent deploy?
  Roll back via your deploy tooling. If no recent deploy, search logs
  for `event=rdap_*` panics.
- **`network` / `timeout` dominant** — same as #1, plus consider
  raising upstream timeout if latency, not loss, is the issue.

## 5. Escalate

- Sustained > 15 m **and** dominant class is `internal` →
  **engine team** (Rust core).
- Sustained > 15 m **and** dominant class is `network` / `timeout`
  with no breaker activity → **network on-call**.
- All registries simultaneously failing across multiple regions →
  declare a major incident (see [`../INCIDENT.md`](../INCIDENT.md)).

## 6. Stop when

- 5-minute error rate < 1 % (the SLO ceiling) for 10 minutes, **AND**
- the alert auto-resolves in Alertmanager.

If the dominant `class` was `circuit_open`, additionally confirm that
`count(rdap_circuit_breaker_state == 1)` has returned to its pre-incident
value before declaring the system back to baseline.

## See also

- [`error-budget-fast-burn.md`](error-budget-fast-burn.md) — same
  symptom from the budget-burn angle; both can fire together.
- [`breaker-open-surge.md`](breaker-open-surge.md) — common
  co-firing alert.
- `../METRICS.md#rdap_errors_totalclass` — class definitions.

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
