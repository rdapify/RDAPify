# RDAPify — Alert-rule unit tests

`promtool test rules` validates that every alert in
[`../prometheus-alerts.yaml`](../prometheus-alerts.yaml) fires and
resolves at the documented thresholds against synthetic time series.
Run before any release that touches the alert rules; run in CI on
every PR.

## Run

**One-time setup** — fetch the `promtool` binary (~189 MB; not
committed to the repo, fetched on demand):

```sh
tools/get_promtool.sh
```

The script is idempotent: if `tools/promtool` is already present at
the pinned version (default `3.11.3`), it exits immediately. CI
caches the binary or re-runs this step per job — both are fine.

**Run the tests**:

```sh
./tools/promtool test rules docs/observability/alert-tests/t8_rules_test.yaml
```

Expected output: `SUCCESS` with exit code 0. Any failing test prints
the alert's labels, annotations, and the mismatch.

## Static rule check (cheap)

Validates PromQL syntax and rule-file structure without exercising
firing semantics. Fast — runs in < 1 s:

```sh
./tools/promtool check rules docs/observability/prometheus-alerts.yaml
# Expected: SUCCESS: 15 rules found
```

## What's covered

| Test | Alert under test | Verifies |
|---|---|---|
| `high_error_rate_fires_then_resolves` | `RdapifyHighErrorRate` | Fires at 10 % error rate after 5 m for-window; resolves once errors stop |
| `inflight_saturation_fires` | `RdapifyInflightSaturation` | Fires at gauge ≥ 240 sustained for 3 m |
| `breaker_flapping_fires` | `RdapifyBreakerFlapping` | Fires at ≥ 15 trips in 5 m sustained for 5 m (sums `closed→open` + `half_open→open`) |
| `retry_spike_fires` | `RdapifyRetrySpike` | Fires when 5-min rate > 3× trailing-1h baseline sustained for 10 m |

The other 11 alerts in `prometheus-alerts.yaml` are validated
syntactically by `promtool check rules` but not yet exercised by
firing tests. Adding them follows the same pattern in this YAML.

## Files in this directory

| File | Purpose |
|---|---|
| `t8_rules_test.yaml` | The test suite. Each `tests[]` entry has an `input_series` block and an `alert_rule_test` block of expected alert states. |

## Adjusting tests

The contract: **alert rules in `prometheus-alerts.yaml` are
authoritative**. If a test fails, fix the test data or the
expectation, never the rule. To bump a threshold or `for:` window,
go through the
[`../CALIBRATION.md`](../CALIBRATION.md) §7 tuning workflow with
real production data — not a unit-test failure.

## CI integration

Add to your CI workflow:

```yaml
- name: Validate alert rules
  run: |
    tools/get_promtool.sh
    ./tools/promtool check rules docs/observability/prometheus-alerts.yaml
    ./tools/promtool test rules docs/observability/alert-tests/t8_rules_test.yaml
```

Both promtool steps exit non-zero on failure, blocking the merge.

## Versioning

`promtool` is pinned to **3.11.3** in `tools/get_promtool.sh`. Bump
the pin only when a test depends on a newer feature. Document the
bump in `CHANGELOG.md`.

---

_Last updated: 2026-05-01._
