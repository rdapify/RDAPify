//! E1 — Baseline (cache warm).
//!
//! Drive 1 000 req/s for `duration_secs` against the *same* domain so cache
//! hit rate ≈ 100 %. Validates that the cache + facade is fast enough to
//! beat the p50 < 10 ms / p95 < 50 ms targets when there's no upstream
//! pressure.

use std::sync::Arc;
use std::time::{Duration, Instant};

use rdapify::RdapClient;
use tokio::sync::Mutex;
use tokio::task::JoinSet;

use crate::outcome::ScenarioOutcome;
use crate::stats::Stats;

pub struct E1Config {
    pub duration_secs: u64,
    pub target_rps: u64,
    pub domain: String,
}

impl Default for E1Config {
    fn default() -> Self {
        Self {
            duration_secs: 10,
            target_rps: 1_000,
            domain: "example.com".to_string(),
        }
    }
}

pub async fn run(client: Arc<RdapClient>, cfg: E1Config) -> ScenarioOutcome {
    // Warm the cache once so the first measured request is a hit. Failing
    // the warm-up means the upstream isn't reachable — propagate the error.
    eprintln!("E1: warming cache with {}…", cfg.domain);
    client
        .domain(&cfg.domain)
        .await
        .expect("E1 cache warm-up failed — upstream unreachable?");

    let target_total = cfg.duration_secs.saturating_mul(cfg.target_rps);
    let interval = Duration::from_nanos(1_000_000_000 / cfg.target_rps.max(1));
    eprintln!(
        "E1: driving {} req at ~{} rps ({} s, paced @ {:?}/req)",
        target_total, cfg.target_rps, cfg.duration_secs, interval
    );

    let stats = Arc::new(Mutex::new(Stats::new()));
    let mut tasks = JoinSet::new();
    let test_start = Instant::now();

    for i in 0..target_total {
        // Open-loop pacing: if we've already fallen behind, fire immediately;
        // otherwise sleep until the next slot.
        let target_offset = interval.checked_mul(i as u32).unwrap_or(Duration::ZERO);
        let elapsed = test_start.elapsed();
        if elapsed < target_offset {
            tokio::time::sleep(target_offset - elapsed).await;
        }
        let client = Arc::clone(&client);
        let stats = Arc::clone(&stats);
        let domain = cfg.domain.clone();
        tasks.spawn(async move {
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
    let mutex = Arc::into_inner(stats).expect("all tasks completed");
    let stats = mutex.into_inner();
    ScenarioOutcome::new(stats).note("domain", cfg.domain)
}
