# RDAPify — Alert runbooks

Operator-facing playbooks. One file per alert in
`../prometheus-alerts.yaml`. Each runbook has the same five sections so
oncall can scan-read at 03:00.

| # | Section | What it answers |
|---|---------|-----------------|
| 1 | **What it means** | One sentence — what is broken from the user's point of view |
| 2 | **Likely causes** | Ranked from most → least common, with the metric or label that points at each |
| 3 | **Verify** | Concrete PromQL / shell / log queries to confirm the cause before acting |
| 4 | **Actions** | What to do once a cause is confirmed; ordered by reversibility |
| 5 | **Escalate** | When to wake somebody else up, and who |

Cross-cutting context (severity tiers, paging policy, who-owns-what)
lives in [`../INCIDENT.md`](../INCIDENT.md). If you only have time to
read one document during an incident, read that.

## Index

### Critical (page on-call)

| Alert | Runbook |
|-------|---------|
| `RdapifyHighErrorRate` | [high-error-rate.md](high-error-rate.md) |
| `RdapifyBreakerOpenSurge` | [breaker-open-surge.md](breaker-open-surge.md) |
| `RdapifyInflightSaturation` | [inflight-saturation.md](inflight-saturation.md) |
| `RdapifyErrorBudgetFastBurn` | [error-budget-fast-burn.md](error-budget-fast-burn.md) |
| `RdapifyLatencyBudgetFastBurn` | [latency-budget-fast-burn.md](latency-budget-fast-burn.md) |

### Warning (notify team)

| Alert | Runbook |
|-------|---------|
| `RdapifyErrorBudgetSlowBurn` | [error-budget-slow-burn.md](error-budget-slow-burn.md) |
| `RdapifyLatencyBudgetSlowBurn` | [latency-budget-slow-burn.md](latency-budget-slow-burn.md) |
| `RdapifySemaphoreWaitElevated` | [semaphore-wait.md](semaphore-wait.md) |
| `RdapifyRetrySpike` | [retry-spike.md](retry-spike.md) |
| `RdapifyCacheHitRatioLow` | [cache-hit-low.md](cache-hit-low.md) |
| `RdapifyBreakerFlapping` | [breaker-flapping.md](breaker-flapping.md) |
| `RdapifyP95LatencyAboveSlo` | [p95-slo.md](p95-slo.md) |

### Info (log / digest)

| Alert | Runbook |
|-------|---------|
| `RdapifySlowRequestRising` | [slow-rising.md](slow-rising.md) |
| `RdapifySingleBreakerOpen` | [breaker-open-info.md](breaker-open-info.md) |
| `RdapifyCacheCapacityPressure` | [cache-pressure.md](cache-pressure.md) |
