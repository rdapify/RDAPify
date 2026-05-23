//! E5 — Rate limiting (429 + Retry-After).
//!
//! Setup:
//!   - mock returns 429 + `Retry-After: 2` on every request
//!   - `total_requests` queries (default 50, kept small because each
//!     query takes ≥ `retry_after_secs × (max_attempts - 1)` to complete)
//!   - `concurrent_clients` (default 10)
//!
//! Expectation:
//!   - the engine waits the full Retry-After between attempts (verified
//!     by elapsed wall time per query)
//!   - retry count is bounded by `retry_limit_429` × max_attempts
//!   - the *upstream* sees one query roughly every Retry-After window,
//!     not a stampede

use std::sync::Arc;
use std::time::Instant;

use rdapify::RdapClient;
use tokio::sync::Mutex;
use tokio::sync::Semaphore;
use tokio::task::JoinSet;

use crate::outcome::ScenarioOutcome;
use crate::stats::Stats;

pub struct E5Config {
    pub total_requests: u64,
    pub concurrent_clients: u64,
    pub upstream_url: String,
    /// Mirrors the mock's `--retry-after-secs` flag — used to compute the
    /// minimum-elapsed-time invariant.
    pub retry_after_secs: u64,
}

pub async fn run(client: Arc<RdapClient>, cfg: E5Config) -> ScenarioOutcome {
    eprintln!(
        "E5: {} requests, {} concurrent (every response 429, Retry-After: {} s)",
        cfg.total_requests, cfg.concurrent_clients, cfg.retry_after_secs
    );

    let stats = Arc::new(Mutex::new(Stats::new()));
    let mut tasks = JoinSet::new();
    let gate = Arc::new(Semaphore::new(cfg.concurrent_clients as usize));
    let scenario_start = Instant::now();

    for i in 0..cfg.total_requests {
        let permit = Arc::clone(&gate).acquire_owned().await.expect("permit");
        let client = Arc::clone(&client);
        let stats = Arc::clone(&stats);
        let domain = format!("e5-{i:06}.example");
        tasks.spawn(async move {
            let _p = permit;
            let t0 = Instant::now();
            let res = client.domain(&domain).await;
            let dt = t0.elapsed();
            let mut s = stats.lock().await;
            match res {
                Ok(_) => s.record_ok(dt),
                Err(_) => s.record_err(dt),
            }
        });
    }
    while let Some(_r) = tasks.join_next().await {}
    let stats = Arc::into_inner(stats).expect("all tasks done").into_inner();

    let total_elapsed = scenario_start.elapsed();
    let upstream_calls = scrape_mock_request_count(&cfg.upstream_url).await.unwrap_or(0);

    // Single-query expected behaviour:
    //   attempt 1 → 429 → wait Retry-After
    //   attempt 2 → 429 → wait Retry-After
    //   attempt 3 → 429 → fail
    // ⇒ per-query elapsed ≥ 2 × Retry-After.
    let min_per_query_secs = (cfg.retry_after_secs as f64) * 2.0;
    let min_per_query_ms = min_per_query_secs * 1000.0;

    // Median (p50) per-query latency must be at least `min_per_query_ms`.
    // If it's below, the engine is short-circuiting Retry-After — that's
    // a retry-storm bug.
    let respected = stats.p50_ms() >= min_per_query_ms * 0.95; // 5% slack for clock skew
    let retry_storm_bound = cfg.total_requests.saturating_mul(3); // ≤ 3 attempts/query

    // Capture the p50 *before* moving `stats` into the outcome so we can
    // include it in any failure message without a borrow-after-move.
    let observed_p50_ms = stats.p50_ms();

    let mut outcome = ScenarioOutcome::new(stats)
        .note("total_requests", cfg.total_requests.to_string())
        .note(
            "concurrent_clients",
            cfg.concurrent_clients.to_string(),
        )
        .note("retry_after_secs", cfg.retry_after_secs.to_string())
        .note(
            "expected min per-query latency",
            format!("{min_per_query_ms:.0} ms  (= {} × Retry-After)", 2),
        )
        .note(
            "total wall time",
            format!("{:.2} s", total_elapsed.as_secs_f64()),
        )
        .note(
            "upstream_calls (mock /stats)",
            format!(
                "{upstream_calls}  (no-storm bound: ≤ {retry_storm_bound} = total_requests × max_attempts)"
            ),
        );

    if !respected {
        outcome = outcome.fail(format!(
            "p50 per-query latency {observed_p50_ms:.2} ms is below the Retry-After floor {min_per_query_ms:.0} ms — engine is NOT honouring `Retry-After` (retry storm)"
        ));
    }
    if upstream_calls > retry_storm_bound {
        outcome = outcome.fail(format!(
            "upstream call count {upstream_calls} exceeds retry-storm bound {retry_storm_bound}"
        ));
    }

    outcome
}

async fn scrape_mock_request_count(upstream_url: &str) -> Option<u64> {
    let url = format!("{}/stats", upstream_url.trim_end_matches('/'));
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(500))
        .build()
        .ok()?;
    let body = client.get(&url).send().await.ok()?.text().await.ok()?;
    let key = "\"requests_served\":";
    let idx = body.find(key)? + key.len();
    let tail = body[idx..].trim_start_matches([' ', ':']);
    let end = tail.find(|c: char| !c.is_ascii_digit()).unwrap_or(tail.len());
    tail[..end].parse::<u64>().ok()
}
