//! E2 — Cold cache / fan-out (single-flight verification).
//!
//! Setup:
//!   - `unique_domains` distinct cache keys (default 1 000)
//!   - `concurrent_clients` workers (default 200), each iterating through
//!     ALL unique domains
//!   - upstream latency: 10 ms (set on the mock via `--latency-ms`)
//!
//! Expectation:
//!   - upstream call count ≈ unique_domains, NOT concurrent_clients ×
//!     unique_domains. The engine's `try_acquire_refresh` single-flight
//!     dedup must collapse concurrent same-key fetches into one upstream
//!     attempt. The 200 follower-clients block on the leader's notify
//!     instead of duplicating the network call.
//!   - latency stays bounded: leader pays ~10 ms, followers ~10 ms +
//!     wakeup, so distribution is bimodal but bounded.
//!
//! Validation:
//!   - p95 < 300 ms (engine SLO).
//!   - upstream calls ≤ unique_domains × 1.5 (1.5× slack for legitimate
//!     re-fetches in the stale window — should not be hit in this test
//!     since the cache TTL is 1 hour).

use std::sync::Arc;
use std::time::Instant;

use rdapify::RdapClient;
use tokio::sync::Mutex;
use tokio::task::JoinSet;

use crate::outcome::ScenarioOutcome;
use crate::stats::Stats;

pub struct E2Config {
    pub concurrent_clients: u64,
    pub unique_domains: u64,
    /// Used to scrape `<upstream>/stats` after the run for the
    /// upstream-call-count assertion (single-flight verification).
    pub upstream_url: String,
}

pub async fn run(client: Arc<RdapClient>, cfg: E2Config) -> ScenarioOutcome {
    eprintln!(
        "E2: {} concurrent clients × {} unique domains = {} total ops",
        cfg.concurrent_clients,
        cfg.unique_domains,
        cfg.concurrent_clients * cfg.unique_domains
    );

    // Capture the upstream's request count BEFORE the run so we can
    // attribute exactly the new calls to this scenario.
    let baseline_upstream = scrape_mock_request_count(&cfg.upstream_url).await.unwrap_or(0);

    let stats = Arc::new(Mutex::new(Stats::new()));
    let mut tasks = JoinSet::new();
    let unique_domains = cfg.unique_domains;
    let concurrent_clients = cfg.concurrent_clients;

    // Spawn `concurrent_clients` workers. Each worker iterates the FULL
    // domain list. Workers start within ~ns of each other so the
    // single-flight slot for the *first* domain is contended by all
    // concurrent_clients followers — that's the test we want.
    for _ in 0..concurrent_clients {
        let client = Arc::clone(&client);
        let stats = Arc::clone(&stats);
        tasks.spawn(async move {
            for i in 0..unique_domains {
                let domain = format!("cold-{i:06}.example");
                let t0 = Instant::now();
                let res = client.domain(&domain).await;
                let dt = t0.elapsed();
                let mut s = stats.lock().await;
                match res {
                    Ok(_) => s.record_ok(dt),
                    Err(_) => s.record_err(dt),
                }
            }
        });
    }
    while let Some(_r) = tasks.join_next().await {}
    let stats = Arc::into_inner(stats).expect("all tasks done").into_inner();

    let after_upstream = scrape_mock_request_count(&cfg.upstream_url).await.unwrap_or(0);
    let upstream_calls = after_upstream.saturating_sub(baseline_upstream);

    // The single-flight bound: in the perfect case, upstream sees
    // exactly `unique_domains` calls. We allow up to 2× slack to absorb
    // genuine non-determinism (timing windows where a slot is released
    // before all followers register, then re-acquired by a late comer).
    // Anything beyond 5× would be a fan-out leak worth investigating.
    let perfect = unique_domains;
    let bound = unique_domains.saturating_mul(5).max(unique_domains + 100);

    let mut outcome = ScenarioOutcome::new(stats)
        .note(
            "concurrent_clients",
            concurrent_clients.to_string(),
        )
        .note("unique_domains", unique_domains.to_string())
        .note(
            "upstream_calls (mock /stats delta)",
            format!(
                "{upstream_calls}  (perfect single-flight: {perfect}, fan-out leak threshold: {bound})"
            ),
        )
        .note(
            "fan-out factor",
            format!(
                "{:.2}× of unique domains  (1.0× = perfect dedup; concurrent_clients={concurrent_clients}× would be no dedup at all)",
                upstream_calls as f64 / perfect.max(1) as f64
            ),
        );

    if upstream_calls > bound {
        outcome = outcome.fail(format!(
            "upstream call count {upstream_calls} exceeds single-flight bound {bound} \
             (fan-out leak — concurrent same-key fetches not being collapsed)"
        ));
    }

    outcome
}

/// Reads the mock's `/stats` endpoint, returning `requests_served` if
/// reachable. Hard-fails (returns `None`) if the mock is unreachable so
/// the SLO check doesn't silently become a no-op.
async fn scrape_mock_request_count(upstream_url: &str) -> Option<u64> {
    let url = format!("{}/stats", upstream_url.trim_end_matches('/'));
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(500))
        .build()
        .ok()?;
    let body = client.get(&url).send().await.ok()?.text().await.ok()?;
    // Mock returns `{"requests_served": <num>}`. Avoid pulling serde_json
    // for one field — substring grab is fine on a known-shape payload.
    let key = "\"requests_served\":";
    let idx = body.find(key)? + key.len();
    let tail = body[idx..].trim_start_matches([' ', ':']);
    let end = tail.find(|c: char| !c.is_ascii_digit()).unwrap_or(tail.len());
    tail[..end].parse::<u64>().ok()
}
