# Observation Window Attestation — TEMPLATE

> **How to use this file.** Copy to `ops/attestations/<YYYY-MM-DD>.md`
> on the day the window starts. Fill in `WINDOW_START` then. Leave
> `WINDOW_END` blank until §6 of
> [`../../docs/observability/OBSERVATION_WINDOW.md`](../../docs/observability/OBSERVATION_WINDOW.md).
> Do **not** edit this `TEMPLATE.md` itself.

---

## Window

| Field | Value |
|---|---|
| `WINDOW_START` (UTC date) | `YYYY-MM-DD` |
| `WINDOW_END`   (UTC date) | _(leave blank — fill at end-of-window)_ |
| Planned length | `7d` \| `14d` |
| Engine version under observation | `vX.Y.Z` |
| Workspace commit (sha) | `<short-sha>` |

## Environment

| Field | Value |
|---|---|
| Deployment name | _(e.g. `rdap-service-prod-eu-west-1`)_ |
| Region / cluster | _(free text)_ |
| Replicas | _(integer)_ |
| Real production traffic? | **YES** _(if NO, do not file — see OBSERVATION_WINDOW.md §1)_ |
| Approximate request rate (req/s) | _(integer; from rdap_requests_total rate)_ |
| Engine config: `concurrency_limit` | _(integer — must match shipped default unless documented)_ |
| Engine config: `per_host_concurrency_limit` | _(integer or `None`)_ |
| Engine features compiled | `metrics` _(plus any others, comma-separated)_ |

## Prometheus / observability stack

| Field | Value |
|---|---|
| Prometheus URL | _(internal URL or `<redacted>` — operational only, never commit a public token)_ |
| Scrape interval | _(seconds, ≤ 30)_ |
| Alertmanager retention | _(hours, ≥ 336)_ |
| Grafana dashboard imported? | yes / no |
| `prometheus-alerts.yaml` SHA at start | `<md5sum>` |
| `grafana-dashboard.json` SHA at start | `<md5sum>` |
| `SLO.md` SHA at start | `<md5sum>` |

The three SHA fields exist so that any unauthorised mid-window edit is
detectable at end-of-window. If any of those three SHAs change while
the window is open, the window is invalidated.

## Pre-flight verification

Tick each box on the day `WINDOW_START` is set. Each box corresponds
to a check in
[`../../docs/observability/OBSERVATION_WINDOW.md`](../../docs/observability/OBSERVATION_WINDOW.md)
§2 and most can be confirmed by running
[`../../tools/preflight_check.sh`](../../tools/preflight_check.sh).

- [ ] Engine running with `--features metrics`; `/metrics` returns
      Prometheus text.
- [ ] Prometheus target is `UP` with recent `Last Scrape`.
- [ ] Alertmanager loaded with `prometheus-alerts.yaml` (placeholders
      replaced).
- [ ] Alertmanager retention ≥ 14 d.
- [ ] Grafana dashboard imported.
- [ ] `tools/preflight_check.sh` passed against the live `PROM_URL`.
- [ ] `ops/incidents.md` is empty of placeholder content (or the
      placeholder is clearly distinguishable from real entries).
- [ ] Team channel announcement posted with window dates and freeze
      reminder.

## Operator declaration

| Field | Value |
|---|---|
| Operator name / handle | _(your name)_ |
| Operator role | _(SRE / on-call lead / platform owner)_ |
| Date of declaration (UTC) | `YYYY-MM-DD` |
| Contact for window questions | _(email or chat handle)_ |

### Statement of integrity

> **This window used real production data. No synthetic inputs.**
>
> I confirm that during the window declared above:
>
> - The engine served real RDAP queries from real users / clients.
> - No synthetic load generator, replayed traffic, or staged test
>   harness contributed metric samples that fed `rdap_*` counters.
> - The freeze rules in
>   [`../../docs/observability/OBSERVATION_WINDOW.md`](../../docs/observability/OBSERVATION_WINDOW.md)
>   §5 will be observed for the full window duration.
> - Every alert fire and every incident (whether or not an alert
>   fired) will be recorded in `ops/incidents.md` per its schema.
> - The end-of-window pipeline (§6 of OBSERVATION_WINDOW.md) will be
>   run from real Prometheus data; no values will be hand-edited
>   into `TUNING_REPORT.md`.

`Signature: _________________________`  (operator name + UTC date)

---

## End-of-window addendum

_Fill in only on the day `WINDOW_END` is set._

| Field | Value |
|---|---|
| `WINDOW_END` (UTC date) | `YYYY-MM-DD` |
| Total alerts fired | _(integer; matches `incidents.md` block count for fires)_ |
| Alerts marked `Real? = no` ≥ 3 times for the same alert | _(list alert names or `none`)_ |
| Missed incidents | _(integer; rows tagged `Triggered by: (no alert fired)`)_ |
| `tuning-data-<UTC-date>/` path | _(produced by `tools/extract_tuning_data.sh`)_ |
| `prometheus-alerts.yaml` SHA at end | `<md5sum>` _(must match start)_ |
| `grafana-dashboard.json` SHA at end | `<md5sum>` _(must match start)_ |
| `SLO.md` SHA at end | `<md5sum>` _(must match start)_ |
| Outcome | `calibration-confirmed` \| `tuning-warranted` _(see OBSERVATION_WINDOW.md §7)_ |
| `TUNING_REPORT.md` updated? | yes / no |
| Link to PR (if `tuning-warranted`) | _(URL or `none`)_ |

`Signature: _________________________`  (operator name + UTC date)

---

_File one of these per window. Past attestations are reference material;
do not delete or edit them. The next window starts a new file._
