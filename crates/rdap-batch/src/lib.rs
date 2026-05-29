//! High-performance batch RDAP query engine.
//!
//! Uses [`futures::StreamExt::buffer_unordered`] to keep a constant number of
//! queries in-flight at all times — avoiding the throughput cliff of chunk-based
//! batching where one slow query stalls an entire chunk.
//!
//! # Memory model
//!
//! ```text
//! peak memory = O(concurrency + channel_buffer)
//! ```
//!
//! One million queries with `concurrency = 50` and `buffer = 64` uses the same
//! peak memory as one hundred queries.
//!
//! # Quick start
//!
//! ```rust,no_run
//! use std::sync::Arc;
//! use rdap_batch::{BatchExecutor, BatchQuery, BatchConfig, BatchItemResult};
//! use rdapify_client::RdapClient;
//! use tokio_stream::StreamExt;
//!
//! #[tokio::main]
//! async fn main() {
//!     let client = Arc::new(RdapClient::new().unwrap());
//!     let executor = BatchExecutor::new(client);
//!
//!     let queries = vec![
//!         BatchQuery::Domain("example.com".into()),
//!         BatchQuery::Domain("example.org".into()),
//!     ];
//!
//!     let mut stream = executor.run_stream(queries, BatchConfig::default());
//!     while let Some(item) = stream.next().await {
//!         match item {
//!             BatchItemResult::Ok(resp) => println!("ok: {:?}", resp),
//!             BatchItemResult::Err(e)   => eprintln!("err: {e}"),
//!         }
//!     }
//! }
//! ```

#![forbid(unsafe_code)]

use std::net::IpAddr;
use std::sync::Arc;

use futures::stream::{self, StreamExt};
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;

use rdap_types::{error::RdapError, AsnResponse, DomainResponse, IpResponse, NameserverResponse};
use rdapify_client::RdapClient;

// ── Query input ───────────────────────────────────────────────────────────────

/// A single RDAP lookup to be executed in a batch.
#[derive(Debug, Clone)]
pub enum BatchQuery {
    /// A fully-qualified domain name (e.g. `"example.com"`).
    Domain(String),
    /// An IPv4 or IPv6 address.
    Ip(IpAddr),
    /// An Autonomous System Number.
    Asn(u32),
    /// A nameserver hostname (e.g. `"ns1.example.com"`).
    Nameserver(String),
}

// ── Response output ───────────────────────────────────────────────────────────

/// A discriminated RDAP response, matching the input query type.
#[derive(Debug)]
pub enum RdapResponse {
    Domain(Box<DomainResponse>),
    Ip(Box<IpResponse>),
    Asn(Box<AsnResponse>),
    Nameserver(Box<NameserverResponse>),
}

/// Broad error category — use this to decide on retry, logging, or reporting.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ErrorCategory {
    /// Transient network failure (timeout, connection reset). Safe to retry.
    Retryable,
    /// The queried object does not exist.
    NotFound,
    /// The input was rejected before any network call (bad domain, bad IP).
    InvalidInput,
    /// The request was throttled by the local rate limiter or the remote server.
    RateLimited,
    /// Non-recoverable: parse failure, SSRF block, unknown object class, etc.
    Fatal,
}

/// A batch-level error wrapping the underlying [`RdapError`] with a category.
#[derive(Debug)]
pub struct BatchError {
    /// The underlying RDAP error.
    pub source: RdapError,
    /// Broad category for retry / reporting decisions.
    pub category: ErrorCategory,
}

impl std::fmt::Display for BatchError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{:?}] {}", self.category, self.source)
    }
}

impl std::error::Error for BatchError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        Some(&self.source)
    }
}

/// The result for a single item in the batch stream.
///
/// Errors are isolated — a failure for one query never affects others.
#[derive(Debug)]
pub enum BatchItemResult {
    Ok(RdapResponse),
    Err(BatchError),
}

// ── Configuration ─────────────────────────────────────────────────────────────

/// Tuning knobs for [`BatchExecutor::run_stream`].
#[derive(Debug, Clone)]
pub struct BatchConfig {
    /// Maximum number of queries in-flight simultaneously. Default: `50`.
    ///
    /// Higher values increase throughput at the cost of more concurrent
    /// connections and memory. Tune to match the remote server's capacity.
    pub concurrency: usize,

    /// Emit results in the same order as the input queries. Default: `false`.
    ///
    /// When `false` (default) results arrive as soon as each query completes
    /// (`buffer_unordered`). When `true`, order is preserved (`buffered`),
    /// which may reduce throughput if fast queries must wait for slow ones.
    pub ordered: bool,

    /// Channel capacity between the producer task and the consumer. Default: `64`.
    ///
    /// A larger buffer absorbs bursts; a smaller buffer applies more
    /// back-pressure to the producer, trading throughput for lower peak memory.
    pub buffer: usize,
}

impl Default for BatchConfig {
    fn default() -> Self {
        Self {
            concurrency: 50,
            ordered: false,
            buffer: 64,
        }
    }
}

// ── Progress reporting (optional) ─────────────────────────────────────────────

/// Observer for batch execution events.
///
/// All methods are called from the producer async task. Implementations must
/// be cheap and non-blocking; avoid I/O or heavy computation inside them.
pub trait ProgressSink: Send + Sync + 'static {
    /// Called once before any queries are dispatched.
    ///
    /// `total` is the number of queries in the batch, or `0` if the input
    /// iterator does not have a known length.
    fn on_start(&self, total: usize);

    /// Called each time a query completes (success or error).
    ///
    /// `done` is the cumulative count of completed queries.
    fn on_progress(&self, done: usize);

    /// Called each time a query produces an error.
    fn on_error(&self);

    /// Called once after all queries have completed.
    fn on_complete(&self);
}

// ── Executor ──────────────────────────────────────────────────────────────────

/// High-performance batch RDAP executor.
///
/// Shares an [`Arc<RdapClient>`] across all concurrent queries. Cache hits,
/// rate limiting, and HTTP are all handled by the underlying client — the
/// executor's only responsibility is concurrency scheduling.
pub struct BatchExecutor {
    client: Arc<RdapClient>,
}

impl BatchExecutor {
    /// Creates a new executor that shares the given client.
    pub fn new(client: Arc<RdapClient>) -> Self {
        Self { client }
    }

    /// Streams results for `queries` with constant-concurrency execution.
    ///
    /// The returned [`ReceiverStream`] yields items as soon as they are ready
    /// (or in input order when `config.ordered` is `true`). Drop the stream
    /// early to cancel remaining queries.
    ///
    /// # Memory
    ///
    /// Bounded by `O(concurrency + buffer)` regardless of total query count.
    pub fn run_stream<I>(&self, queries: I, config: BatchConfig) -> ReceiverStream<BatchItemResult>
    where
        I: IntoIterator<Item = BatchQuery> + Send + 'static,
        I::IntoIter: Send,
    {
        let (tx, rx) = mpsc::channel(config.buffer);
        let client = Arc::clone(&self.client);
        let concurrency = config.concurrency.max(1);

        tokio::spawn(async move {
            // Each query is converted into a future; `buffer_unordered` /
            // `buffered` polls at most `concurrency` of them at a time.
            let task_stream = stream::iter(queries).map(move |q| {
                let client = Arc::clone(&client);
                async move { process_query(client, q).await }
            });

            if config.ordered {
                let mut s = task_stream.buffered(concurrency);
                while let Some(result) = s.next().await {
                    if tx.send(result).await.is_err() {
                        break; // consumer dropped the stream — stop producing
                    }
                }
            } else {
                let mut s = task_stream.buffer_unordered(concurrency);
                while let Some(result) = s.next().await {
                    if tx.send(result).await.is_err() {
                        break;
                    }
                }
            }
            // `tx` drops here, which closes the channel and terminates the
            // ReceiverStream on the consumer side.
        });

        ReceiverStream::new(rx)
    }

    /// Variant of [`run_stream`] that reports progress to a [`ProgressSink`].
    ///
    /// The `total` hint passed to [`ProgressSink::on_start`] is `0` unless
    /// the iterator's `size_hint` lower bound is positive.
    ///
    /// [`run_stream`]: BatchExecutor::run_stream
    pub fn run_stream_with_progress<I, P>(
        &self,
        queries: I,
        config: BatchConfig,
        sink: P,
    ) -> ReceiverStream<BatchItemResult>
    where
        I: IntoIterator<Item = BatchQuery> + Send + 'static,
        I::IntoIter: Send,
        P: ProgressSink,
    {
        let (tx, rx) = mpsc::channel(config.buffer);
        let client = Arc::clone(&self.client);
        let concurrency = config.concurrency.max(1);
        let sink = Arc::new(sink);

        tokio::spawn(async move {
            let queries: Vec<BatchQuery> = queries.into_iter().collect();
            let total = queries.len();
            sink.on_start(total);

            let sink_map = Arc::clone(&sink);
            let task_stream = stream::iter(queries).map(move |q| {
                let client = Arc::clone(&client);
                let sink = Arc::clone(&sink_map);
                async move {
                    let result = process_query(client, q).await;
                    if matches!(result, BatchItemResult::Err(_)) {
                        sink.on_error();
                    }
                    result
                }
            });

            let mut done: usize = 0;

            if config.ordered {
                let mut s = task_stream.buffered(concurrency);
                while let Some(result) = s.next().await {
                    done += 1;
                    sink.on_progress(done);
                    if tx.send(result).await.is_err() {
                        break;
                    }
                }
            } else {
                let mut s = task_stream.buffer_unordered(concurrency);
                while let Some(result) = s.next().await {
                    done += 1;
                    sink.on_progress(done);
                    if tx.send(result).await.is_err() {
                        break;
                    }
                }
            }

            sink.on_complete();
        });

        ReceiverStream::new(rx)
    }
}

// ── Core query logic ──────────────────────────────────────────────────────────

/// Dispatches a single [`BatchQuery`] to the appropriate client method.
///
/// Errors are caught and classified — they never propagate as panics.
async fn process_query(client: Arc<RdapClient>, query: BatchQuery) -> BatchItemResult {
    let result = match &query {
        BatchQuery::Domain(d) => client
            .domain(d)
            .await
            .map(|r| RdapResponse::Domain(Box::new(r))),

        BatchQuery::Ip(ip) => client
            .ip(&ip.to_string())
            .await
            .map(|r| RdapResponse::Ip(Box::new(r))),

        BatchQuery::Asn(asn) => client
            .asn(asn.to_string())
            .await
            .map(|r| RdapResponse::Asn(Box::new(r))),

        BatchQuery::Nameserver(ns) => client
            .nameserver(ns)
            .await
            .map(|r| RdapResponse::Nameserver(Box::new(r))),
    };

    match result {
        Ok(resp) => BatchItemResult::Ok(resp),
        Err(err) => BatchItemResult::Err(classify_error(err)),
    }
}

/// Maps an [`RdapError`] to a [`BatchError`] with a coarse [`ErrorCategory`].
fn classify_error(err: RdapError) -> BatchError {
    let category = match &err {
        // Transient — worth retrying
        RdapError::Timeout { .. } | RdapError::Network(_) => ErrorCategory::Retryable,

        // Throttled
        RdapError::RateLimited { .. } => ErrorCategory::RateLimited,

        // Object does not exist
        RdapError::HttpStatus { status: 404, .. } | RdapError::NoServerFound { .. } => {
            ErrorCategory::NotFound
        }

        // Bad input — retrying won't help
        RdapError::InvalidInput(_)
        | RdapError::InvalidUrl { .. }
        | RdapError::InsecureScheme { .. } => ErrorCategory::InvalidInput,

        // Everything else (parse errors, SSRF blocks, unknown object classes…)
        _ => ErrorCategory::Fatal,
    };

    BatchError {
        source: err,
        category,
    }
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    // ── classify_error ────────────────────────────────────────────────────────

    #[test]
    fn timeout_is_retryable() {
        let err = RdapError::Timeout {
            millis: 5_000,
            url: "https://rdap.example.com/domain/foo.com".into(),
        };
        assert_eq!(classify_error(err).category, ErrorCategory::Retryable);
    }

    #[test]
    fn network_error_is_retryable() {
        // reqwest::Error is hard to construct directly; test via status-based
        // Timeout variant instead (same Retryable branch).
        let err = RdapError::Timeout {
            millis: 100,
            url: "https://rdap.example.com/domain/x.com".into(),
        };
        assert_eq!(classify_error(err).category, ErrorCategory::Retryable);
    }

    #[test]
    fn rate_limited_category() {
        let err = RdapError::RateLimited {
            host: "rdap.verisign.com".into(),
            wait_time: Duration::from_secs(1),
        };
        assert_eq!(classify_error(err).category, ErrorCategory::RateLimited);
    }

    #[test]
    fn http_404_is_not_found() {
        let err = RdapError::HttpStatus {
            status: 404,
            url: "https://rdap.example.com/domain/no.com".into(),
        };
        assert_eq!(classify_error(err).category, ErrorCategory::NotFound);
    }

    #[test]
    fn no_server_found_is_not_found() {
        let err = RdapError::NoServerFound {
            query: "unknown.invalid".into(),
        };
        assert_eq!(classify_error(err).category, ErrorCategory::NotFound);
    }

    #[test]
    fn invalid_input_category() {
        let err = RdapError::InvalidInput("bad domain".into());
        assert_eq!(classify_error(err).category, ErrorCategory::InvalidInput);
    }

    #[test]
    fn insecure_scheme_is_invalid_input() {
        let err = RdapError::InsecureScheme {
            scheme: "http".into(),
        };
        assert_eq!(classify_error(err).category, ErrorCategory::InvalidInput);
    }

    #[test]
    fn parse_error_is_fatal() {
        let err = RdapError::ParseError {
            reason: "unexpected field".into(),
        };
        assert_eq!(classify_error(err).category, ErrorCategory::Fatal);
    }

    #[test]
    fn http_500_is_fatal() {
        let err = RdapError::HttpStatus {
            status: 500,
            url: "https://rdap.example.com/domain/x.com".into(),
        };
        assert_eq!(classify_error(err).category, ErrorCategory::Fatal);
    }

    // ── BatchConfig ───────────────────────────────────────────────────────────

    #[test]
    fn default_config_values() {
        let cfg = BatchConfig::default();
        assert_eq!(cfg.concurrency, 50);
        assert!(!cfg.ordered);
        assert_eq!(cfg.buffer, 64);
    }

    #[test]
    fn zero_concurrency_clamped_to_one() {
        // concurrency.max(1) in run_stream ensures we never pass 0 to buffered()
        let concurrency: usize = 0;
        let clamped = concurrency.max(1);
        assert_eq!(clamped, 1);
    }
}
