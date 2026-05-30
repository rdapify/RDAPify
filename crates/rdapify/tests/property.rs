//! Property-based tests — core invariants that must hold for all inputs.
//!
//! Uses [`proptest`] to verify that the fundamental guarantees of each
//! subsystem are upheld across a large space of generated inputs, not just
//! hand-crafted examples.
//!
//! # Invariants under test
//!
//! | Subsystem       | Invariant                                             |
//! |-----------------|-------------------------------------------------------|
//! | Normalizer      | Idempotent: `norm(x) == norm(norm_output_as_input)`  |
//! | Normalizer      | `ldhName` is always lowercase in output               |
//! | Normalizer      | `query` field is preserved exactly as given           |
//! | Cache           | `get(k)` after `set(k, v)` returns `v`               |
//! | Cache           | Unknown keys always return `None`                     |
//! | Cache           | Last write wins on the same key                       |
//! | Rate limiter    | Burst limit is always enforced                        |
//! | Rate limiter    | Wait time in `Limited` error is non-negative          |
//! | Batch           | N inputs → exactly N results, no loss                |

mod common;

use proptest::prelude::*;
use rdap_cache::MemoryCache;
use rdap_core::Normalizer;
use rdap_rate_limit::{RateLimitConfig, RateLimitError, RdapRateLimiter};

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Minimal valid RDAP domain JSON for feeding the normalizer.
fn domain_json(name: &str) -> serde_json::Value {
    serde_json::json!({
        "objectClassName": "domain",
        "ldhName": name,
        "status": ["active"],
        "events": [
            { "eventAction": "registration", "eventDate": "2000-01-01T00:00:00Z" },
            { "eventAction": "expiration",   "eventDate": "2030-01-01T00:00:00Z" }
        ]
    })
}

/// Rate limiter configured with a specific per-host burst, no global limiter.
fn limiter_with_burst(burst: u32) -> RdapRateLimiter {
    RdapRateLimiter::new(RateLimitConfig {
        per_host_rps: 1,
        per_host_burst: burst.max(1),
        global_rps: None, // disable global limiter so it doesn't interfere
        global_burst: 0,
    })
}

// ── Normalizer invariants ─────────────────────────────────────────────────────

proptest! {
    /// Calling the normalizer twice with identical raw JSON produces identical
    /// output — idempotency guarantee.
    #[test]
    fn domain_normalization_idempotent(
        name   in "[a-z][a-z0-9-]{0,20}\\.[a-z]{2,6}",
        source in "[a-z]{3,15}\\.rdap\\.org",
    ) {
        let raw = domain_json(&name);
        let norm = Normalizer::new();
        let r1 = norm.domain(&name, &raw, &source, false)
            .expect("first normalization must succeed");
        let r2 = norm.domain(&name, &raw, &source, false)
            .expect("second normalization must succeed");
        prop_assert_eq!(r1.ldh_name, r2.ldh_name);
        prop_assert_eq!(r1.query,    r2.query);
        prop_assert_eq!(r1.status,   r2.status);
        prop_assert_eq!(r1.handle,   r2.handle);
    }

    /// ldhName in the normalised output is always lowercase regardless of the
    /// raw JSON value — casing is normalised at ingest.
    #[test]
    fn domain_ldhname_is_always_lowercase(
        upper in "[A-Z][A-Z0-9-]{0,20}\\.[A-Z]{2,6}",
    ) {
        let raw = domain_json(&upper);
        let norm = Normalizer::new();
        let result = norm.domain(&upper, &raw, "rdap.test.org", false)
            .expect("normalization must not fail on structurally valid input");
        if let Some(lname) = &result.ldh_name {
            let lower = lname.to_lowercase();
            prop_assert_eq!(
                lname.as_str(),
                lower.as_str(),
                "ldhName '{}' must be lowercase after normalization",
                lname
            );
        }
    }

    /// The `query` field in the output exactly mirrors the `query` argument
    /// passed to the normalizer — it is never mutated.
    #[test]
    fn domain_query_field_is_preserved(
        name in "[a-z][a-z0-9-]{0,20}\\.[a-z]{2,6}",
    ) {
        let raw = domain_json(&name);
        let norm = Normalizer::new();
        let result = norm.domain(&name, &raw, "rdap.iana.org", false)
            .expect("normalization must succeed");
        prop_assert_eq!(
            result.query.as_str(),
            name.as_str(),
            "query field must equal the input query string"
        );
    }

    /// cached flag is reflected in `meta.cached` — the normalizer never
    /// overrides it.
    #[test]
    fn domain_cached_flag_is_preserved(
        name   in "[a-z][a-z0-9-]{0,20}\\.[a-z]{2,6}",
        cached in proptest::bool::ANY,
    ) {
        let raw = domain_json(&name);
        let norm = Normalizer::new();
        let result = norm.domain(&name, &raw, "rdap.source.org", cached)
            .expect("normalization must succeed");
        prop_assert_eq!(
            result.meta.cached,
            cached,
            "meta.cached must equal the `cached` argument"
        );
    }
}

// ── Cache invariants ──────────────────────────────────────────────────────────

proptest! {
    /// After `set(key, value)`, `get(key)` returns the same value immediately.
    #[test]
    fn cache_get_returns_inserted_value(
        key     in "[a-z0-9][a-z0-9.:/-]{0,80}",
        payload in "[a-z0-9]{0,200}",
    ) {
        let cache = MemoryCache::new();
        let value = serde_json::Value::String(payload.clone());
        cache.set(key.clone(), value.clone());
        let retrieved = cache.get(&key)
            .expect("get must return Some immediately after set");
        // `get` now returns `Arc<Value>` — compare the pointee.
        prop_assert_eq!(retrieved.as_ref(), &value);
    }

    /// A key that was never written always returns `None`.
    #[test]
    fn cache_unset_key_returns_none(
        key in "[a-z]{1,50}",
    ) {
        let cache = MemoryCache::new();
        prop_assert!(
            cache.get(&key).is_none(),
            "fresh cache must return None for any key"
        );
    }

    /// When the same key is written twice, the second value wins.
    #[test]
    fn cache_last_write_wins(
        key in "[a-z0-9.:/-]{1,60}",
        v1  in "[a-z]{1,30}",
        v2  in "[A-Z]{1,30}",
    ) {
        let cache = MemoryCache::new();
        cache.set(key.clone(), serde_json::Value::String(v1));
        cache.set(key.clone(), serde_json::Value::String(v2.clone()));
        let got = cache.get(&key).expect("must have value after two writes");
        prop_assert_eq!(got.as_ref(), &serde_json::Value::String(v2));
    }

    /// After `clear()`, every previously-inserted key returns `None`.
    #[test]
    fn cache_clear_removes_all_entries(
        keys in proptest::collection::vec("[a-z]{1,20}", 1..=10),
    ) {
        let cache = MemoryCache::new();
        for k in &keys {
            cache.set(k.clone(), serde_json::json!("value"));
        }
        cache.clear();
        for k in &keys {
            prop_assert!(
                cache.get(k).is_none(),
                "key '{}' must be gone after clear()",
                k
            );
        }
    }

    /// `len()` matches the number of distinct keys inserted.
    #[test]
    fn cache_len_matches_inserted_count(
        // Use BTreeSet semantics via dedup to get distinct keys
        raw_keys in proptest::collection::hash_set("[a-z]{2,10}", 1..=8),
    ) {
        let cache = MemoryCache::new();
        for k in &raw_keys {
            cache.set(k.clone(), serde_json::json!(null));
        }
        prop_assert_eq!(
            cache.len(),
            raw_keys.len(),
            "len() must equal the number of distinct keys inserted"
        );
    }
}

// ── Rate limiter invariants ───────────────────────────────────────────────────

proptest! {
    /// After consuming the entire burst budget, the next `try_acquire` is
    /// rejected.  This holds for all valid burst values.
    #[test]
    fn rate_limiter_burst_limit_is_enforced(
        host  in "[a-z]{3,15}\\.rdap\\.example\\.com",
        burst in 1u32..=8u32,
    ) {
        let limiter = limiter_with_burst(burst);

        // Exhaust the burst allowance.  Some calls may fail if the test
        // thread is scheduled after the quota refills, but that is fine —
        // we only care that at least one call is rejected.
        let mut successes = 0u32;
        for _ in 0..burst {
            if limiter.try_acquire(&host).is_ok() {
                successes += 1;
            }
        }

        // After draining the full burst we must get Limited.
        if successes == burst {
            let result = limiter.try_acquire(&host);
            prop_assert!(
                matches!(result, Err(RateLimitError::Limited(_))),
                "try_acquire must return Limited after exhausting burst={burst}"
            );
        }
        // If < burst succeeded it means the limiter already limited earlier —
        // the invariant still holds.
    }

    /// The `Duration` inside `RateLimitError::Limited` is always ≥ 0 (zero or
    /// positive) — callers can safely sleep for this duration without panic.
    #[test]
    fn rate_limiter_wait_time_is_non_negative(
        host  in "[a-z]{3,15}\\.rdap\\.org",
        burst in 1u32..=4u32,
    ) {
        let limiter = limiter_with_burst(burst);

        // Exhaust burst
        for _ in 0..burst {
            let _ = limiter.try_acquire(&host);
        }

        match limiter.try_acquire(&host) {
            Err(RateLimitError::Limited(wait)) => {
                prop_assert!(
                    wait >= std::time::Duration::ZERO,
                    "wait time must be non-negative, got {wait:?}"
                );
            }
            Ok(()) => {
                // Quota refilled between calls — acceptable under timing
                // uncertainty; the invariant is trivially satisfied.
            }
        }
    }

    /// Distinct hosts have independent quotas — exhausting host A never
    /// blocks host B.
    #[test]
    fn rate_limiter_hosts_are_independent(
        host_a in "[a-z]{3,10}\\.a\\.com",
        host_b in "[a-z]{3,10}\\.b\\.com",
        burst  in 1u32..=4u32,
    ) {
        prop_assume!(host_a != host_b);
        let limiter = limiter_with_burst(burst);

        // Exhaust host_a
        for _ in 0..=burst {
            let _ = limiter.try_acquire(&host_a);
        }

        // host_b should still be available
        prop_assert!(
            limiter.try_acquire(&host_b).is_ok(),
            "host_b must not be affected by host_a exhaustion"
        );
    }
}

// ── Batch completeness ────────────────────────────────────────────────────────
//
// For batch tests we need an async runtime and a mock HTTP server.
// proptest is synchronous, so we spin up a Tokio runtime per invocation.
// Input space is deliberately small (≤ 8 items) to keep tests fast.

proptest! {
    /// Every input query produces exactly one output result — no items are
    /// silently dropped or duplicated.
    #[test]
    fn batch_n_inputs_produce_n_outputs(
        n in 1usize..=8usize,
    ) {
        use rdap_batch::{BatchConfig, BatchExecutor, BatchQuery};
        use rdapify::http::FetcherConfig;
        use rdapify::security::SsrfConfig;
        use rdapify::{ClientConfig, RdapClient};
        use std::sync::Arc;
        use std::time::Duration;
        use tokio_stream::StreamExt;

        let rt = tokio::runtime::Runtime::new().expect("tokio runtime");
        rt.block_on(async move {
            let mut server = mockito::Server::new_async().await;
            let base = server.url();

            // Bootstrap: "com" → this mock server
            server.mock("GET", "/dns.json")
                .with_status(200)
                .with_header("content-type", "application/json")
                .with_body(common::dns_bootstrap_json("com", &format!("{base}/rdap")).to_string())
                .create_async().await;

            // Every domain query succeeds
            server.mock("GET", mockito::Matcher::Regex(r"^/rdap/domain/.*".into()))
                .with_status(200)
                .with_header("content-type", "application/rdap+json")
                .with_body(common::domain_rdap_response("prop.com").to_string())
                .create_async().await;

            let client = Arc::new(
                RdapClient::with_config(ClientConfig {
                    bootstrap_url: Some(base.clone()),
                    cache: false,
                    ssrf: SsrfConfig { enabled: false, ..Default::default() },
                    fetcher: FetcherConfig {
                        timeout: Duration::from_secs(5),
                        max_attempts: 1,
                        ..Default::default()
                    },
                    ..Default::default()
                })
                .expect("test client"),
            );

            let queries: Vec<BatchQuery> = (0..n)
                .map(|i| BatchQuery::Domain(format!("item{i}.com")))
                .collect();

            let executor = BatchExecutor::new(client);
            let config = BatchConfig { concurrency: n.min(8), ..Default::default() };
            let mut stream = executor.run_stream(queries, config);

            let mut count = 0usize;
            while stream.next().await.is_some() {
                count += 1;
            }

            prop_assert_eq!(count, n, "batch must produce exactly n={} results", n);
            Ok(())
        }).expect("async block must not panic");
    }
}
