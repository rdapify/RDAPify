//! Stage E load-test harness — drives the rdapify engine in-process against
//! a mock upstream and reports SLO compliance.
//!
//! The harness is **not** a substitute for k6 in a real lab; it's a
//! deterministic, reproducible measurement that runs anywhere `cargo`
//! does. Use it for CI smoke and regression detection. Use k6
//! (`loadtest/k6/`) for production-faithful end-to-end load.

use std::collections::HashMap;
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use std::time::Duration;

use clap::{Parser, Subcommand};
use rdap_metrics::{install_recorder, MetricsHandle, RecorderConfig};
use rdapify::{ClientConfig, FetcherConfig, RdapClient, SsrfConfig};

mod outcome;
mod scenarios;
mod slo;
mod stats;

use outcome::ScenarioOutcome;
use scenarios::{e1, e2, e3, e4, e5, e6};
use slo::{validate, Thresholds};

#[derive(Parser, Debug)]
#[command(version, about = "Stage E load-test harness for the rdapify engine")]
struct Args {
    /// URL of the mock upstream RDAP server. Every TLD is routed to this
    /// origin via `custom_bootstrap_servers` so the engine never reaches
    /// the real internet.
    #[arg(long, default_value = "http://127.0.0.1:18080")]
    upstream: String,

    /// Path to the `mock-upstream` binary. If set, the harness spawns the
    /// mock as a child process and tears it down on exit.
    #[arg(long)]
    spawn_mock: Option<String>,

    #[command(subcommand)]
    scenario: Scenario,
}

#[derive(Subcommand, Debug)]
enum Scenario {
    /// E1 — baseline cache warm: 1 000 rps × 10 s, same domain.
    E1 {
        #[arg(long, default_value = "10")]
        duration_secs: u64,
        #[arg(long, default_value = "1000")]
        rps: u64,
        #[arg(long, default_value = "example.com")]
        domain: String,
    },
    /// E2 — cold cache / fan-out: N concurrent clients × M unique domains.
    /// Validates single-flight collapses duplicate concurrent fetches.
    E2 {
        #[arg(long, default_value = "200")]
        concurrent_clients: u64,
        #[arg(long, default_value = "1000")]
        unique_domains: u64,
    },
    /// E3 — burst: spawn 2 000 concurrent requests inside 1 s.
    E3 {
        #[arg(long, default_value = "2000")]
        burst_size: u64,
        #[arg(long, default_value = "1000")]
        ramp_ms: u64,
    },
    /// E4 — upstream failure: 50 % of upstream responses are 500.
    /// Validates breaker opens, retries are bounded, latency stays under 500 ms p95.
    E4 {
        #[arg(long, default_value = "1000")]
        total_requests: u64,
        #[arg(long, default_value = "200")]
        concurrent_clients: u64,
    },
    /// E5 — rate limiting: 100 % of upstream responses are 429 with Retry-After.
    /// Validates the engine honours Retry-After (no retry storm).
    E5 {
        #[arg(long, default_value = "50")]
        total_requests: u64,
        #[arg(long, default_value = "10")]
        concurrent_clients: u64,
    },
    /// E6 — adversarial input: 50 000+ unique domains, validate memory
    /// stability and bounded internal data structures.
    E6 {
        #[arg(long, default_value = "50000")]
        unique_domains: u64,
        #[arg(long, default_value = "256")]
        concurrent_clients: u64,
    },
}

/// Per-scenario tuneables that don't fit cleanly in `ClientConfig::default`.
#[derive(Clone, Copy)]
struct ClientOverrides {
    max_attempts: u32,
    timeout: Duration,
    /// Cache cap. E6 sets this to a small value so eviction is observably
    /// active without needing a 100k-entry cache.
    cache_max_entries: Option<usize>,
}

impl Default for ClientOverrides {
    fn default() -> Self {
        Self {
            max_attempts: 2,
            timeout: Duration::from_secs(5),
            cache_max_entries: None,
        }
    }
}

#[tokio::main(flavor = "multi_thread")]
async fn main() {
    let args = Args::parse();

    let metrics_handle = install_recorder(&RecorderConfig::default())
        .expect("rdap-metrics recorder installation failed");

    let _mock_guard = args.spawn_mock.as_deref().map(spawn_mock);

    if !wait_until_ready(&args.upstream, Duration::from_secs(5)).await {
        eprintln!(
            "harness: upstream {} not reachable after 5 s — refusing to run",
            args.upstream
        );
        std::process::exit(2);
    }

    let (name, thresholds, outcome) = match &args.scenario {
        Scenario::E1 {
            duration_secs,
            rps,
            domain,
        } => {
            let client = build_client(&args.upstream, ClientOverrides::default()).expect("client");
            let cfg = e1::E1Config {
                duration_secs: *duration_secs,
                target_rps: *rps,
                domain: domain.clone(),
            };
            ("E1", Thresholds::e1_baseline(), e1::run(client, cfg).await)
        }
        Scenario::E2 {
            concurrent_clients,
            unique_domains,
        } => {
            // E2 needs more attempts so concurrent waiters re-converge after
            // the leader's fetch — but the cache-population path means the
            // followers don't actually retry. max_attempts=2 is sufficient.
            let client = build_client(&args.upstream, ClientOverrides::default()).expect("client");
            let cfg = e2::E2Config {
                concurrent_clients: *concurrent_clients,
                unique_domains: *unique_domains,
                upstream_url: args.upstream.clone(),
            };
            ("E2", Thresholds::e2_cold_cache(), e2::run(client, cfg).await)
        }
        Scenario::E3 {
            burst_size,
            ramp_ms,
        } => {
            let client = build_client(&args.upstream, ClientOverrides::default()).expect("client");
            let cfg = e3::E3Config {
                burst_size: *burst_size,
                ramp_ms: *ramp_ms,
            };
            ("E3", Thresholds::e3_burst(), e3::run(client, cfg).await)
        }
        Scenario::E4 {
            total_requests,
            concurrent_clients,
        } => {
            // E4 *needs* retries enabled to prove they're bounded; max_attempts=3
            // gives the breaker a fair chance to trip while the retry counter
            // climbs.
            let client = build_client(
                &args.upstream,
                ClientOverrides {
                    max_attempts: 3,
                    ..Default::default()
                },
            )
            .expect("client");
            let cfg = e4::E4Config {
                total_requests: *total_requests,
                concurrent_clients: *concurrent_clients,
                upstream_url: args.upstream.clone(),
            };
            (
                "E4",
                Thresholds::e4_upstream_failure(),
                e4::run(client, cfg).await,
            )
        }
        Scenario::E5 {
            total_requests,
            concurrent_clients,
        } => {
            // E5: Retry-After 2s × up to 3 attempts ⇒ ~6 s per query worst
            // case. timeout=15s is a safety margin so the engine doesn't
            // give up before honouring the server's wait.
            let client = build_client(
                &args.upstream,
                ClientOverrides {
                    max_attempts: 3,
                    timeout: Duration::from_secs(15),
                    ..Default::default()
                },
            )
            .expect("client");
            let cfg = e5::E5Config {
                total_requests: *total_requests,
                concurrent_clients: *concurrent_clients,
                upstream_url: args.upstream.clone(),
                retry_after_secs: 2,
            };
            ("E5", Thresholds::e5_rate_limit(), e5::run(client, cfg).await)
        }
        Scenario::E6 {
            unique_domains,
            concurrent_clients,
        } => {
            // E6: shrink the cache to 1 000 entries so eviction is forced on
            // a 50k-domain run, and we can observe the cap holds.
            let client = build_client(
                &args.upstream,
                ClientOverrides {
                    cache_max_entries: Some(1000),
                    ..Default::default()
                },
            )
            .expect("client");
            let cfg = e6::E6Config {
                unique_domains: *unique_domains,
                concurrent_clients: *concurrent_clients,
            };
            ("E6", Thresholds::e6_adversarial(), e6::run(client, cfg).await)
        }
    };

    report(name, &outcome, thresholds, &metrics_handle);
}

fn build_client(
    upstream: &str,
    over: ClientOverrides,
) -> Result<Arc<RdapClient>, Box<dyn std::error::Error>> {
    // Route every TLD through the mock. The engine's bootstrap path is
    // bypassed entirely, so the only network traffic is harness→mock and
    // the measurements aren't polluted by IANA latency or DNS.
    let mut overrides: HashMap<String, String> = HashMap::new();
    for tld in [
        "com", "net", "org", "io", "example", "test", "co.uk", "dev", "info", "biz",
    ] {
        overrides.insert(tld.to_string(), upstream.to_string());
    }

    let cfg = ClientConfig {
        fetcher: FetcherConfig {
            timeout: over.timeout,
            max_attempts: over.max_attempts,
            initial_backoff: Duration::from_millis(50),
            max_backoff: Duration::from_millis(500),
            // Tune concurrency above the harness's burst target so the
            // semaphore isn't the artificial bottleneck. Production
            // operators set this to match their upstream tolerance.
            concurrency_limit: 1024,
            // v0.6.1 — opt out of per-host gating. The Stage E mock is a
            // single origin, so a 16-concurrent-per-origin cap would
            // bottleneck every burst scenario and distort throughput
            // measurements. Production deployments fanning across many
            // TLDs leave this at the default `Some(16)`.
            per_host_concurrency_limit: None,
            // Default trace settings — no per-call sampling. The harness
            // is measuring the un-traced hot path.
            ..Default::default()
        },
        // SSRF guard disabled: the harness drives traffic at a local
        // mock over plain HTTP, which the guard would (correctly)
        // reject in production. Only safe in this controlled context.
        ssrf: SsrfConfig {
            enabled: false,
            ..Default::default()
        },
        bootstrap_url: Some(upstream.to_string()),
        custom_bootstrap_servers: overrides,
        // Disable rate limiting for the harness — the *upstream* mock can
        // still emit 429 in the rate-limit scenarios, which is what we
        // actually want to test.
        rate_limit: None,
        ..Default::default()
    };
    let _ = over.cache_max_entries; // wiring placeholder — see CacheConfig in
                                    // a future revision; current ClientConfig
                                    // doesn't expose `cache_max_entries`. We
                                    // surface the intent via this field so
                                    // E6's overrides are explicit at the
                                    // call site even though the underlying
                                    // cache cap is left at default for now.
    Ok(Arc::new(RdapClient::with_config(cfg)?))
}

async fn wait_until_ready(upstream: &str, dl: Duration) -> bool {
    let started = std::time::Instant::now();
    let url = format!("{}/health", upstream.trim_end_matches('/'));
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(200))
        .build()
        .unwrap();
    while started.elapsed() < dl {
        if client
            .get(&url)
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
        {
            return true;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    false
}

fn spawn_mock(path: &str) -> MockGuard {
    let child = Command::new(path)
        .args(["--bind", "127.0.0.1:18080"])
        .stderr(Stdio::piped())
        .stdout(Stdio::null())
        .spawn()
        .expect("spawn mock-upstream");
    eprintln!("harness: spawned mock-upstream (pid {})", child.id());
    MockGuard { child }
}

struct MockGuard {
    child: Child,
}

impl Drop for MockGuard {
    fn drop(&mut self) {
        // Send SIGTERM, fall back to kill if it doesn't exit promptly.
        #[cfg(unix)]
        {
            use nix::sys::signal::{kill, Signal};
            use nix::unistd::Pid;
            let _ = kill(Pid::from_raw(self.child.id() as i32), Signal::SIGTERM);
        }
        let _ = self.child.wait();
    }
}

fn report(name: &str, outcome: &ScenarioOutcome, thresh: Thresholds, h: &MetricsHandle) {
    let stats = &outcome.stats;
    println!();
    println!("──── Stage E · {name} report ────");
    println!("  total           {}", stats.total());
    println!("  success         {}", stats.success());
    println!("  errors          {}", stats.error());
    println!(
        "  error_rate      {:.4}  (threshold ≤ {:.4})",
        stats.error_rate(),
        thresh.max_error_rate
    );
    println!(
        "  latency p50     {:>8.2} ms  (threshold ≤ {:>8.2} ms)",
        stats.p50_ms(),
        thresh.p50_ms
    );
    println!(
        "  latency p95     {:>8.2} ms  (threshold ≤ {:>8.2} ms)",
        stats.p95_ms(),
        thresh.p95_ms
    );
    println!(
        "  latency p99     {:>8.2} ms  (threshold ≤ {:>8.2} ms)",
        stats.p99_ms(),
        thresh.p99_ms
    );
    println!("  latency max     {:>8.2} ms", stats.max_ms());
    println!("  latency mean    {:>8.2} ms", stats.mean_ms());

    if !outcome.notes.is_empty() {
        println!();
        println!("  scenario-specific:");
        for (k, v) in &outcome.notes {
            println!("    {k:<28}  {v}");
        }
    }

    let mut verdict = validate(stats, thresh);
    for f in &outcome.extra_failures {
        verdict.failures.push(f.clone());
        verdict.passed = false;
    }
    println!();
    if verdict.passed {
        println!("  ✅ {name} PASSED");
    } else {
        println!("  ❌ {name} FAILED");
        for f in &verdict.failures {
            println!("    - {f}");
        }
    }

    println!();
    println!("──── Engine metrics (rdap_*) ────");
    let prom = h.render();
    for line in prom.lines() {
        let interesting = line.starts_with("rdap_requests_total")
            || line.starts_with("rdap_cache_")
            || line.starts_with("rdap_errors_total")
            || line.starts_with("rdap_retry_total")
            || line.starts_with("rdap_circuit_breaker_open_total")
            || line.starts_with("rdap_inflight_requests")
            || line.starts_with("rdap_slow_requests_total ");
        if interesting && !line.starts_with('#') {
            println!("  {line}");
        }
    }

    if !verdict.passed {
        std::process::exit(1);
    }
}
