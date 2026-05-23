# RDAPify — Incident Response Guide

> Read this first when a critical alert fires. The runbooks tell you
> what to *do* about a specific alert; this document tells you how to
> *handle the incident* around it.

This guide is deliberately short. If you need more detail, the
authoritative sources are:

- [`runbooks/`](runbooks/) — one file per alert.
- [`METRICS.md`](METRICS.md) — what each metric means.
- [`../SLO.md`](../SLO.md) — the SLO targets and budgets.
- [`grafana-dashboard.json`](grafana-dashboard.json) — the dashboard
  to watch during an incident.

---

## 1. Severity tiers

| Tier | Response | Pages on-call? | Examples |
|------|----------|----------------|----------|
| **Critical** | < 5 min — drop everything | Yes | High error rate, breaker surge, inflight saturation, fast SLO burn |
| **Warning** | < 1 h — investigate during business hours; Slack the team | No | Slow SLO burn, semaphore wait elevated, retry spike, cache hit low, breaker flapping, p95 above SLO |
| **Info** | Daily digest — review next morning | No | Slow request rising, single breaker open, cache near capacity |

The dashboard's top **Engine health** panel (added v0.6.4) summarises
this as a single OK / DEGRADED / FAILING traffic light:

- **OK** — all SLIs within target.
- **DEGRADED** ↔ at least one warning condition is true (error rate
  > 1 % or p95 > 300 ms).
- **FAILING** ↔ at least one critical condition is true (error rate
  > 5 %, p95 > 1 s, or inflight ≥ 240).

If the panel is FAILING, you are in an incident.

---

## 2. The first 5 minutes

When a critical alert fires:

1. **Acknowledge** the page so others know it's being handled.
2. **Open the dashboard** ([grafana-dashboard.json](grafana-dashboard.json))
   and look at the Engine health panel — is it FAILING?
3. **Open the runbook** linked from the alert annotation
   (`runbook_url`). Every alert ships with one.
4. **Check the dominant signal** by class / origin / type — the
   runbook's "Verify" section is built to do this in one or two
   PromQL queries.
5. **Decide** whether to mitigate now or escalate. The runbook's
   "Actions" section is ordered by reversibility — earlier actions
   are safer.

> **Don't fix and forget.** Even if the incident self-resolves in
> the first 5 minutes, write down what you saw — the next on-call
> won't have your context.

---

## 3. Communication

For any **critical** alert:

- Post in `#incidents` (or your team channel) within 5 minutes:
  > "rdapify <alert-name> firing — looking now. Affected: <users / queries>. Cause: investigating."
- Update every 15 minutes, even if it's "still investigating".
- Resolve message names a root cause, not just "fixed".

For any **warning** alert that doesn't auto-resolve in 30 minutes,
post the same template in the team channel during business hours.

---

## 4. Common incident shapes

### 4.1 "Error rate spiked"

Most likely runbooks (in order of frequency):

1. [`runbooks/high-error-rate.md`](runbooks/high-error-rate.md) — the
   primary runbook.
2. [`runbooks/breaker-open-surge.md`](runbooks/breaker-open-surge.md)
   — common partner alert when an upstream is down.
3. [`runbooks/error-budget-fast-burn.md`](runbooks/error-budget-fast-burn.md)
   — fires alongside, gives you SLO-budget framing.

The diagnostic split lives in `high-error-rate.md` §3 — start with
`topk(3, sum by (class) (rate(rdap_errors_total[5m])))`.

### 4.2 "Latency spiked"

Most likely runbooks:

1. [`runbooks/p95-slo.md`](runbooks/p95-slo.md) — instantaneous form.
2. [`runbooks/inflight-saturation.md`](runbooks/inflight-saturation.md)
   — if it's queue-bound rather than upstream-slow.
3. [`runbooks/latency-budget-fast-burn.md`](runbooks/latency-budget-fast-burn.md)
   — SLO-budget framing.

The split is "is wait time the cause?" — see `p95-slo.md` §3.

### 4.3 "An upstream is down"

Most likely runbooks:

1. [`runbooks/breaker-open-surge.md`](runbooks/breaker-open-surge.md)
   — the headline alert.
2. [`runbooks/breaker-flapping.md`](runbooks/breaker-flapping.md) —
   if recovery is unstable.
3. [`runbooks/breaker-open-info.md`](runbooks/breaker-open-info.md)
   — single Open without the surge.

The breaker is *protecting* the engine in this case; the action is
usually to communicate, not to mitigate engine-side.

### 4.4 "Queue depth growing"

Most likely runbooks:

1. [`runbooks/inflight-saturation.md`](runbooks/inflight-saturation.md)
   — if global cap is the bottleneck.
2. [`runbooks/semaphore-wait.md`](runbooks/semaphore-wait.md) — the
   warning-tier precursor.

The split is "latency-bound vs. capacity-bound" — see `inflight-saturation.md` §3.

### 4.5 "SLO budget burning"

The burn-rate alerts are intentionally redundant with the absolute
threshold alerts. They give you **language** ("we will burn the
budget in N hours") for stakeholder communication, not new diagnostic
information.

- `RdapifyErrorBudgetFastBurn` → use the diagnostic in
  [`high-error-rate.md`](runbooks/high-error-rate.md).
- `RdapifyLatencyBudgetFastBurn` → use the diagnostic in
  [`p95-slo.md`](runbooks/p95-slo.md).

Slow-burn variants are warning tier and indicate chronic, not acute,
problems — investigate during business hours.

---

## 5. When to declare a major incident

Declare formally and notify customer-facing teams when **any** is true:

- Multiple critical alerts firing simultaneously for > 15 minutes.
- Burn rate stays at 14.4× for > 30 minutes.
- Error rate > 10 % across all query types simultaneously.
- The Engine health panel has been FAILING for > 30 minutes.
- A registry / network root cause cannot be confirmed within
  15 minutes.

A major incident triggers:

- A dedicated incident channel.
- An incident commander (typically the on-call who acked the page).
- Stakeholder updates every 15 minutes.
- A postmortem within 5 business days.

---

## 6. Mitigation actions ranked by reversibility

Use this table when deciding what to try. **Earlier = safer.**

| # | Action | Reversibility | When |
|---|--------|---------------|------|
| 1 | Open the runbook, run the diagnostic queries | trivial | Always first |
| 2 | Communicate to stakeholders | trivial | Always early |
| 3 | Subscribe to upstream registry status pages | trivial | When breaker alerts fire |
| 4 | Restart RDAPify pods | low (one-time disruption) | Suspected permit / state leak (see [`inflight-saturation.md`](runbooks/inflight-saturation.md) §4) |
| 5 | Raise `concurrency_limit` | medium (config change, persists) | Capacity-bound saturation; see [`semaphore-wait.md`](runbooks/semaphore-wait.md) |
| 6 | Lower `concurrency_limit` | medium (slows throughput intentionally) | Upstream rate-limiting us |
| 7 | Raise `cache.max_entries` | medium (more memory) | Cache pressure with low hit ratio |
| 8 | Roll back the most recent deploy | medium (last-known-good) | `internal` errors after a deploy |
| 9 | Reduce the failure threshold or extend cooldown | high (changes breaker semantics) | Only after consultation; never mid-incident |
| 10 | Bypass the breaker for an origin | very high | Never. The breaker is the engine's safety belt. |

---

## 7. Postmortem checklist

Within 5 business days of a major incident:

- [ ] Timeline: alert fire, ack, mitigation, resolution (UTC).
- [ ] What was the user-visible impact? (queries failed,
      stakeholders affected.)
- [ ] What was the root cause? (one sentence.)
- [ ] What was the contributing factor on our side, if any?
      (capacity, config, code, monitoring gap.)
- [ ] What action items prevent recurrence? Each must have an owner
      and a date.
- [ ] What did monitoring miss? File a ticket if a new alert or
      metric would have helped.
- [ ] Did the runbook help? If not, fix it before next on-call
      rotation.

The runbook update is the most important deliverable — every
incident is an opportunity to make the next one shorter.

---

## 8. Reference index

- [`runbooks/`](runbooks/) — 15 runbooks, one per alert.
- [`METRICS.md`](METRICS.md) — full Prometheus surface.
- [`prometheus-alerts.yaml`](prometheus-alerts.yaml) — the rules
  themselves.
- [`grafana-dashboard.json`](grafana-dashboard.json) — the
  operator dashboard.
- [`../SLO.md`](../SLO.md) — formal SLO definition.
- [`../KNOWN_LIMITS.md`](../KNOWN_LIMITS.md) — bounded properties
  and trade-offs that affect what can / cannot be alerted on.

---

_Last updated: 2026-04-29 (v0.6.4)._
