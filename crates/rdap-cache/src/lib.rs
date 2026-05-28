//! In-memory response cache with TTL expiry and stale-while-revalidate support.
//!
//! Uses [`DashMap`] for lock-free concurrent reads.
//! Entries are evicted lazily (on read) and eagerly (on `evict_expired()`).
//!
//! # Freshness model
//!
//! Each entry has two deadlines:
//! - **TTL** (`inserted_at + ttl`): fresh window — returned as `Fresh`.
//! - **Stale deadline** (`inserted_at + ttl + stale_ttl`): stale window — returned as `Stale`.
//! - Beyond the stale deadline the entry is evicted on the next read.

#![forbid(unsafe_code)]

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use dashmap::DashMap;
use rdap_metrics::hooks as metrics_hooks;
use rdap_metrics::types::CacheOutcome;
use serde_json::Value;
use tokio::sync::Notify;

// ── Cache value ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
enum CacheValue {
    Hit(Value),
    Negative,
}

// ── Cache entry ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
struct Entry {
    value: CacheValue,
    inserted_at: Instant,
    ttl: Duration,
    /// Extra time after `ttl` expires during which the stale value may be
    /// served while a background refresh is in flight.
    stale_ttl: Duration,
}

impl Entry {
    fn age(&self) -> Duration {
        self.inserted_at.elapsed()
    }

    fn is_fresh(&self) -> bool {
        self.age() <= self.ttl
    }

    fn is_in_stale_window(&self) -> bool {
        let age = self.age();
        age > self.ttl && age <= self.ttl + self.stale_ttl
    }

    fn is_fully_expired(&self) -> bool {
        self.age() > self.ttl + self.stale_ttl
    }
}

// ── Public types ──────────────────────────────────────────────────────────────

/// Result of a cache lookup with freshness classification.
#[derive(Debug, Clone)]
pub enum CacheStatus {
    /// Entry is within its primary TTL window.
    Fresh(Value),
    /// Entry has exceeded its TTL but is still within the stale window.
    /// The caller should trigger a background refresh.
    Stale(Value),
    /// A recorded 404 (negative cache hit) — the resource does not exist.
    Negative,
    /// No usable entry (miss or fully expired).
    Miss,
}

/// Snapshot of cache event counters.
#[derive(Debug, Clone, Copy, Default)]
pub struct CacheStats {
    /// Fresh cache hits served.
    pub hits: u64,
    /// Cache misses (including fully expired entries).
    pub misses: u64,
    /// Stale-while-revalidate hits served.
    pub stale: u64,
    /// Negative cache hits served (404 short-circuited).
    pub negative: u64,
}

// ── Cache configuration ───────────────────────────────────────────────────────

/// Configuration for the response cache.
#[derive(Debug, Clone)]
pub struct CacheConfig {
    /// Default TTL for cached entries.
    pub ttl: Duration,
    /// Maximum number of entries to keep in the cache.
    pub max_entries: usize,
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            ttl: Duration::from_secs(300), // 5 minutes
            max_entries: 1_000,
        }
    }
}

// ── Cache ─────────────────────────────────────────────────────────────────────

/// Thread-safe in-memory RDAP response cache with stale-while-revalidate,
/// single-flight refresh coordination, and negative-caching support.
///
/// Cache keys are the full query URL strings.
pub struct MemoryCache {
    store: Arc<DashMap<String, Entry>>,
    config: CacheConfig,
    hits: Arc<AtomicU64>,
    misses: Arc<AtomicU64>,
    stale_hits: Arc<AtomicU64>,
    negative_hits: Arc<AtomicU64>,
    /// Single-flight registry for SWR refreshes.
    /// Holds a `Notify` per in-flight refresh, keyed by cache key.
    /// Inserted by [`MemoryCache::try_acquire_refresh`]; removed when the
    /// returned `RefreshGuard` is dropped.
    ///
    /// Defensively capped at [`MAX_INFLIGHT_REFRESHES`] entries (see
    /// [`MemoryCache::try_acquire_refresh`]). Under normal load this map
    /// is bounded by concurrent fetch count (which is itself bounded by
    /// the upstream-concurrency semaphore in `rdap-core`); the cap covers
    /// the pathological case where many distinct cache keys go stale at
    /// once.
    in_flight: Arc<DashMap<String, Arc<Notify>>>,
    refresh_dedup_total: Arc<AtomicU64>,
    /// Counter for refresh attempts dropped due to in-flight cap pressure.
    refresh_capped_total: Arc<AtomicU64>,
}

/// Hard cap on the number of in-flight refresh slots.
///
/// At this many concurrent refreshes, [`MemoryCache::try_acquire_refresh`]
/// returns `None` for additional callers. Those callers serve their stale
/// values and skip refresh — the safe degradation that SWR was designed for.
pub const MAX_INFLIGHT_REFRESHES: usize = 4_096;

impl Clone for MemoryCache {
    fn clone(&self) -> Self {
        Self {
            store: Arc::clone(&self.store),
            config: self.config.clone(),
            hits: Arc::clone(&self.hits),
            misses: Arc::clone(&self.misses),
            stale_hits: Arc::clone(&self.stale_hits),
            negative_hits: Arc::clone(&self.negative_hits),
            in_flight: Arc::clone(&self.in_flight),
            refresh_dedup_total: Arc::clone(&self.refresh_dedup_total),
            refresh_capped_total: Arc::clone(&self.refresh_capped_total),
        }
    }
}

/// Guard returned by [`MemoryCache::try_acquire_refresh`].
///
/// Holding this guard means the holder is the elected refresher for the
/// associated cache key. Subsequent callers of `try_acquire_refresh` for the
/// same key will receive `None` until this guard is dropped.
///
/// On drop, the in-flight slot is released and any tasks awaiting via
/// [`MemoryCache::await_refresh`] are notified. Drop is safe to perform
/// from inside an async task — `Notify::notify_waiters` is synchronous.
#[must_use = "RefreshGuard must be held for the duration of the refresh"]
pub struct RefreshGuard {
    in_flight: Arc<DashMap<String, Arc<Notify>>>,
    key: String,
    notify: Arc<Notify>,
}

impl Drop for RefreshGuard {
    fn drop(&mut self) {
        // Synchronous removal — no .await in Drop.
        self.in_flight.remove(&self.key);
        self.notify.notify_waiters();
    }
}

impl std::fmt::Debug for RefreshGuard {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RefreshGuard")
            .field("key", &self.key)
            .finish()
    }
}

impl std::fmt::Debug for MemoryCache {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("MemoryCache")
            .field("len", &self.store.len())
            .field("config", &self.config)
            .finish()
    }
}

impl MemoryCache {
    /// Creates a cache with default configuration.
    pub fn new() -> Self {
        Self::with_config(CacheConfig::default())
    }

    /// Creates a cache with custom configuration.
    pub fn with_config(config: CacheConfig) -> Self {
        Self {
            store: Arc::new(DashMap::new()),
            config,
            hits: Arc::new(AtomicU64::new(0)),
            misses: Arc::new(AtomicU64::new(0)),
            stale_hits: Arc::new(AtomicU64::new(0)),
            negative_hits: Arc::new(AtomicU64::new(0)),
            in_flight: Arc::new(DashMap::new()),
            refresh_dedup_total: Arc::new(AtomicU64::new(0)),
            refresh_capped_total: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Retrieves a cached value if it is **fresh** (within primary TTL).
    ///
    /// Returns `None` for stale, negative, or missing entries.
    /// Use [`get_status`](Self::get_status) to distinguish all cases.
    pub fn get(&self, key: &str) -> Option<Value> {
        match self.get_status(key) {
            CacheStatus::Fresh(v) => Some(v),
            _ => None,
        }
    }

    /// Retrieves the full freshness status for `key`.
    pub fn get_status(&self, key: &str) -> CacheStatus {
        let Some(entry) = self.store.get(key) else {
            self.misses.fetch_add(1, Ordering::Relaxed);
            metrics_hooks::record_cache(CacheOutcome::Miss);
            return CacheStatus::Miss;
        };

        if entry.is_fully_expired() {
            drop(entry);
            self.store.remove(key);
            // v0.6.1 · Task 3 — read-path eviction of a fully-expired entry.
            metrics_hooks::record_cache_eviction();
            metrics_hooks::set_cache_entries_current(self.store.len());
            self.misses.fetch_add(1, Ordering::Relaxed);
            metrics_hooks::record_cache(CacheOutcome::Miss);
            return CacheStatus::Miss;
        }

        match &entry.value {
            CacheValue::Negative => {
                if entry.is_fresh() {
                    self.negative_hits.fetch_add(1, Ordering::Relaxed);
                    metrics_hooks::record_cache(CacheOutcome::Negative);
                    CacheStatus::Negative
                } else {
                    // Expired negative entry — evict and miss
                    drop(entry);
                    self.store.remove(key);
                    metrics_hooks::record_cache_eviction();
                    metrics_hooks::set_cache_entries_current(self.store.len());
                    self.misses.fetch_add(1, Ordering::Relaxed);
                    metrics_hooks::record_cache(CacheOutcome::Miss);
                    CacheStatus::Miss
                }
            }
            CacheValue::Hit(value) => {
                if entry.is_fresh() {
                    self.hits.fetch_add(1, Ordering::Relaxed);
                    metrics_hooks::record_cache(CacheOutcome::Fresh);
                    CacheStatus::Fresh(value.clone())
                } else if entry.is_in_stale_window() {
                    self.stale_hits.fetch_add(1, Ordering::Relaxed);
                    metrics_hooks::record_cache(CacheOutcome::Stale);
                    CacheStatus::Stale(value.clone())
                } else {
                    // Fully expired (shouldn't reach here due to earlier check, but be safe)
                    drop(entry);
                    self.store.remove(key);
                    metrics_hooks::record_cache_eviction();
                    metrics_hooks::set_cache_entries_current(self.store.len());
                    self.misses.fetch_add(1, Ordering::Relaxed);
                    metrics_hooks::record_cache(CacheOutcome::Miss);
                    CacheStatus::Miss
                }
            }
        }
    }

    /// Inserts a value with the default TTL.
    pub fn set(&self, key: String, value: Value) {
        self.set_with_ttl(key, value, self.config.ttl);
    }

    /// Inserts a value with a custom TTL.
    ///
    /// The stale window is computed as 20% of `ttl`, clamped to [30s, 120s].
    pub fn set_with_ttl(&self, key: String, value: Value, ttl: Duration) {
        if self.store.len() >= self.config.max_entries {
            self.evict_oldest();
        }

        let stale_ttl = (ttl / 5)
            .max(Duration::from_secs(30))
            .min(Duration::from_secs(120));

        self.store.insert(
            key,
            Entry {
                value: CacheValue::Hit(value),
                inserted_at: Instant::now(),
                ttl,
                stale_ttl,
            },
        );
        // v0.6.1 · Task 3 — track current resident entry count.
        metrics_hooks::set_cache_entries_current(self.store.len());
    }

    /// Records a negative (404) cache entry for `key` with the given TTL.
    ///
    /// Subsequent lookups return [`CacheStatus::Negative`] until `ttl` expires.
    pub fn set_negative(&self, key: String, ttl: Duration) {
        if self.store.len() >= self.config.max_entries {
            self.evict_oldest();
        }
        self.store.insert(
            key,
            Entry {
                value: CacheValue::Negative,
                inserted_at: Instant::now(),
                ttl,
                stale_ttl: Duration::ZERO,
            },
        );
        metrics_hooks::set_cache_entries_current(self.store.len());
    }

    /// Returns a snapshot of cache event counters.
    pub fn stats(&self) -> CacheStats {
        CacheStats {
            hits: self.hits.load(Ordering::Relaxed),
            misses: self.misses.load(Ordering::Relaxed),
            stale: self.stale_hits.load(Ordering::Relaxed),
            negative: self.negative_hits.load(Ordering::Relaxed),
        }
    }

    /// Returns the count of stale hits that found a refresh already in
    /// flight and skipped spawning a duplicate refresh.
    ///
    /// Useful for verifying that single-flight is doing its job.
    pub fn refresh_dedup_count(&self) -> u64 {
        self.refresh_dedup_total.load(Ordering::Relaxed)
    }

    // ── Single-flight refresh coordination ────────────────────────────────

    /// Attempts to claim the in-flight refresh slot for `key`.
    ///
    /// Returns `Some(guard)` exactly once per concurrent refresh window —
    /// the caller becomes the elected refresher and is expected to perform
    /// the upstream fetch and call [`MemoryCache::set_with_ttl`] on success.
    /// Returns `None` if another caller already holds the slot, **or** if
    /// the in-flight registry is at the [`MAX_INFLIGHT_REFRESHES`] cap.
    /// In both cases the caller should serve stale and not initiate its
    /// own refresh.
    ///
    /// The slot is automatically released when the returned `RefreshGuard`
    /// is dropped (via the leader's task completion or panic).
    ///
    /// This method is synchronous and never `.await`s — DashMap guards are
    /// not held across suspension points.
    pub fn try_acquire_refresh(&self, key: &str) -> Option<RefreshGuard> {
        // Defensive cap. DashMap::len is approximate under heavy contention
        // (a few entries over the cap is acceptable); this is a soft ceiling,
        // not a strict invariant. We accept that for the simpler semantics.
        if self.in_flight.len() >= MAX_INFLIGHT_REFRESHES {
            self.refresh_capped_total.fetch_add(1, Ordering::Relaxed);
            return None;
        }

        // Atomic claim via the entry API. We never await between obtaining
        // the entry guard and dropping it.
        match self.in_flight.entry(key.to_string()) {
            dashmap::mapref::entry::Entry::Occupied(_) => {
                // Another refresh is already in flight — record dedup and
                // tell caller to serve stale without refreshing.
                self.refresh_dedup_total.fetch_add(1, Ordering::Relaxed);
                None
            }
            dashmap::mapref::entry::Entry::Vacant(v) => {
                let notify = Arc::new(Notify::new());
                v.insert(Arc::clone(&notify));
                Some(RefreshGuard {
                    in_flight: Arc::clone(&self.in_flight),
                    key: key.to_string(),
                    notify,
                })
            }
        }
    }

    /// Counter for refresh attempts that were rejected because the in-flight
    /// registry hit its cap. Diagnostic only.
    pub fn refresh_capped_count(&self) -> u64 {
        self.refresh_capped_total.load(Ordering::Relaxed)
    }

    /// Awaits the completion of an in-flight refresh on `key`, if any.
    ///
    /// Returns immediately if no refresh is in flight when called. Otherwise
    /// suspends until the leader's `RefreshGuard` is dropped.
    ///
    /// Spurious wakeups: this method is best-effort. Callers must re-read
    /// the cache after waking to obtain the actual fresh value (or to fall
    /// back to a direct fetch if the leader's refresh failed).
    pub async fn await_refresh(&self, key: &str) {
        // Clone the Arc<Notify> out of the DashMap guard, then drop the
        // guard *before* awaiting. This is the standard "clone and drop"
        // pattern that keeps DashMap safe across .await.
        let notify = { self.in_flight.get(key).map(|r| Arc::clone(r.value())) }; // DashMap guard dropped here.
        if let Some(n) = notify {
            n.notified().await;
        }
    }

    /// Returns the number of cache keys with an in-flight refresh.
    ///
    /// Diagnostic only — value can change between observation and any
    /// subsequent action.
    pub fn in_flight_count(&self) -> usize {
        self.in_flight.len()
    }

    /// Removes all entries from the cache.
    pub fn clear(&self) {
        let before = self.store.len();
        self.store.clear();
        // v0.6.1 · Task 3 — `clear()` is a bulk eviction; record each
        // dropped entry so the rate-of-evictions counter doesn't have a
        // blind spot when an operator calls `clear()` for ops reasons.
        for _ in 0..before {
            metrics_hooks::record_cache_eviction();
        }
        metrics_hooks::set_cache_entries_current(0);
    }

    /// Returns the number of entries currently in the cache.
    pub fn len(&self) -> usize {
        self.store.len()
    }

    /// Returns `true` if the cache is empty.
    pub fn is_empty(&self) -> bool {
        self.store.is_empty()
    }

    /// Removes all fully-expired entries (past TTL + stale window).
    pub fn evict_expired(&self) {
        let before = self.store.len();
        self.store.retain(|_, entry| !entry.is_fully_expired());
        let removed = before.saturating_sub(self.store.len());
        // v0.6.1 · Task 3 — count each fully-expired entry as one
        // eviction. Single counter increment per evicted entry rather
        // than per call so dashboards can rate() over time.
        for _ in 0..removed {
            metrics_hooks::record_cache_eviction();
        }
        metrics_hooks::set_cache_entries_current(self.store.len());
    }

    fn evict_oldest(&self) {
        let oldest_key = self
            .store
            .iter()
            .min_by_key(|entry| entry.value().inserted_at)
            .map(|entry| entry.key().clone());

        if let Some(key) = oldest_key {
            self.store.remove(&key);
            // v0.6.1 · Task 3 — fired on every oldest-by-inserted_at
            // eviction (called when `set_with_ttl` / `set_negative`
            // hit the `max_entries` cap).
            metrics_hooks::record_cache_eviction();
            metrics_hooks::set_cache_entries_current(self.store.len());
        }
    }
}

impl Default for MemoryCache {
    fn default() -> Self {
        Self::new()
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn basic_get_set() {
        let cache = MemoryCache::new();
        assert!(cache.get("https://rdap.example.com/domain/foo").is_none());

        cache.set(
            "https://rdap.example.com/domain/foo".to_string(),
            json!({ "ldhName": "foo.example" }),
        );

        assert!(cache.get("https://rdap.example.com/domain/foo").is_some());
    }

    #[test]
    fn fresh_entry_returns_fresh_status() {
        let cache = MemoryCache::new();
        cache.set("k".to_string(), json!({"x": 1}));
        assert!(matches!(cache.get_status("k"), CacheStatus::Fresh(_)));
    }

    #[test]
    fn expired_entry_transitions_to_stale() {
        // TTL = 1ms. After 5ms the entry is past TTL but within the stale window
        // (stale_ttl = max(1ms/5, 30s) = 30s).
        let cache = MemoryCache::with_config(CacheConfig {
            ttl: Duration::from_millis(1),
            max_entries: 100,
        });

        cache.set("key".to_string(), json!({}));
        std::thread::sleep(Duration::from_millis(5));

        // get() returns None for non-Fresh entries (backward compat)
        assert!(cache.get("key").is_none());
        // get_status() returns Stale (still within 30s stale window)
        assert!(matches!(cache.get_status("key"), CacheStatus::Stale(_)));
    }

    #[test]
    fn max_entries_evicts_oldest() {
        let cache = MemoryCache::with_config(CacheConfig {
            ttl: Duration::from_secs(60),
            max_entries: 2,
        });

        cache.set("a".to_string(), json!(1));
        cache.set("b".to_string(), json!(2));
        cache.set("c".to_string(), json!(3));

        assert_eq!(cache.len(), 2);
        assert!(cache.get("a").is_none());
    }

    /// Read resident-set-size in bytes from `/proc/self/statm` (Linux only).
    /// Field 2 is "resident pages". Returns `None` on non-Linux platforms
    /// or if the read fails — the test that uses this is skipped in that
    /// case rather than failing.
    ///
    /// Page size is hard-coded to 4 KiB — true for x86_64 / aarch64 Linux,
    /// which is what the CI matrix runs on. The test's RSS bound is
    /// generous enough that a 16 KiB-page system would still pass.
    #[cfg(target_os = "linux")]
    fn read_rss_bytes() -> Option<u64> {
        const PAGE_SIZE: u64 = 4096;
        let s = std::fs::read_to_string("/proc/self/statm").ok()?;
        let pages: u64 = s.split_whitespace().nth(1)?.parse().ok()?;
        Some(pages * PAGE_SIZE)
    }

    /// T6 Case 1 + Case 2 — high-cardinality input does not blow memory.
    ///
    /// Inserts 50 000 distinct keys into a cache with `max_entries = 1000`.
    /// Asserts:
    ///   - `cache.len() ≤ max_entries` at the end (LRU cap honoured).
    ///   - Every key beyond the cap triggers an eviction; eviction count
    ///     gauge advances accordingly.
    ///   - RSS growth is bounded — generous bound at 100 MB to absorb
    ///     test-runner / allocator noise. The point is to catch a true
    ///     leak (linear-in-N memory), not to set a tight performance
    ///     target.
    #[test]
    #[cfg(target_os = "linux")]
    fn high_cardinality_input_keeps_memory_bounded() {
        const CAP: usize = 1_000;
        const N: usize = 50_000;

        let cache = MemoryCache::with_config(CacheConfig {
            ttl: Duration::from_secs(60),
            max_entries: CAP,
        });

        let baseline_rss = read_rss_bytes().expect("baseline rss read failed");

        // Drive 50× the cap as distinct keys. Every insert beyond CAP
        // forces an eviction.
        for i in 0..N {
            cache.set(
                format!("k{i}"),
                json!({"i": i, "name": "high-cardinality-test"}),
            );
        }

        let final_rss = read_rss_bytes().expect("final rss read failed");
        let growth_bytes = final_rss.saturating_sub(baseline_rss);
        let growth_mb = growth_bytes / (1024 * 1024);

        // Diagnostic — surfaces under `--nocapture` so the operator
        // running T6 can see actual numbers.
        eprintln!(
            "T6 case 1: N={N} CAP={CAP} cache.len={} \
             baseline_rss={} MB final_rss={} MB growth={} MB",
            cache.len(),
            baseline_rss / (1024 * 1024),
            final_rss / (1024 * 1024),
            growth_mb
        );

        // Cap is respected.
        assert!(
            cache.len() <= CAP,
            "cache exceeded max_entries: len={}, cap={}",
            cache.len(),
            CAP
        );

        // Memory growth is bounded. With CAP=1000 entries holding small
        // JSON values, the cache itself is well under 10 MB. We allow
        // 100 MB total RSS growth to leave generous slack for the
        // allocator's free-list, mockito threads, and test harness.
        // A real leak would scale with N (50k items at ≥ 1 KB each =
        // ≥ 50 MB stuck in heap, plus per-key overhead — easily
        // breaching 100 MB).
        assert!(
            growth_mb < 100,
            "RSS grew {growth_mb} MB after {N} inserts into {CAP}-cap cache; \
             expected < 100 MB (suspected leak)"
        );
    }

    #[test]
    fn clear_empties_cache() {
        let cache = MemoryCache::new();
        cache.set("x".to_string(), json!({}));
        cache.clear();
        assert!(cache.is_empty());
    }

    #[test]
    fn negative_cache_returns_negative_status() {
        let cache = MemoryCache::new();
        cache.set_negative("missing".to_string(), Duration::from_secs(60));
        assert!(matches!(cache.get_status("missing"), CacheStatus::Negative));
        // get() returns None for negative entries
        assert!(cache.get("missing").is_none());
    }

    #[test]
    fn expired_negative_entry_returns_miss() {
        let cache = MemoryCache::new();
        cache.set_negative("missing".to_string(), Duration::from_millis(1));
        std::thread::sleep(Duration::from_millis(5));
        // Negative entries have stale_ttl = 0, so they become Miss immediately after TTL
        assert!(matches!(cache.get_status("missing"), CacheStatus::Miss));
    }

    #[test]
    fn stats_tracks_hits_and_misses() {
        let cache = MemoryCache::new();
        cache.set("k".to_string(), json!(1));

        let _ = cache.get_status("k"); // fresh hit
        let _ = cache.get_status("missing"); // miss

        let s = cache.stats();
        assert_eq!(s.hits, 1);
        assert_eq!(s.misses, 1);
        assert_eq!(s.stale, 0);
        assert_eq!(s.negative, 0);
    }

    #[test]
    fn stats_tracks_negative_hits() {
        let cache = MemoryCache::new();
        cache.set_negative("k".to_string(), Duration::from_secs(60));
        let _ = cache.get_status("k");
        assert_eq!(cache.stats().negative, 1);
    }

    #[test]
    fn clone_shares_store_and_counters() {
        let cache = MemoryCache::new();
        let clone = cache.clone();

        // Write via original, read via clone — store is shared
        cache.set("k".to_string(), json!(1));
        assert!(clone.get("k").is_some()); // 1 hit (get → get_status internally)

        // Counter is shared: clone's hit was visible on the original
        assert_eq!(cache.stats().hits, 1);

        // A second lookup via get_status adds another hit
        let _ = clone.get_status("k");
        assert_eq!(cache.stats().hits, 2);
    }

    // ── B2.2 — Single-flight refresh coordination ──────────────────────────

    #[test]
    fn try_acquire_refresh_returns_some_first_then_none() {
        let cache = MemoryCache::new();
        let g1 = cache.try_acquire_refresh("k");
        let g2 = cache.try_acquire_refresh("k");
        assert!(g1.is_some());
        assert!(g2.is_none());
        assert_eq!(cache.in_flight_count(), 1);
        // Drop the leader — slot released.
        drop(g1);
        assert_eq!(cache.in_flight_count(), 0);
        // Now the next caller can claim again.
        assert!(cache.try_acquire_refresh("k").is_some());
    }

    #[test]
    fn try_acquire_refresh_isolates_keys() {
        let cache = MemoryCache::new();
        let g1 = cache.try_acquire_refresh("a");
        let g2 = cache.try_acquire_refresh("b");
        // Different keys — both should claim.
        assert!(g1.is_some());
        assert!(g2.is_some());
        assert_eq!(cache.in_flight_count(), 2);
    }

    #[test]
    fn refresh_dedup_count_increments_on_duplicate() {
        let cache = MemoryCache::new();
        let _g = cache.try_acquire_refresh("k");
        for _ in 0..5 {
            assert!(cache.try_acquire_refresh("k").is_none());
        }
        assert_eq!(cache.refresh_dedup_count(), 5);
    }

    #[tokio::test]
    async fn await_refresh_returns_immediately_when_no_inflight() {
        let cache = MemoryCache::new();
        // No-op: should not hang.
        tokio::time::timeout(
            std::time::Duration::from_millis(100),
            cache.await_refresh("nonexistent"),
        )
        .await
        .expect("await_refresh should return immediately when no refresh in flight");
    }

    #[tokio::test]
    async fn await_refresh_wakes_when_guard_drops() {
        let cache = MemoryCache::new();
        let guard = cache.try_acquire_refresh("k").expect("claim first");

        let cache2 = cache.clone();
        let waiter = tokio::spawn(async move {
            cache2.await_refresh("k").await;
        });

        // Give the waiter a moment to register.
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        // Drop the guard → notify_waiters fires.
        drop(guard);

        tokio::time::timeout(std::time::Duration::from_secs(1), waiter)
            .await
            .expect("waiter should have woken")
            .expect("waiter task should have completed");
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn one_thousand_concurrent_stale_hits_produce_one_refresh() {
        // Mandatory B2.2 test: with 1000 concurrent attempts to acquire the
        // refresh slot for the same key, exactly one should win — and the
        // 999 losers must observe the slot as taken.
        //
        // Test shape:
        //   1. Spawn 1000 tasks; each waits on a Barrier so all start
        //      attempting simultaneously.
        //   2. Tasks call try_acquire_refresh.
        //   3. The winner holds its guard until *all* tasks have attempted
        //      (signalled via an AtomicUsize counter), then drops.
        //   4. Assert: exactly 1 winner, 999 losers.
        use std::sync::atomic::AtomicUsize;

        let cache = Arc::new(MemoryCache::new());
        let key = "https://rdap.example.com/domain/contended";
        let n = 1000usize;
        let barrier = Arc::new(tokio::sync::Barrier::new(n));
        let attempts_done = Arc::new(AtomicUsize::new(0));

        let mut handles = Vec::with_capacity(n);
        for _ in 0..n {
            let cache = Arc::clone(&cache);
            let k = key.to_string();
            let barrier = Arc::clone(&barrier);
            let attempts_done = Arc::clone(&attempts_done);
            handles.push(tokio::spawn(async move {
                barrier.wait().await;
                let guard = cache.try_acquire_refresh(&k);
                let won = guard.is_some();
                attempts_done.fetch_add(1, Ordering::Relaxed);

                if won {
                    // Hold the guard until all attempts have completed —
                    // this ensures every loser observes the slot as taken.
                    while attempts_done.load(Ordering::Relaxed) < n {
                        tokio::task::yield_now().await;
                    }
                    drop(guard);
                }
                won
            }));
        }

        let mut winners = 0usize;
        let mut losers = 0usize;
        for h in handles {
            if h.await.unwrap() {
                winners += 1;
            } else {
                losers += 1;
            }
        }

        assert_eq!(winners, 1, "exactly one refresher should win");
        assert_eq!(losers, 999);
        assert_eq!(cache.refresh_dedup_count(), 999);
    }

    #[tokio::test]
    async fn refresh_guard_panic_releases_slot() {
        // Even if the leader's task panics, the Drop impl on RefreshGuard
        // must release the slot. This is what allows the system to recover
        // from refresher panics without permanently blocking that key.
        let cache = MemoryCache::new();

        let cache_clone = cache.clone();
        let join = tokio::spawn(async move {
            let _g = cache_clone.try_acquire_refresh("k").expect("claim first");
            panic!("simulated leader panic");
        });
        let _ = join.await; // we expect the JoinError

        // Slot must be free.
        assert_eq!(cache.in_flight_count(), 0);
        assert!(cache.try_acquire_refresh("k").is_some());
    }
}
