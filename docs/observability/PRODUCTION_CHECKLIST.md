# RDAPify — Production Readiness Checklist

> Before you put RDAPify on the path of real user traffic, walk this
> list. It bundles the v0.6.x deliverables (metrics, alerts, runbooks,
> SLO, calibration) into a single sequenced ramp-up.
>
> Print it, fork it into your team's wiki, and check the boxes.
> "Done" is not "deployed" — it's "deployed *and* honestly observed
> *and* calibrated."

---

## Phase 0 — Pre-deploy

Everything here is done **before** any production traffic hits the
engine.

### 0.1 Engine configuration

- [ ] `concurrency_limit` set explicitly (default 256). Your value:
      ___
- [ ] `per_host_concurrency_limit` set or explicitly opted out
      (default 16, opt out with `None` for single-origin workloads).
      Your value: ___
- [ ] `cache.max_entries` set to fit the projected working set
      (default 1 000). Your value: ___
- [ ] `cache.fresh_ttl` and `stale_ttl` set for your workload's
      churn rate.
- [ ] `slow_request_threshold` (default 500 ms) ≥ your p95 SLO
      target. If you tightened the p95 target below 500 ms, drop
      this proportionally.
- [ ] `metrics` feature is **enabled** in the cargo build.
- [ ] `install_recorder()` is called once at process start and
      `/metrics` is mounted on whichever HTTP framework you use.
      Verified by `curl <engine>/metrics` returning Prometheus
      text.

### 0.2 Observability wiring

- [ ] Prometheus is scraping the engine's `/metrics` endpoint.
- [ ] Scrape interval is 15 s or 30 s; alert `interval:` and `for:`
      values were authored against this assumption.
- [ ] [`grafana-dashboard.json`](grafana-dashboard.json) imported.
      `DS_PROMETHEUS` variable bound to your datasource.
- [ ] [`prometheus-alerts.yaml`](prometheus-alerts.yaml) loaded into
      Prometheus rules.
- [ ] `${TEAM}` placeholders replaced with your paging team
      identifier.
- [ ] Runbook URLs resolve — open one of the
      `runbook_url` links from a fired (or test-fired) alert and
      confirm the markdown loads.
- [ ] Alertmanager routes the three severity tiers correctly
      (critical → page, warning → Slack/email, info → digest only).

### 0.3 SLO sign-off

- [ ] Stakeholders have agreed to the targets in
      [`../SLO.md`](../SLO.md) §1–§3 (availability, latency,
      error budget).
- [ ] The targets are documented in your team's SLA / customer
      contract where applicable, *not* only in this repo.
- [ ] Postmortem owner identified (the role, not just one person).

### 0.4 Engine-team sign-off

- [ ] `cargo test --workspace --release` clean on the deployed
      commit.
- [ ] `cargo clippy --workspace -- -D warnings` clean.
- [ ] [`../KNOWN_LIMITS.md`](../KNOWN_LIMITS.md) read and
      acknowledged. Bounded properties (e.g. no built-in distributed
      tracing) accepted or worked around.
- [ ] If you've tuned any of "do not touch" thresholds in
      [`CALIBRATION.md`](CALIBRATION.md) §6, those changes have an
      accompanying rationale in `RDAPify-Internal/DECISIONS.md`.

---

## Phase 1 — Soft launch (week 1)

Production traffic is flowing, but paging is **suppressed**.

- [ ] Alertmanager has all rdapify alerts in a 7-day silence,
      *except* delivery to Slack / email.
- [ ] Daily dashboard review: is the Engine health stat panel
      stable on **OK**?
- [ ] Daily noise-tracking spreadsheet started (per
      [`CALIBRATION.md`](CALIBRATION.md) §4.3). Even if no alerts
      fire, log the zero.
- [ ] Capture **week 1 baseline** using the queries in
      [`CALIBRATION.md`](CALIBRATION.md) §2.1: per-metric p50 / p95
      / p99 over 14-day windows projected from week 1.
- [ ] Identify any alert that fires more than **3 times** in
      week 1 — file a tuning ticket before Phase 2.

**Exit criteria:** baseline captured, no surprises in the dashboard,
no alert is already known to be too noisy for production.

---

## Phase 2 — Warning paging on (week 2)

Warning-tier alerts deliver to Slack / email. Critical-tier still
silenced.

- [ ] Confirm Slack / email routes work (test-fire one alert).
- [ ] Track precision per warning alert through the week (per
      [`CALIBRATION.md`](CALIBRATION.md) §4.2). Target ≥ 0.50.
- [ ] Any warning alert under 0.50 precision: tune (raise threshold
      or extend `for:`) before Phase 3.
- [ ] Mid-week dashboard check-in: any DEGRADED minutes? What
      caused them? Annotate the dashboard.
- [ ] Validate that the runbooks linked from each warning alert
      are still useful — open them, walk the diagnostic queries,
      confirm they return sensible numbers in your environment.

**Exit criteria:** all warning alerts at ≥ 0.50 precision, runbooks
match observed behaviour, no warning alert is being routinely
ignored.

---

## Phase 3 — Critical paging on (week 3)

Critical-tier alerts page on-call. Full alert set live.

- [ ] On-call rota assigned and notified.
- [ ] Confirm paging route works (test-fire one critical alert
      via Alertmanager).
- [ ] [`INCIDENT.md`](INCIDENT.md) read by everyone in the rota.
- [ ] First-on-call person knows where the dashboard, runbooks,
      and incident guide live (pinned in team channel).
- [ ] If a critical alert fires this week, log:
  - Time to ack (target: < 5 minutes).
  - Time to resolve.
  - Whether the runbook helped (Feedback log section).
- [ ] Track precision for critical alerts. Target ≥ 0.80. Any below
      target gets paged-down to warning until tuned.

**Exit criteria:** at least one drill (real fire or test-fire) has
been responded to using the runbook + incident guide, and the
response went well.

---

## Phase 4 — Steady state (week 4 onward)

Production operation is normal. Calibration becomes recurring.

- [ ] **Monthly** noise-tracking review (30 minutes). Per-tier
      precision computed; worst-precision alert flagged for tuning.
- [ ] **Monthly** missing-alert audit. List incidents handled in
      the last 30 days; for each, confirm an alert fired. If not,
      file a monitoring-gap ticket.
- [ ] **Quarterly** SLO re-baseline against [`../SLO.md`](../SLO.md)
      §7.5. Update targets with stakeholder sign-off if the workload
      has shifted.
- [ ] **Quarterly** runbook review. For each runbook, confirm:
  - Feedback log has at least one entry per fire in the period.
  - The "Verify" queries still work.
  - The "Actions" still match the engine's current behaviour.
- [ ] **After every major incident**: postmortem within 5 business
      days; the runbook used must be updated (per the runbook
      Feedback section's "After every incident" subsection).

---

## Phase 5 — Capacity / growth events

Run this list **before** any of the following, in addition to your
normal change-management process:

- A new caller is onboarded.
- Query rate is projected to grow > 2×.
- A new query type starts seeing significant volume.
- A new upstream registry is added.

- [ ] Re-run [`CALIBRATION.md`](CALIBRATION.md) §2.1 baseline
      capture for the four most relevant metrics (latency, error
      rate, semaphore wait, cache hit ratio).
- [ ] Project whether `concurrency_limit` and `cache.max_entries`
      headroom holds at the new volume; raise pre-emptively if not.
- [ ] If a new upstream is added, note it in the team channel —
      breaker alerts will fire on it before you trust its behaviour;
      that is the design.
- [ ] Update the noise-tracking spreadsheet baseline; previous
      precision targets may not hold if the workload shape has
      changed.

---

## What "production-ready" actually means

You can deploy RDAPify with `metrics` off and get reasonable
behaviour. That is **not** what this checklist covers. Production-
ready means:

- The engine is observable (metrics scraped, dashboard imported).
- Failure modes are alertable (rules loaded, paging routed).
- Failures are actionable (runbooks linked, incident guide read).
- The alert set is honest (precision tracked, calibration ongoing).
- The SLO is signed (stakeholders agree, validation cadence set).

Skip any of those and you're running with a safety belt that's
unbuckled. The engine doesn't break — your response to its breaking
does.

---

## Reference index

- [`README.md`](README.md) — observability artefacts overview.
- [`METRICS.md`](METRICS.md) — every metric the engine emits.
- [`prometheus-alerts.yaml`](prometheus-alerts.yaml) — the alert rules.
- [`grafana-dashboard.json`](grafana-dashboard.json) — the dashboard.
- [`runbooks/`](runbooks/) — one runbook per alert.
- [`INCIDENT.md`](INCIDENT.md) — incident response process.
- [`CALIBRATION.md`](CALIBRATION.md) — threshold tuning and noise
  tracking.
- [`../SLO.md`](../SLO.md) — formal SLO and validation cadence.
- [`../KNOWN_LIMITS.md`](../KNOWN_LIMITS.md) — bounded properties.
- [`../PERFORMANCE.md`](../PERFORMANCE.md) — performance expectations.

---

_Last updated: 2026-04-30 (v0.6.5)._
