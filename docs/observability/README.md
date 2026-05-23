# RDAPify — Observability artefacts

Operator-facing files. **If you are paged right now**, jump to
[`INCIDENT.md`](INCIDENT.md).

| File | Purpose |
|---|---|
| [`INCIDENT.md`](INCIDENT.md) | **Read first during an incident.** Severity tiers, the first 5 minutes, communication template, mitigation reversibility table. |
| [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md) | **Read first before deploying.** Phased ramp-up checklist (pre-deploy → soft launch → warning paging → critical paging → steady state). |
| [`../../ops/`](../../ops/) | **Field-ops directory** for the observation period feeding TUNING_REPORT. Contains the chronological [`incidents.md`](../../ops/incidents.md) log and a window-discipline README. |
| [`OBSERVATION_WINDOW.md`](OBSERVATION_WINDOW.md) | **Operator runbook** for running a real observation window: pre-flight, start procedure, daily routine, freeze rules, end-of-window pipeline, and the two valid exit conditions (calibration-confirmed or tuning-warranted). Real data only — no simulation. |
| [`../../ops/attestations/TEMPLATE.md`](../../ops/attestations/TEMPLATE.md) | Per-window attestation template — copy at window start, fill at window end, signs that the window used real production data. |
| [`../../tools/preflight_check.sh`](../../tools/preflight_check.sh) | Pre-flight readiness check — verifies promtool, alert rules, Prometheus reachability, and `extract_tuning_data.sh --dry-run` against a live `PROM_URL`. Run this before declaring a window. |
| [`CALIBRATION.md`](CALIBRATION.md) | How to tune alert thresholds without making them blind, how to interpret metric trends, alert/incident ratio (precision), and §7 "When NOT to tune" guardrails (added v0.6.6). |
| [`TUNING_REPORT.md`](TUNING_REPORT.md) | **Fill-in template** for evidence-based tuning. §A–§F record window scope, alert precision/recall, metric baselines, runbook effectiveness, threshold-change ledger, and sign-off. Added v0.6.6. |
| [`TUNING_WORKFLOW.md`](TUNING_WORKFLOW.md) | **End-to-end checklist** from "observation window ended" to "v0.6.x PR ready". Glues QUERIES / EXPORT_GUIDE / ALERT_CLASSIFICATION / TUNING_REPORT / CALIBRATION together. Added v0.6.8. |
| [`QUERIES.md`](QUERIES.md) | Copy-paste PromQL for every TUNING_REPORT section, grouped §A / §B / §C.1–§C.6 / cross-cutting. Each query has interpretation notes. Added v0.6.8. |
| [`EXPORT_GUIDE.md`](EXPORT_GUIDE.md) | Three ways to extract data from Prometheus into TUNING_REPORT cells (UI, `curl /api/v1/query`, Grafana CSV). Added v0.6.8. |
| [`ALERT_CLASSIFICATION.md`](ALERT_CLASSIFICATION.md) | Decision tree for TP / FP / missed-incident classification, with worked examples and edge-case rules. Drives §B precision/recall calculation. Added v0.6.8. |
| [`CLASSIFICATION_REVIEW.md`](CLASSIFICATION_REVIEW.md) | How to validate the candidate JSON from `classify_alerts.sh` before any value lands in TUNING_REPORT §B. Decision tree, do/don't summary, illustrative review examples. Added v0.6.9. |
| [`DATA_MODEL.md`](DATA_MODEL.md) | Formal schema for `classification_candidates.json` — field reference, constraints, JSON Schema draft 2020-12, sample valid documents. Added v0.6.9. |
| [`PANEL_INVENTORY.md`](PANEL_INVENTORY.md) | Every Grafana panel listed with the question it answers and a high-signal / diagnostic-only / candidate-for-removal classification. Added v0.6.6. |
| [`PATTERNS.md`](PATTERNS.md) | Five common failure shapes (upstream degradation · retry amplification · concurrency saturation · cache inefficiency · breaker instability) cross-indexed against runbooks. Added v0.6.6. |
| [`../../tools/extract_tuning_data.sh`](../../tools/extract_tuning_data.sh) | Bash + curl script that runs the QUERIES.md catalog against a live Prometheus and writes one JSON file per query. No external deps. Added v0.6.8. |
| [`../../tools/classify_alerts.sh`](../../tools/classify_alerts.sh) | Bash script that reads the `extract_tuning_data.sh` output + `ops/incidents.md` and emits `classification_candidates.json` (suggestion-only TP/FP/uncertain counts per alert). No new metrics; read-only on `ops/incidents.md`. Added v0.6.9. |
| [`../../tools/build_tuning_report.sh`](../../tools/build_tuning_report.sh) | Bash script that consumes `classification_candidates.json` and emits a §B markdown draft with every value prefixed `suggested:`. **Does not write to `TUNING_REPORT.md`** — operator copies confirmed values manually after CLASSIFICATION_REVIEW.md walk-through. Added v0.6.9. |
| [`runbooks/`](runbooks/) | One file per alert (15 total). Six-section playbook each: what it means · likely causes · verify · actions · escalate · feedback log. |
| [`METRICS.md`](METRICS.md) | Full reference for every `rdap_*` Prometheus metric the engine emits, with example PromQL for each. |
| [`grafana-dashboard.json`](grafana-dashboard.json) | Importable Grafana dashboard. 26 panels: engine-health stat at top + 25 panels across 7 sections (overview, errors, cache, concurrency, breaker, retries, per-host pressure, slow requests). Schema version 39 (Grafana 10+). |
| [`prometheus-alerts.yaml`](prometheus-alerts.yaml) | 15 alerts in 3 severity tiers (5 critical / 7 warning / 3 info). Includes Google-SRE multi-window multi-burn-rate alerts for both error and latency budgets. |
| [`alert-tests/`](alert-tests/) | `promtool test rules` unit tests that exercise alert firing/resolution against synthetic time series. Run with `tools/get_promtool.sh && ./tools/promtool test rules docs/observability/alert-tests/t8_rules_test.yaml`. |

## Importing the Grafana dashboard

1. Grafana → Dashboards → New → Import.
2. Paste `grafana-dashboard.json` or upload the file.
3. Pick your Prometheus datasource when prompted (variable `DS_PROMETHEUS`).

The top "Engine health" stat panel (added v0.6.4) renders a single
OK / DEGRADED / FAILING traffic light derived from the same SLIs
that drive the alerts. Use it as the dashboard's at-a-glance state.

## Loading the alert rules

Drop `prometheus-alerts.yaml` into your Prometheus rules directory and
reference it from the main config:

```yaml
rule_files:
  - "rdapify-alerts.yaml"
```

Reload Prometheus (`SIGHUP` or `/-/reload`).

### Replacing placeholders before deploying

Two placeholders need substitution:

- `${TEAM}` — your paging team identifier (e.g. `rdapify-oncall`).
- `runbook_url` values currently point to
  `https://github.com/rdapify/RDAPify/blob/main/rdapify-rust/docs/observability/runbooks/<name>.md`.
  Replace with your internal runbook host if you mirror the docs
  inside your wiki:

  ```sh
  sed -i 's#https://github.com/rdapify/RDAPify/blob/main/rdapify-rust/docs/observability/runbooks#https://wiki.example.com/rdapify/runbooks#g' \
      prometheus-alerts.yaml
  ```

## Wiring the engine

The dashboard and alerts assume the engine's `metrics` feature is on
and `install_recorder` is called at process start. See the
"Operator wiring quickstart" section in [`METRICS.md`](METRICS.md).

## What's deliberately not here

- **Distributed tracing exporters** (OTLP, Jaeger, Tempo) — see
  [`../KNOWN_LIMITS.md`](../KNOWN_LIMITS.md). The engine emits
  `tracing` spans but no built-in distributed exporter; install your
  own `tracing-subscriber` layer.
- **A `/debug/metrics-summary` endpoint on `rdap-service`**. The
  v0.6.3 spec marked it optional, and a clean implementation would
  require a small additive `RdapClient::cache_len()` accessor — that's
  borderline against the "NO changes to engine logic" constraint.
  Operators who want a JSON snapshot of cache size, inflight, and
  breaker count can compute it from the existing `/metrics` endpoint
  via `metric_relabel_configs` or a thin sidecar. The accessor itself
  can land in v0.7.0 alongside the planned per-origin sub-pool work.
- **A `rdap-service` reload-config endpoint**. Out of scope for
  observability; behaviour change.

## Related docs

- [`../SLO.md`](../SLO.md) — formal availability and latency
  targets, with the PromQL queries in this directory keyed off them.
- [`../PERFORMANCE.md`](../PERFORMANCE.md) — what latency and
  throughput to expect from the engine in production.
- [`../KNOWN_LIMITS.md`](../KNOWN_LIMITS.md) — bounded properties
  and trade-offs relevant to dashboards.
- [`../../loadtest/reports/STAGE_E_SLO_REPORT.md`](../../loadtest/reports/STAGE_E_SLO_REPORT.md)
  — load-test validation that produced the threshold values used in
  the alerts.
