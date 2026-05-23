//! E4 — Upstream failure (50 % 5xx).
//!
//! Setup:
//!   - mock returns 500 for 50 % of requests, 20 ms latency
//!   - `total_requests` queries (default 1 000)
//!   - `concurrent_clients` workers (default 200)
//!
//! Expectation:
//!   - circuit breakers trip after the threshold of consecutive failures
//!     (5 by default in `rdap-core::circuit_breaker`)
//!   - retries are bounded — `rdap_retry_total{class="http_5xx"}` should
//!     be a small multiple of failed requests, not unbounded
//!   - p95 stays under 500 ms (Stage E spec target). After the breaker
//!     opens, subsequent requests fail-fast with `CircuitOpen` in well
//!     under 1 ms — so latency actually IMPROVES under sustained
//!     failure, not degrades.
//!
//! Validation:
//!   - `rdap_circuit_breaker_open_total{origin}` > 0 (breaker tripped)
//!   - retry count is bounded (≤ retries_per_failure × max_attempts × failed_count)
//!   - p95 < 500 ms

use std::sync::Arc;
use std::time::Instant;

use rdapify::RdapClient;
use tokio::sync::Mutex;
use tokio::sync::Semaphore;
use tokio::task::JoinSet;

use crate::outcome::ScenarioOutcome;
use crate::stats::Stats;

pub struct E4Config {
    pub total_requests: u64,
    pub concurrent_clients: u64,
    pub upstream_url: String,
}

pub async fn run(client: Arc<RdapClient>, cfg: E4Config) -> ScenarioOutcome {
    eprintln!(
        "E4: {} total requests at {} concurrent clients (50 % upstream failure)",
        cfg.total_requests, cfg.concurrent_clients
    );

    let stats = Arc::new(Mutex::new(Stats::new()));
    let mut tasks = JoinSet::new();
    // Bound concurrent in-flight from the harness side so we don't
    // outpace the mock's accept queue.
    let gate = Arc::new(Semaphore::new(cfg.concurrent_clients as usize));

    for i in 0..cfg.total_requests {
        let permit = Arc::clone(&gate).acquire_owned().await.expect("permit");
        let client = Arc::clone(&client);
        let stats = Arc::clone(&stats);
        let domain = format!("e4-{i:06}.example");
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

    // Read upstream's served-request count to compute a retry "amplification
    // factor" (upstream calls / harness queries). If the engine were
    // unbounded, an upstream that 5xx-spam would push amplification well
    // above max_attempts. The breaker should keep it close to 1.
    let upstream_calls = scrape_mock_request_count(&cfg.upstream_url).await.unwrap_or(0);
    let amp = upstream_calls as f64 / cfg.total_requests.max(1) as f64;

    ScenarioOutcome::new(stats)
        .note("total_requests", cfg.total_requests.to_string())
        .note("concurrent_clients", cfg.concurrent_clients.to_string())
        .note("upstream_calls (mock /stats)", upstream_calls.to_string())
        .note(
            "retry amplification (upstream/harness)",
            format!("{amp:.2}×  (max_attempts=3 ⇒ ceiling 3.0× without breaker; breaker should keep this near 1.0×)"),
        )
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
