//! In-memory response cache with TTL expiry.
//!
//! Uses [`DashMap`] for lock-free concurrent reads.
//! Entries are evicted lazily (on read) and eagerly (on `clear()`).

#![forbid(unsafe_code)]

use std::sync::Arc;
use std::time::{Duration, Instant};

use dashmap::DashMap;
use serde_json::Value;

// ── Cache entry ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
struct Entry {
    value: Value,
    inserted_at: Instant,
    ttl: Duration,
}

impl Entry {
    fn is_expired(&self) -> bool {
        self.inserted_at.elapsed() > self.ttl
    }
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

/// Thread-safe in-memory RDAP response cache.
///
/// Cache keys are the full query URL strings.
#[derive(Debug, Clone)]
pub struct MemoryCache {
    store: Arc<DashMap<String, Entry>>,
    config: CacheConfig,
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
        }
    }

    /// Retrieves a cached value if it exists and has not expired.
    pub fn get(&self, key: &str) -> Option<Value> {
        let entry = self.store.get(key)?;
        if entry.is_expired() {
            drop(entry);
            self.store.remove(key);
            return None;
        }
        Some(entry.value.clone())
    }

    /// Inserts a value with the default TTL.
    pub fn set(&self, key: String, value: Value) {
        self.set_with_ttl(key, value, self.config.ttl);
    }

    /// Inserts a value with a custom TTL.
    pub fn set_with_ttl(&self, key: String, value: Value, ttl: Duration) {
        if self.store.len() >= self.config.max_entries {
            self.evict_oldest();
        }

        self.store.insert(
            key,
            Entry {
                value,
                inserted_at: Instant::now(),
                ttl,
            },
        );
    }

    /// Removes all entries from the cache.
    pub fn clear(&self) {
        self.store.clear();
    }

    /// Returns the number of entries currently in the cache.
    pub fn len(&self) -> usize {
        self.store.len()
    }

    /// Returns `true` if the cache is empty.
    pub fn is_empty(&self) -> bool {
        self.store.is_empty()
    }

    /// Removes all expired entries.
    pub fn evict_expired(&self) {
        self.store.retain(|_, entry| !entry.is_expired());
    }

    fn evict_oldest(&self) {
        let oldest_key = self
            .store
            .iter()
            .min_by_key(|entry| entry.value().inserted_at)
            .map(|entry| entry.key().clone());

        if let Some(key) = oldest_key {
            self.store.remove(&key);
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
    fn expired_entry_is_evicted() {
        let cache = MemoryCache::with_config(CacheConfig {
            ttl: Duration::from_millis(1),
            max_entries: 100,
        });

        cache.set("key".to_string(), json!({}));
        std::thread::sleep(Duration::from_millis(5));
        assert!(cache.get("key").is_none());
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

    #[test]
    fn clear_empties_cache() {
        let cache = MemoryCache::new();
        cache.set("x".to_string(), json!({}));
        cache.clear();
        assert!(cache.is_empty());
    }
}
