//! E3 — Burst load.
//!
//! Spawn `burst_size` concurrent tasks within `ramp_ms` (target: 0 → 2000
//! req/s in < 1 s). Validates that the upstream concurrency semaphore caps
//! actual upstream load and that no Tokio task explosion happens — the
//! engine should queue inside the semaphore, not unbounded-spawn HTTP
//! attempts.
//!
//! Each task fires *one* request against a unique domain so cache hits
//! don't mask the burst. The harness uses the *same* upstream mock for all
//! domains (the engine routes via `custom_bootstrap_servers`, which folds
//! every TLD onto our mock), so the upstream sees the full burst.

use std::sync::Arc;
use std::time::{Duration, Instant};

use rdapify::RdapClient;
use tokio::sync::Mutex;
use tokio::task::JoinSet;

use crate::outcome::ScenarioOutcome;
use crate::stats::Stats;

pub struct E3Config {
    pub burst_size: u64,
    pub ramp_ms: u64,
}

impl Default for E3Config {
    fn default() -> Self {
        Self {
            burst_size: 2_000,
            ramp_ms: 1_000,
        }
    }
}

pub async fn run(client: Arc<RdapClient>, cfg: E3Config) -> ScenarioOutcome {
    eprintln!(
        "E3: spawning {} concurrent requests in {} ms",
        cfg.burst_size, cfg.ramp_ms
    );
    let stats = Arc::new(Mutex::new(Stats::new()));
    let mut tasks = JoinSet::new();
    let burst_start = Instant::now();
    // Even spread of task spawns over the ramp window. With 2000 in 1000 ms
    // that's a 0.5 ms gap between spawns; tokio handles this without
    // backpressure on the spawn side.
    let gap = Duration::from_nanos(
        (cfg.ramp_ms.saturating_mul(1_000_000) / cfg.burst_size.max(1)).max(1),
    );

    for i in 0..cfg.burst_size {
        let target_offset = gap.checked_mul(i as u32).unwrap_or(Duration::ZERO);
        let elapsed = burst_start.elapsed();
        if elapsed < target_offset {
            tokio::time::sleep(target_offset - elapsed).await;
        }
        let client = Arc::clone(&client);
        let stats = Arc::clone(&stats);
        let domain = format!("burst-{:06}.example", i);
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
    ScenarioOutcome::new(stats)
        .note("burst_size", cfg.burst_size.to_string())
        .note("ramp_ms", cfg.ramp_ms.to_string())
}
