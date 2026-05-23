//! Latency tracking and percentile estimation backed by HdrHistogram.

use std::time::Duration;

use hdrhistogram::Histogram;

pub struct Stats {
    h: Histogram<u64>,
    success: u64,
    error: u64,
}

impl Stats {
    pub fn new() -> Self {
        // 1µs precision up to 60s — covers cache hits to upstream tails.
        // sigfigs=3 keeps the histogram under ~25 KiB.
        Self {
            h: Histogram::<u64>::new_with_bounds(1, 60_000_000, 3).expect("histogram bounds"),
            success: 0,
            error: 0,
        }
    }

    pub fn record_ok(&mut self, d: Duration) {
        self.success += 1;
        let _ = self.h.record(d.as_micros().min(u64::MAX as u128) as u64);
    }

    pub fn record_err(&mut self, d: Duration) {
        self.error += 1;
        // Errors are recorded into the same histogram so latency targets
        // include error responses (which is what users experience).
        let _ = self.h.record(d.as_micros().min(u64::MAX as u128) as u64);
    }

    pub fn total(&self) -> u64 {
        self.success + self.error
    }
    pub fn success(&self) -> u64 {
        self.success
    }
    pub fn error(&self) -> u64 {
        self.error
    }
    pub fn error_rate(&self) -> f64 {
        let t = self.total();
        if t == 0 {
            0.0
        } else {
            self.error as f64 / t as f64
        }
    }

    /// Percentile in microseconds (HdrHistogram precision).
    pub fn percentile_us(&self, p: f64) -> u64 {
        self.h.value_at_quantile(p / 100.0)
    }

    pub fn p50_ms(&self) -> f64 {
        self.percentile_us(50.0) as f64 / 1000.0
    }
    pub fn p95_ms(&self) -> f64 {
        self.percentile_us(95.0) as f64 / 1000.0
    }
    pub fn p99_ms(&self) -> f64 {
        self.percentile_us(99.0) as f64 / 1000.0
    }
    pub fn max_ms(&self) -> f64 {
        self.h.max() as f64 / 1000.0
    }
    pub fn mean_ms(&self) -> f64 {
        self.h.mean() / 1000.0
    }
}

impl Default for Stats {
    fn default() -> Self {
        Self::new()
    }
}
