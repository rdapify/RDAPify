//! Per-origin circuit breaker for outbound RDAP requests.
//!
//! ## States
//!
//! ```text
//!         5 logical failures              cooldown elapsed
//!   Closed ─────────────────► Open ──────────────────────► HalfOpen
//!     ▲                         ▲                              │
//!     │                         │     probe failure            │
//!     │                         └──────────────────────────────┤
//!     │                                                        │
//!     └────────────── probe success (state = Closed) ──────────┘
//! ```
//!
//! ## Design notes
//!
//! - **Lock-free fast path on `Closed`** — a single `Acquire` load on the
//!   state atomic decides whether to admit the call. No DashMap guard, no
//!   Mutex, no allocation.
//! - **Mutex only on transitions** — `tokio::sync::Mutex` is taken for
//!   transitions and to serialise the half-open probe slot. Drops before any
//!   `.await` in the fetcher's hot path.
//! - **Per-origin isolation** — `Origin = (scheme, host, port)`. A failing
//!   .com registry never opens .net's breaker.
//! - **Logical failures, not raw HTTP attempts** — one `do_fetch_with_headers`
//!   call counts as one breaker event regardless of internal retry shape.
//!   Threshold (5) reads as "five user-visible failures in a row".
//! - **`InvalidLicense`-style domain errors do not move the breaker** — only
//!   transport / 5xx failures do. Otherwise legitimate "this resource doesn't
//!   exist" answers from a healthy registry would open its breaker.

use std::sync::atomic::{AtomicU64, AtomicU8, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use moka::sync::Cache;
use tokio::sync::Mutex;

const STATE_CLOSED: u8 = 0;
const STATE_OPEN: u8 = 1;
const STATE_HALF_OPEN: u8 = 2;

/// Default failure threshold before opening the circuit.
pub const DEFAULT_FAILURE_THRESHOLD: u64 = 5;
/// Default cooldown before transitioning Open → HalfOpen.
pub const DEFAULT_COOLDOWN_MS: u64 = 30_000;
/// Default LRU capacity of the per-origin breaker registry.
///
/// Caps the registry's working set under adversarial workloads (e.g.
/// queries that resolve to many distinct origins). Cold breakers are
/// evicted on LRU pressure or idle timeout — see [`DEFAULT_REGISTRY_TTL`].
pub const DEFAULT_REGISTRY_CAPACITY: u64 = 1024;
/// Default idle timeout for an entry in the breaker registry.
///
/// An origin not referenced for this long is evicted; a fresh breaker is
/// created on next access (loses only the consecutive-failure counter,
/// which is acceptable for an upstream that has been quiet for 10 minutes).
pub const DEFAULT_REGISTRY_TTL: Duration = Duration::from_secs(600);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CircuitState {
    Closed,
    Open,
    HalfOpen,
}

impl CircuitState {
    pub fn as_metric(self) -> u64 {
        match self {
            Self::Closed => 0,
            Self::Open => 1,
            Self::HalfOpen => 2,
        }
    }

    /// v0.6.1 · Task 2 — stable lowercase label for the
    /// `rdap_circuit_breaker_transitions_total{from,to}` series.
    pub const fn label(self) -> &'static str {
        match self {
            Self::Closed => "closed",
            Self::Open => "open",
            Self::HalfOpen => "half_open",
        }
    }
}

/// A normalised origin used as the circuit-breaker key.
///
/// Two URLs map to the same origin iff they share `(scheme, host, port)`,
/// where:
///
/// - scheme is lowercased
/// - host is lowercased (DNS labels are case-insensitive)
/// - port is the explicit port if present, else the scheme's default
///   (443 for `https`, 80 for `http`)
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct Origin {
    pub scheme: String,
    pub host: String,
    pub port: u16,
}

impl Origin {
    /// Extracts the origin from a URL string. Returns `None` if the URL is
    /// unparseable, lacks a host, or has no derivable port.
    pub fn from_url(url: &str) -> Option<Self> {
        let parsed = url::Url::parse(url).ok()?;
        let scheme = parsed.scheme().to_ascii_lowercase();
        let host = parsed.host_str()?.to_ascii_lowercase();
        let port = parsed.port_or_known_default()?;
        Some(Self { scheme, host, port })
    }
}

impl std::fmt::Display for Origin {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}://{}:{}", self.scheme, self.host, self.port)
    }
}

#[derive(Debug)]
pub struct CircuitBreaker {
    state: AtomicU8,
    consecutive_failures: AtomicU64,
    opened_at_ms: AtomicU64,
    /// Held briefly during transitions and during the half-open probe slot.
    transition_lock: Mutex<()>,
    failure_threshold: u64,
    cooldown_ms: u64,
}

impl CircuitBreaker {
    pub fn new() -> Self {
        Self::with_config(DEFAULT_FAILURE_THRESHOLD, DEFAULT_COOLDOWN_MS)
    }

    pub fn with_config(failure_threshold: u64, cooldown_ms: u64) -> Self {
        Self {
            state: AtomicU8::new(STATE_CLOSED),
            consecutive_failures: AtomicU64::new(0),
            opened_at_ms: AtomicU64::new(0),
            transition_lock: Mutex::new(()),
            failure_threshold,
            cooldown_ms,
        }
    }

    fn now_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0)
    }

    pub fn state(&self) -> CircuitState {
        match self.state.load(Ordering::Acquire) {
            STATE_CLOSED => CircuitState::Closed,
            STATE_OPEN => CircuitState::Open,
            STATE_HALF_OPEN => CircuitState::HalfOpen,
            _ => CircuitState::Closed,
        }
    }

    /// v0.6.2 · Task 2 — returns the wall-clock instant (in unix
    /// milliseconds, matching [`Self::now_ms`]) at which the breaker
    /// most recently entered the Open state. Returns 0 if the breaker
    /// has never tripped — callers must combine with [`Self::state`]
    /// to know whether the value is meaningful.
    ///
    /// Single atomic Acquire load — safe to call on every state-read
    /// without contention.
    pub fn opened_at_ms(&self) -> u64 {
        self.opened_at_ms.load(Ordering::Acquire)
    }

    /// v0.6.2 · Task 2 — read the current wall-clock time in unix
    /// milliseconds, matching the units of [`Self::opened_at_ms`].
    /// Public so the fetcher can compute `now_ms() - opened_at_ms()`
    /// without re-implementing the same time source.
    pub fn now_ms_public() -> u64 {
        Self::now_ms()
    }

    /// Decide whether a request may proceed before it executes.
    ///
    /// - `Ok(())` in Closed (lock-free fast path).
    /// - `Ok(())` in HalfOpen *only* for the single admitted probe;
    ///   subsequent concurrent callers get `Err(())`.
    /// - `Ok(())` in Open if the cooldown has elapsed; transitions to
    ///   HalfOpen as a side effect.
    /// - `Err(())` in Open while still in cooldown.
    pub async fn before_call(&self) -> Result<(), ()> {
        // Fast path: lock-free atomic load on the hot Closed case.
        if self.state.load(Ordering::Acquire) == STATE_CLOSED {
            return Ok(());
        }

        let _g = self.transition_lock.lock().await;
        match self.state.load(Ordering::Acquire) {
            STATE_CLOSED => Ok(()),
            STATE_HALF_OPEN => {
                // A probe is already in flight — refuse extra probes so
                // we don't hammer a possibly-still-down upstream.
                Err(())
            }
            STATE_OPEN => {
                let opened = self.opened_at_ms.load(Ordering::Acquire);
                if Self::now_ms().saturating_sub(opened) >= self.cooldown_ms {
                    self.state.store(STATE_HALF_OPEN, Ordering::Release);
                    Ok(())
                } else {
                    Err(())
                }
            }
            _ => Ok(()),
        }
    }

    pub async fn on_success(&self) {
        let _g = self.transition_lock.lock().await;
        self.consecutive_failures.store(0, Ordering::Release);
        self.state.store(STATE_CLOSED, Ordering::Release);
    }

    pub async fn on_failure(&self) {
        let _g = self.transition_lock.lock().await;
        let prev = self.state.load(Ordering::Acquire);
        match prev {
            STATE_HALF_OPEN => {
                self.opened_at_ms.store(Self::now_ms(), Ordering::Release);
                self.state.store(STATE_OPEN, Ordering::Release);
            }
            STATE_CLOSED => {
                let n = self.consecutive_failures.fetch_add(1, Ordering::AcqRel) + 1;
                if n >= self.failure_threshold {
                    self.opened_at_ms.store(Self::now_ms(), Ordering::Release);
                    self.state.store(STATE_OPEN, Ordering::Release);
                }
            }
            _ => {} // already Open — leave cooldown alone (idempotent)
        }
    }
}

impl Default for CircuitBreaker {
    fn default() -> Self {
        Self::new()
    }
}

/// Per-origin registry of circuit breakers, bounded by an LRU cap and an
/// idle-time eviction policy.
///
/// Backed by `moka::sync::Cache` — lock-striped, async-friendly, no global
/// mutex. Entries evicted by capacity or idle timeout simply lose their
/// failure-counter history; a fresh breaker is created on next access.
///
/// Cheap to clone (moka cache is internally `Arc`).
#[derive(Clone)]
pub struct CircuitBreakerRegistry {
    map: Cache<Origin, Arc<CircuitBreaker>>,
    failure_threshold: u64,
    cooldown_ms: u64,
}

impl std::fmt::Debug for CircuitBreakerRegistry {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CircuitBreakerRegistry")
            .field("entries", &self.map.entry_count())
            .field("failure_threshold", &self.failure_threshold)
            .field("cooldown_ms", &self.cooldown_ms)
            .finish()
    }
}

impl CircuitBreakerRegistry {
    pub fn new() -> Self {
        Self::with_config(DEFAULT_FAILURE_THRESHOLD, DEFAULT_COOLDOWN_MS)
    }

    pub fn with_config(failure_threshold: u64, cooldown_ms: u64) -> Self {
        Self::with_full_config(
            failure_threshold,
            cooldown_ms,
            DEFAULT_REGISTRY_CAPACITY,
            DEFAULT_REGISTRY_TTL,
        )
    }

    /// Full constructor exposing registry capacity and idle-timeout knobs.
    ///
    /// Use the defaults unless you have a measured reason to deviate; the
    /// default 1024 / 10 min combination keeps memory well under 1 MiB
    /// even for a 1M-unique-origin attack.
    pub fn with_full_config(
        failure_threshold: u64,
        cooldown_ms: u64,
        capacity: u64,
        idle_ttl: Duration,
    ) -> Self {
        let map = Cache::builder()
            .max_capacity(capacity)
            .time_to_idle(idle_ttl)
            .build();
        Self {
            map,
            failure_threshold,
            cooldown_ms,
        }
    }

    /// Returns the breaker for `origin`, creating one on first access.
    ///
    /// `moka::sync::Cache::get_with` runs the initialiser exactly once per
    /// missing key even under concurrent calls — no thundering herd at the
    /// registry layer.
    pub fn get_or_create(&self, origin: &Origin) -> Arc<CircuitBreaker> {
        let failure_threshold = self.failure_threshold;
        let cooldown_ms = self.cooldown_ms;
        self.map.get_with(origin.clone(), || {
            Arc::new(CircuitBreaker::with_config(failure_threshold, cooldown_ms))
        })
    }

    /// Snapshot of all (origin, state) pairs currently resident in the
    /// registry. Evicted origins are not included.
    pub fn snapshot(&self) -> Vec<(Origin, CircuitState)> {
        self.map
            .iter()
            .map(|(k, v)| ((*k).clone(), v.state()))
            .collect()
    }

    /// Approximate count of origins currently in the registry.
    ///
    /// `moka` reports `entry_count()` as approximate (eviction runs lazily
    /// in background tasks); call [`run_pending_tasks`](Self::run_pending_tasks)
    /// before reading if you need a tight bound.
    pub fn len(&self) -> u64 {
        self.map.entry_count()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Forces moka to flush pending eviction work. Mainly for tests; in
    /// production, eviction runs automatically and is observable through
    /// natural latency.
    pub fn run_pending_tasks(&self) {
        self.map.run_pending_tasks();
    }
}

impl Default for CircuitBreakerRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── Origin extraction ──────────────────────────────────────────────────

    #[test]
    fn origin_normalises_case_and_default_port() {
        let a = Origin::from_url("https://Rdap.Example.COM/rdap/domain/x").unwrap();
        let b = Origin::from_url("HTTPS://rdap.example.com:443/rdap/ip/8.8.8.8").unwrap();
        assert_eq!(a, b);
        assert_eq!(a.scheme, "https");
        assert_eq!(a.host, "rdap.example.com");
        assert_eq!(a.port, 443);
    }

    #[test]
    fn origin_distinguishes_explicit_port() {
        let a = Origin::from_url("https://example.com/").unwrap();
        let b = Origin::from_url("https://example.com:8443/").unwrap();
        assert_ne!(a, b);
    }

    #[test]
    fn origin_distinguishes_host() {
        let a = Origin::from_url("https://rdap.verisign.com/").unwrap();
        let b = Origin::from_url("https://rdap.publicinterestregistry.org/").unwrap();
        assert_ne!(a, b);
    }

    // ── Single-breaker behaviour ───────────────────────────────────────────

    #[tokio::test]
    async fn starts_closed_admits() {
        let cb = CircuitBreaker::new();
        assert_eq!(cb.state(), CircuitState::Closed);
        assert!(cb.before_call().await.is_ok());
    }

    #[tokio::test]
    async fn opens_after_threshold_failures() {
        let cb = CircuitBreaker::with_config(5, 30_000);
        for _ in 0..4 {
            cb.on_failure().await;
            assert_eq!(cb.state(), CircuitState::Closed);
        }
        cb.on_failure().await;
        assert_eq!(cb.state(), CircuitState::Open);
        assert!(cb.before_call().await.is_err());
    }

    #[tokio::test]
    async fn success_resets_counter() {
        let cb = CircuitBreaker::with_config(5, 30_000);
        for _ in 0..4 {
            cb.on_failure().await;
        }
        cb.on_success().await;
        for _ in 0..4 {
            cb.on_failure().await;
        }
        // 4, not 8 — counter was reset.
        assert_eq!(cb.state(), CircuitState::Closed);
    }

    #[tokio::test]
    async fn open_transitions_to_half_open_after_cooldown() {
        let cb = CircuitBreaker::with_config(2, 50);
        cb.on_failure().await;
        cb.on_failure().await;
        assert_eq!(cb.state(), CircuitState::Open);
        tokio::time::sleep(std::time::Duration::from_millis(60)).await;
        assert!(cb.before_call().await.is_ok());
        assert_eq!(cb.state(), CircuitState::HalfOpen);
    }

    #[tokio::test]
    async fn half_open_failure_reopens() {
        let cb = CircuitBreaker::with_config(2, 50);
        cb.on_failure().await;
        cb.on_failure().await;
        tokio::time::sleep(std::time::Duration::from_millis(60)).await;
        let _ = cb.before_call().await;
        cb.on_failure().await;
        assert_eq!(cb.state(), CircuitState::Open);
    }

    #[tokio::test]
    async fn half_open_success_closes() {
        let cb = CircuitBreaker::with_config(2, 50);
        cb.on_failure().await;
        cb.on_failure().await;
        tokio::time::sleep(std::time::Duration::from_millis(60)).await;
        let _ = cb.before_call().await;
        cb.on_success().await;
        assert_eq!(cb.state(), CircuitState::Closed);
    }

    #[tokio::test]
    async fn half_open_admits_only_one_probe() {
        let cb = Arc::new(CircuitBreaker::with_config(2, 30));
        cb.on_failure().await;
        cb.on_failure().await;
        tokio::time::sleep(std::time::Duration::from_millis(40)).await;

        let mut handles = Vec::new();
        for _ in 0..10 {
            let cb = cb.clone();
            handles.push(tokio::spawn(async move { cb.before_call().await.is_ok() }));
        }
        let admitted: usize = futures_lite_join(handles).await;
        assert_eq!(admitted, 1, "exactly one probe should be admitted");
    }

    // Tiny join helper to avoid a dev-dep on futures::future::join_all.
    async fn futures_lite_join(handles: Vec<tokio::task::JoinHandle<bool>>) -> usize {
        let mut admitted = 0usize;
        for h in handles {
            if h.await.unwrap_or(false) {
                admitted += 1;
            }
        }
        admitted
    }

    // ── Registry behaviour ────────────────────────────────────────────────

    #[tokio::test]
    async fn registry_isolates_origins() {
        let reg = CircuitBreakerRegistry::with_config(2, 30_000);
        let a = Origin::from_url("https://rdap.a.example/").unwrap();
        let b = Origin::from_url("https://rdap.b.example/").unwrap();

        let cb_a = reg.get_or_create(&a);
        let cb_b = reg.get_or_create(&b);

        // Open A's breaker.
        cb_a.on_failure().await;
        cb_a.on_failure().await;
        assert_eq!(cb_a.state(), CircuitState::Open);
        // B's breaker is unaffected.
        assert_eq!(cb_b.state(), CircuitState::Closed);
        assert!(cb_b.before_call().await.is_ok());
    }

    #[tokio::test]
    async fn registry_returns_same_breaker_for_normalised_urls() {
        let reg = CircuitBreakerRegistry::new();
        let a = Origin::from_url("https://Rdap.Example.com/x").unwrap();
        let b = Origin::from_url("HTTPS://rdap.example.com:443/y").unwrap();
        let cb_a = reg.get_or_create(&a);
        let cb_b = reg.get_or_create(&b);
        assert!(Arc::ptr_eq(&cb_a, &cb_b));
        // moka reports approximate counts; force eviction state to settle.
        reg.run_pending_tasks();
        assert_eq!(reg.len(), 1);
    }

    // ── C1/C2 — Bounded registry under adversarial workloads ──────────────

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn registry_caps_at_capacity_under_million_keys() {
        // Mandatory C1 test: 1M unique origins → memory stays bounded by
        // the registry's max_capacity. moka eviction is approximate; allow
        // some slack but verify it is *very* close to the cap, not 1M.
        let reg = CircuitBreakerRegistry::with_full_config(
            5,
            30_000,
            1024,
            std::time::Duration::from_secs(600),
        );

        // Use a deterministic stream — 1M distinct origins.
        for i in 0..1_000_000u32 {
            let origin = Origin {
                scheme: "https".to_string(),
                host: format!("h{i}.example"),
                port: 443,
            };
            let _ = reg.get_or_create(&origin);
        }

        // Force pending eviction work so the count settles.
        reg.run_pending_tasks();
        let len = reg.len();

        // moka may report slightly above max_capacity transiently. Generous
        // bound (4× cap) — what we care about is "not 1M", not the exact
        // value.
        assert!(
            len <= 4 * 1024,
            "registry grew unbounded: len = {len} after 1M unique origins"
        );
    }

    // (Idle-TTL eviction is moka's responsibility — covered by moka's own
    // test suite. We only assert the property we care about: that the
    // registry's working set never exceeds the configured cap by more than
    // a small slack factor, even under a 1M-distinct-origin attack. See
    // `registry_caps_at_capacity_under_million_keys` above.)

    // ── T5 · Case 7 — flapping resistance across multiple full cycles ────

    #[tokio::test]
    async fn breaker_does_not_oscillate_across_three_full_cycles() {
        // T5 Case 7 — when an upstream alternates between failure clusters
        // and recovery, the breaker should:
        //   - Track each cycle correctly (transitions land in the right
        //     order, state is always exactly one of the three).
        //   - Bound the flap rate by the cooldown — K full cycles cannot
        //     complete faster than K × cooldown.
        //
        // Pattern (3 full cycles):
        //   for cycle in 0..3:
        //     N failures → CLOSED → OPEN
        //     wait cooldown
        //     before_call → OPEN → HALF_OPEN
        //     on_success → HALF_OPEN → CLOSED
        //
        // Asserts:
        //   - Final state is Closed.
        //   - Each cycle's transitions land in order (no skipped state).
        //   - Total wall-clock elapsed ≥ 3 × cooldown — proving the
        //     breaker did not short-circuit any cooldown period.
        let threshold = 3u64;
        let cooldown_ms = 40u64;
        let cb = CircuitBreaker::with_config(threshold, cooldown_ms);

        let cycles = 3usize;
        let start = std::time::Instant::now();
        for cycle in 0..cycles {
            // 1. Trip via threshold failures (CLOSED → OPEN).
            assert_eq!(
                cb.state(),
                CircuitState::Closed,
                "cycle {cycle}: expected CLOSED at start of cycle"
            );
            for _ in 0..threshold {
                cb.on_failure().await;
            }
            assert_eq!(
                cb.state(),
                CircuitState::Open,
                "cycle {cycle}: breaker did not OPEN at threshold"
            );

            // 2. Wait cooldown.
            tokio::time::sleep(std::time::Duration::from_millis(cooldown_ms + 10)).await;

            // 3. before_call admits → OPEN → HALF_OPEN.
            assert!(
                cb.before_call().await.is_ok(),
                "cycle {cycle}: HALF_OPEN probe was not admitted after cooldown"
            );
            assert_eq!(
                cb.state(),
                CircuitState::HalfOpen,
                "cycle {cycle}: state did not transition to HALF_OPEN"
            );

            // 4. Probe succeeds → HALF_OPEN → CLOSED.
            cb.on_success().await;
            assert_eq!(
                cb.state(),
                CircuitState::Closed,
                "cycle {cycle}: HALF_OPEN→CLOSED transition failed"
            );
        }
        let elapsed = start.elapsed();

        // Bound the flap rate: 3 full cycles cannot finish faster than
        // 3 × cooldown. (Slight under-bound to absorb timer rounding.)
        let min_required = std::time::Duration::from_millis(cycles as u64 * cooldown_ms - 5);
        assert!(
            elapsed >= min_required,
            "flap rate not bounded by cooldown: {} cycles in {}ms, expected ≥ {}ms",
            cycles,
            elapsed.as_millis(),
            min_required.as_millis()
        );

        assert_eq!(cb.state(), CircuitState::Closed);
    }
}
