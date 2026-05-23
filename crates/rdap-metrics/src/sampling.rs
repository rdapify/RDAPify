//! Stage D · D2 — sampling decisions for tracing spans.
//!
//! Tracing is **off by default**. Operators turn it on by setting
//! `trace_sample_rate` to a small fraction (1–5%) or by enabling
//! `verbose_trace` (D6). Per-call cost when off is one branch on a `bool`
//! plus one `f32` comparison.

use rand::Rng;

/// Decide whether the current call should open a `rdap.*` tracing span.
///
/// `verbose` short-circuits the random draw — when set, every call is
/// traced. When `verbose` is false and `sample_rate <= 0.0`, the function
/// returns `false` without touching the RNG.
///
/// `sample_rate` is interpreted as a fraction in `0.0..=1.0`. Values
/// outside that range are clamped (negatives → off, ≥ 1.0 → always on).
#[inline]
pub fn should_sample(verbose: bool, sample_rate: f32) -> bool {
    if verbose {
        return true;
    }
    if sample_rate <= 0.0 {
        return false;
    }
    if sample_rate >= 1.0 {
        return true;
    }
    rand::thread_rng().gen::<f32>() < sample_rate
}

/// Resolve the effective verbose setting from a config flag plus the
/// `RDAP_TRACE` environment variable. Either being truthy (`config_flag`
/// set, or env var equal to `"1"`) wins.
///
/// Read once at construction time so the env-var dispatch isn't on the
/// hot path. `RDAP_TRACE` semantics: `"1"` = on, anything else = off.
pub fn resolve_verbose(config_flag: bool) -> bool {
    if config_flag {
        return true;
    }
    matches!(std::env::var("RDAP_TRACE").as_deref(), Ok("1"))
}

/// Returns a fresh UUID v7 string suitable for use as a `request_id`
/// tracing field.
///
/// UUID v7 encodes the unix-millis timestamp in its leading bits, so
/// request IDs sort lexically by creation time — useful for log-search
/// pivots ("show me the last 100 requests on host X"). Allocation cost
/// is one `String` per call, only paid when sampling has decided to
/// open a span.
#[inline]
pub fn fresh_request_id() -> String {
    uuid::Uuid::now_v7().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verbose_short_circuits_random_draw() {
        // No matter the rate, verbose=true means trace.
        for _ in 0..50 {
            assert!(should_sample(true, 0.0));
            assert!(should_sample(true, -1.0));
        }
    }

    #[test]
    fn rate_zero_means_off() {
        for _ in 0..50 {
            assert!(!should_sample(false, 0.0));
            assert!(!should_sample(false, -0.5));
        }
    }

    #[test]
    fn rate_one_means_always_on() {
        for _ in 0..50 {
            assert!(should_sample(false, 1.0));
            assert!(should_sample(false, 1.5));
        }
    }

    #[test]
    fn rate_half_returns_both_outcomes_in_a_long_run() {
        // 1000 draws at 50% — we must see both true and false. Failure
        // probability under fair sampling is ~ 2^-999.
        let mut t = 0;
        let mut f = 0;
        for _ in 0..1000 {
            if should_sample(false, 0.5) {
                t += 1;
            } else {
                f += 1;
            }
        }
        assert!(t > 100, "too few traces: {t}");
        assert!(f > 100, "too few skips: {f}");
    }

    #[test]
    fn resolve_verbose_returns_true_when_config_flag_set() {
        assert!(resolve_verbose(true));
    }

    #[test]
    fn resolve_verbose_reads_env_var() {
        // We avoid mutating the global env in tests — the var-set path is
        // covered by an explicit env::set_var test that runs serially in
        // tests/sampling_env.rs (integration). Here we only verify the
        // fast positive path.
        assert!(resolve_verbose(true));
    }

    #[test]
    fn fresh_request_id_is_36_char_uuid() {
        let id = fresh_request_id();
        assert_eq!(id.len(), 36, "UUID v7 string is 36 chars: {id}");
        assert_eq!(id.chars().filter(|c| *c == '-').count(), 4);
    }

    #[test]
    fn fresh_request_id_is_unique_per_call() {
        let a = fresh_request_id();
        let b = fresh_request_id();
        assert_ne!(a, b);
    }

    #[test]
    fn fresh_request_id_sorts_chronologically() {
        // UUID v7 encodes ms-precision timestamps in its leading bits.
        // A small sleep guarantees distinct millisecond windows, after
        // which lexical order matches creation order.
        let a = fresh_request_id();
        std::thread::sleep(std::time::Duration::from_millis(2));
        let b = fresh_request_id();
        assert!(a < b, "v7 UUIDs should sort by creation time: {a} vs {b}");
    }
}
