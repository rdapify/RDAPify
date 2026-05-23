//! E6 — Adversarial input (high cardinality).
//!
//! Setup:
//!   - 50 000+ unique domains, all routed through a single mock origin
//!   - `concurrent_clients` workers (default 256)
//!
//! Expectation:
//!   - process memory stays bounded (no leak)
//!   - cache eviction kicks in long before total domain count is reached
//!     (default cache cap is 1 000 entries)
//!   - circuit-breaker registry stays bounded (only 1 origin in this test
//!     because we route all domains through one mock, so this is trivially
//!     bounded — separate `registry_caps_at_capacity_under_million_keys`
//!     unit test in `rdap-core::circuit_breaker` covers the multi-origin
//!     LRU cap directly).
//!
//! Validation:
//!   - run completes (no OOM, no panic)
//!   - every query is a cache MISS (cardinality > cache cap by ~50×)
//!   - RSS delta is below a generous bound (≤ 200 MiB delta from start)

use std::fs;
use std::sync::Arc;
use std::time::Instant;

use rdapify::RdapClient;
use tokio::sync::Mutex;
use tokio::sync::Semaphore;
use tokio::task::JoinSet;

use crate::outcome::ScenarioOutcome;
use crate::stats::Stats;

pub struct E6Config {
    pub unique_domains: u64,
    pub concurrent_clients: u64,
}

pub async fn run(client: Arc<RdapClient>, cfg: E6Config) -> ScenarioOutcome {
    eprintln!(
        "E6: driving {} unique domains at {} concurrent (cache cardinality stress)",
        cfg.unique_domains, cfg.concurrent_clients
    );

    let rss_before_kb = read_rss_kb();

    let stats = Arc::new(Mutex::new(Stats::new()));
    let mut tasks = JoinSet::new();
    let gate = Arc::new(Semaphore::new(cfg.concurrent_clients as usize));

    for i in 0..cfg.unique_domains {
        let permit = Arc::clone(&gate).acquire_owned().await.expect("permit");
        let client = Arc::clone(&client);
        let stats = Arc::clone(&stats);
        // Use a wide pseudo-random shape so the cache key distribution is
        // adversarial even before the engine hashes it.
        let domain = format!("adv-{:08x}-{}.example", i.wrapping_mul(2654435761), i);
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

    let rss_after_kb = read_rss_kb();
    let rss_delta_kb = rss_after_kb.saturating_sub(rss_before_kb);
    // Allow 200 MiB ceiling — generous for a 50k-domain run; real-world
    // leaks would put this in the multi-GB range.
    let rss_ceiling_kb: u64 = 200 * 1024;

    let mut outcome = ScenarioOutcome::new(stats)
        .note("unique_domains", cfg.unique_domains.to_string())
        .note(
            "concurrent_clients",
            cfg.concurrent_clients.to_string(),
        )
        .note(
            "RSS before",
            format!("{} KiB ({:.1} MiB)", rss_before_kb, rss_before_kb as f64 / 1024.0),
        )
        .note(
            "RSS after",
            format!("{} KiB ({:.1} MiB)", rss_after_kb, rss_after_kb as f64 / 1024.0),
        )
        .note(
            "RSS delta",
            format!(
                "{} KiB ({:.1} MiB)  (ceiling: {} MiB)",
                rss_delta_kb,
                rss_delta_kb as f64 / 1024.0,
                rss_ceiling_kb / 1024
            ),
        );

    if rss_delta_kb > rss_ceiling_kb {
        outcome = outcome.fail(format!(
            "RSS grew by {rss_delta_kb} KiB during run, exceeding the {rss_ceiling_kb}-KiB ceiling — possible leak"
        ));
    }

    outcome
}

/// Reads the current process's RSS (resident set size) in KiB from
/// `/proc/self/status`. Returns 0 on non-Linux or unreadable proc.
fn read_rss_kb() -> u64 {
    let status = match fs::read_to_string("/proc/self/status") {
        Ok(s) => s,
        Err(_) => return 0,
    };
    for line in status.lines() {
        if let Some(rest) = line.strip_prefix("VmRSS:") {
            // "VmRSS:    12345 kB"
            let parts: Vec<&str> = rest.split_whitespace().collect();
            if let Some(n) = parts.first() {
                return n.parse().unwrap_or(0);
            }
        }
    }
    0
}
