//! Batch command implementation with streaming execution and progress bar.
//!
//! Reads domain names (one per line) from a file, executes RDAP lookups
//! using `BatchExecutor::run_stream_with_progress`, and prints results
//! as they arrive — constant memory regardless of input size.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use indicatif::{ProgressBar, ProgressStyle};
use rdap_batch::{
    BatchConfig, BatchExecutor, BatchItemResult, BatchQuery, ProgressSink, RdapResponse,
};
use rdapify_client::RdapClient;
use tokio_stream::StreamExt;

use crate::output::OutputFormat;

// ── ProgressSink implementation ───────────────────────────────────────────────

/// Bridges `rdap-batch`'s `ProgressSink` trait to an `indicatif` progress bar.
struct IndicatifSink {
    pb: ProgressBar,
    errors: AtomicU64,
}

impl IndicatifSink {
    fn new(pb: ProgressBar) -> Self {
        Self {
            pb,
            errors: AtomicU64::new(0),
        }
    }

    fn refresh_message(&self) {
        let errs = self.errors.load(Ordering::Relaxed);
        self.pb.set_message(format!("errors: {errs}"));
    }
}

impl ProgressSink for IndicatifSink {
    fn on_start(&self, total: usize) {
        self.pb.set_length(total as u64);
    }

    fn on_progress(&self, _done: usize) {
        self.pb.inc(1);
        self.refresh_message();
    }

    fn on_error(&self) {
        self.errors.fetch_add(1, Ordering::Relaxed);
    }

    fn on_complete(&self) {
        self.pb.finish_and_clear();
    }
}

// ── Batch command ─────────────────────────────────────────────────────────────

/// Runs the `batch` command.
///
/// Reads `file` (one domain per line, `#` comments ignored), executes RDAP
/// lookups with `concurrency` simultaneous requests, and prints results to
/// stdout as they arrive using `format`.
pub async fn run_batch(
    file: &str,
    concurrency: usize,
    format: OutputFormat,
    quiet: bool,
) -> Result<(), String> {
    // ── 1. Read query file ────────────────────────────────────────────────────
    let contents =
        std::fs::read_to_string(file).map_err(|e| format!("Cannot read '{file}': {e}"))?;

    let queries: Vec<BatchQuery> = contents
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .map(parse_query)
        .collect();

    let total = queries.len();
    if total == 0 {
        if !quiet {
            eprintln!("No queries found in '{file}'");
        }
        return Ok(());
    }

    // ── 2. Build client + executor ────────────────────────────────────────────
    let client =
        Arc::new(RdapClient::new().map_err(|e| format!("Failed to build RDAP client: {e}"))?);
    let executor = BatchExecutor::new(Arc::clone(&client));

    let config = BatchConfig {
        concurrency,
        ordered: false,
        buffer: 64,
    };

    // ── 3. Setup progress bar (suppressed with --quiet) ───────────────────────
    let pb = if quiet {
        ProgressBar::hidden()
    } else {
        let pb = ProgressBar::new(total as u64);
        pb.set_style(
            ProgressStyle::with_template(
                "[{bar:40.cyan/white}] {pos}/{len} ({percent}%) • {per_sec} • {msg}",
            )
            .unwrap()
            .progress_chars("█░"),
        );
        pb.set_message("errors: 0");
        pb
    };

    let sink = IndicatifSink::new(pb.clone());

    // ── 4. Stream results ─────────────────────────────────────────────────────
    format.print_csv_header();

    let mut stream = executor.run_stream_with_progress(queries, config, sink);
    let mut ok_count: u64 = 0;
    let mut err_count: u64 = 0;

    while let Some(item) = stream.next().await {
        match item {
            BatchItemResult::Ok(resp) => {
                ok_count += 1;
                let value = rdap_response_to_value(&resp);
                format.print_batch_item(&value);
            }
            BatchItemResult::Err(e) => {
                err_count += 1;
                format.print_batch_error(&e.to_string());
            }
        }
    }

    // ── 5. Summary ────────────────────────────────────────────────────────────
    if !quiet {
        eprintln!("Done: {ok_count} succeeded, {err_count} failed (total: {total})");
    }

    Ok(())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Converts a line to a `BatchQuery`.
///
/// Supports optional type prefix: `domain:`, `ip:`, `asn:`, `ns:`.
/// Unprefixed lines are treated as domain names.
fn parse_query(line: &str) -> BatchQuery {
    if let Some(rest) = line.strip_prefix("ip:") {
        if let Ok(addr) = rest.trim().parse() {
            return BatchQuery::Ip(addr);
        }
    }
    if let Some(rest) = line.strip_prefix("asn:") {
        let raw = rest
            .trim()
            .trim_start_matches("AS")
            .trim_start_matches("as");
        if let Ok(n) = raw.parse::<u32>() {
            return BatchQuery::Asn(n);
        }
    }
    if let Some(rest) = line.strip_prefix("ns:") {
        return BatchQuery::Nameserver(rest.trim().to_string());
    }
    // Default: treat as domain (strip any explicit `domain:` prefix)
    let domain = line.strip_prefix("domain:").unwrap_or(line);
    BatchQuery::Domain(domain.trim().to_string())
}

/// Converts a `RdapResponse` to a `serde_json::Value` for output formatting.
fn rdap_response_to_value(resp: &RdapResponse) -> serde_json::Value {
    match resp {
        RdapResponse::Domain(d) => serde_json::to_value(d.as_ref()).unwrap_or_default(),
        RdapResponse::Ip(i) => serde_json::to_value(i.as_ref()).unwrap_or_default(),
        RdapResponse::Asn(a) => serde_json::to_value(a.as_ref()).unwrap_or_default(),
        RdapResponse::Nameserver(n) => serde_json::to_value(n.as_ref()).unwrap_or_default(),
    }
}
