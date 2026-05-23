# RDAPify — Tuning-Data Export Guide

> Three ways to pull data out of Prometheus and into the
> [`TUNING_REPORT.md`](TUNING_REPORT.md) cells:
>
> 1. **Prometheus UI** — fastest for one-off lookups; manual.
> 2. **`curl` against `/api/v1/query`** — scriptable, used by
>    [`tools/extract_tuning_data.sh`](../../tools/extract_tuning_data.sh).
> 3. **Grafana dashboard CSV export** — convenient when the panel
>    already shows what you need.
>
> All three are read-only. They do not modify the engine, the alert
> rules, or any threshold.

---

## 1. Prometheus UI (manual)

Open Prometheus in your browser:

```
https://<your-prometheus-host>/graph
```

For each query in [`QUERIES.md`](QUERIES.md):

1. Paste the query into the **Expression** input.
2. Pick **Console** view for instant queries (single number) or
   **Graph** for `_range` queries (over time).
3. Set the time picker to your observation window (e.g. *Last 14
   days*) for `_range` queries.
4. Copy the numeric result into the matching cell in
   [`TUNING_REPORT.md`](TUNING_REPORT.md).

### Tip — substitute the variables before pasting

`QUERIES.md` uses `${WINDOW}`, `${SCRAPE}`, `${ALERT}`, `${ORIGIN}`.
Substitute them first; Prometheus does not interpolate variables.

```promql
# template
sum by (alertname) (changes(ALERTS{alertstate="firing"}[${WINDOW}]))

# after substitution (14-day window)
sum by (alertname) (changes(ALERTS{alertstate="firing"}[14d]))
```

### Tip — copy the value, not the whole row

Prometheus' Console view renders one row per series. The numeric
value is the rightmost column. For single-scalar queries the row
collapses to one value — that's what goes into the report cell.

---

## 2. `curl` against `/api/v1/query` and `/api/v1/query_range`

This is the scriptable path. Two endpoints matter:

| Endpoint | Use | Returns |
|---|---|---|
| `/api/v1/query` | one instantaneous value at "now" | scalar / vector |
| `/api/v1/query_range` | values over a time range | matrix (per-series time series) |

### 2.1 Instant query — one number

```sh
PROM=https://<your-prometheus-host>
QUERY='sum(rate(rdap_requests_total[5m]))'

curl -sfG --data-urlencode "query=${QUERY}" \
     "${PROM}/api/v1/query"
```

**Output** (JSON):

```json
{
  "status":"success",
  "data":{
    "resultType":"vector",
    "result":[
      {"metric":{},"value":[1714498800.123,"42.5"]}
    ]
  }
}
```

The numeric value is at `data.result[0].value[1]` (a string —
parse to float before arithmetic).

### 2.2 Range query — values over time

```sh
PROM=https://<your-prometheus-host>
QUERY='histogram_quantile(0.95, sum by (le) (rate(rdap_latency_seconds_bucket[5m])))'

# 14-day window, sampled every 5 minutes
END=$(date -u +%s)
START=$((END - 14*86400))
STEP=300

curl -sfG \
     --data-urlencode "query=${QUERY}" \
     --data-urlencode "start=${START}" \
     --data-urlencode "end=${END}" \
     --data-urlencode "step=${STEP}" \
     "${PROM}/api/v1/query_range"
```

**Output** (JSON, matrix):

```json
{
  "status":"success",
  "data":{
    "resultType":"matrix",
    "result":[
      {"metric":{},"values":[[1714411200,"0.082"],[1714411500,"0.079"], ...]}
    ]
  }
}
```

Each entry is `[unix_timestamp, value_string]`. Walk the array to
get one sample per `step`.

### 2.3 Authentication

If your Prometheus is behind basic auth or a bearer token:

```sh
# Basic auth
curl -sfG -u user:pass --data-urlencode "query=${QUERY}" "${PROM}/api/v1/query"

# Bearer token
curl -sfG -H "Authorization: Bearer ${TOKEN}" \
     --data-urlencode "query=${QUERY}" "${PROM}/api/v1/query"
```

### 2.4 Time-window selection

Pick the window per [`TUNING_REPORT.md`](TUNING_REPORT.md) §A:

| Window | `START` calculation | Notes |
|---|---|---|
| Last 7 days | `END - 7*86400` | minimum admissible |
| Last 14 days | `END - 14*86400` | preferred |
| Last 30 days | `END - 30*86400` | older data may be stale |
| Specific dates | `START=$(date -u -d '2026-04-01 00:00:00' +%s)` | for retrospective audits |

Always use **UTC** (`date -u`). Mixing local time with Prometheus's
UTC timestamps will silently shift the window.

### 2.5 Step (resolution) tips

`step` is the sampling interval for `query_range`. Smaller `step` =
more samples = larger response. Recommended:

| Window | `step` | Approx samples |
|---|---|---|
| ≤ 1 h | `15s`–`30s` | ~120–240 |
| 1–24 h | `1m`–`5m` | ~300–1440 |
| 1–14 d | `5m`–`1h` | ~336–4 032 |
| 30 d | `1h` | ~720 |

For TUNING_REPORT baselines, `5m` is the sweet spot — matches the
`[5m]` rate windows used by most queries in QUERIES.md.

### 2.6 Aggregation — running statistics in PromQL

Most TUNING_REPORT cells want a single number per metric per
window. Compute it in PromQL with `quantile_over_time` /
`max_over_time` / `avg_over_time` rather than pulling all samples
and computing client-side:

```promql
# median p95 latency in the window — one scalar
quantile_over_time(0.5,
  histogram_quantile(0.95, sum by (le) (rate(rdap_latency_seconds_bucket[5m])))[14d:5m]
)
```

Run this as an **instant** query (`/api/v1/query`), not a range
query. Prometheus does the heavy lifting and you get one number
ready for the cell.

---

## 3. Grafana dashboard CSV export

When the panel in [`grafana-dashboard.json`](grafana-dashboard.json)
already shows what you need:

1. Open the dashboard.
2. Click the panel title → **Inspect** → **Data**.
3. **Download CSV**.
4. Open the CSV in a spreadsheet; pick the column matching the
   metric/series you want.

This is the quickest path for *visual* baselines (latency over time,
fire patterns) but inadequate for the precise scalar values
TUNING_REPORT §C requires — those need the PromQL aggregation
queries from §2.6 above.

### What Grafana CSV looks like

```
Time,p50,p95,p99
2026-04-16T00:00:00Z,3.2,28.4,87.1
2026-04-16T00:05:00Z,3.1,29.0,90.5
...
```

Use spreadsheet functions or `awk` to compute medians / max / etc.
across the time column.

---

## 4. Combining the three approaches

Recommended split for filling TUNING_REPORT.md:

| Section | Best path |
|---|---|
| §A scope | Prometheus UI for one-shot dates and request-rate scalars |
| §B alert evaluation | `curl` + `/api/v1/query` for `changes(ALERTS{...})` per alert; spreadsheet for TP/FP/incident classification (see [`ALERT_CLASSIFICATION.md`](ALERT_CLASSIFICATION.md)) |
| §C metric baselines | `tools/extract_tuning_data.sh` (the bundled wrapper) |
| §D runbook effectiveness | `ops/incidents.md` + per-runbook Feedback log — **not** PromQL |
| §E ledger | Prometheus UI per row, citing the §B/§C scalars you already collected |
| §F sign-off | Manual |

---

## 5. JSON → CSV conversion (optional, requires `jq`)

[`extract_tuning_data.sh`](../../tools/extract_tuning_data.sh) emits
raw JSON to keep its dependencies to bash + curl only. To produce
CSV you'll need `jq` (a one-time install on most distros):

```sh
# Linux (Debian/Ubuntu): apt-get install jq
# Linux (RHEL/Fedora):   dnf install jq
# macOS:                 brew install jq

# Convert one instant-query response to "label1,label2,value" CSV:
jq -r '
  .data.result[]
  | [.metric | to_entries[] | "\(.key)=\(.value)"] + [.value[1]]
  | @csv
' query_result.json
```

For range queries (matrix), expand per-sample:

```sh
jq -r '
  .data.result[] as $series
  | $series.values[]
  | [.[0], .[1]] + [($series.metric | to_entries[] | "\(.key)=\(.value)")]
  | @csv
' range_result.json
```

`jq` is optional; if you want a fully bash+curl pipeline, store the
raw JSON and process it in your spreadsheet's JSON-import feature.

---

## 6. Verifying the export is sound

Before any TUNING_REPORT cell gets a number, confirm:

- **Prometheus is UP** for the entire window —
  `min_over_time(up{job="rdapify"}[14d]) == 1`
  (see [`QUERIES.md`](QUERIES.md) §A).
- **Engine emitted metrics** —
  `absent(rdap_requests_total)` returns empty
  (engine has the `metrics` feature on and `install_recorder()` was
  called).
- **Cardinality is sane** —
  `count({__name__=~"rdap_.*"})` returns a number in the 50–500
  range, not > 1 000.

If any of those fails, the window is not admissible per
[`CALIBRATION.md`](CALIBRATION.md) §7.1 and TUNING_REPORT §A
admissibility checkboxes cannot be ticked.

---

_Last updated: 2026-04-30 (v0.6.8). The Prometheus HTTP API used here
is documented at <https://prometheus.io/docs/prometheus/latest/querying/api/>._
