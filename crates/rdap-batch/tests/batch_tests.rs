//! Integration tests for rdap-batch.
//!
//! All tests use a local mockito server — no real network calls are made.
//! Tests marked `#[ignore]` require a live network and run with
//! `cargo test -- --ignored`.

mod common;

use rdap_batch::{BatchConfig, BatchItemResult, BatchQuery, ErrorCategory};
use tokio_stream::StreamExt;

// ── helpers ───────────────────────────────────────────────────────────────────

/// Count Ok / Err items in a stream.
async fn tally(mut stream: impl StreamExt<Item = BatchItemResult> + Unpin) -> (usize, usize) {
    let (mut ok, mut err) = (0usize, 0usize);
    while let Some(item) = stream.next().await {
        match item {
            BatchItemResult::Ok(_) => ok += 1,
            BatchItemResult::Err(_) => err += 1,
        }
    }
    (ok, err)
}

// ── single domain ─────────────────────────────────────────────────────────────

#[tokio::test]
async fn single_domain_ok() {
    let mut server = mockito::Server::new_async().await;
    let base = server.url();
    let rdap_base = format!("{base}/rdap");

    server
        .mock("GET", "/dns.json")
        .with_status(200)
        .with_body(common::dns_bootstrap("com", &rdap_base).to_string())
        .create_async()
        .await;

    server
        .mock("GET", "/rdap/domain/example.com")
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(common::domain_response("example.com").to_string())
        .create_async()
        .await;

    let executor = common::test_executor(&server);
    let queries = vec![BatchQuery::Domain("example.com".into())];
    let stream = executor.run_stream(queries, common::test_config(4));

    let (ok, err) = tally(stream).await;
    assert_eq!(ok, 1);
    assert_eq!(err, 0);
}

// ── error isolation ───────────────────────────────────────────────────────────

#[tokio::test]
async fn errors_are_isolated_from_successes() {
    let mut server = mockito::Server::new_async().await;
    let base = server.url();
    let rdap_base = format!("{base}/rdap");

    // Bootstrap covers "com"
    server
        .mock("GET", "/dns.json")
        .with_status(200)
        .with_body(common::dns_bootstrap("com", &rdap_base).to_string())
        .expect_at_least(1)
        .create_async()
        .await;

    server
        .mock("GET", "/rdap/domain/good.com")
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(common::domain_response("good.com").to_string())
        .create_async()
        .await;

    server
        .mock("GET", "/rdap/domain/bad.com")
        .with_status(404)
        .with_header("content-type", "application/rdap+json")
        .with_body(common::not_found_response().to_string())
        .create_async()
        .await;

    let executor = common::test_executor(&server);
    let queries = vec![
        BatchQuery::Domain("good.com".into()),
        BatchQuery::Domain("bad.com".into()),
    ];
    let stream = executor.run_stream(queries, common::test_config(4));
    let (ok, err) = tally(stream).await;

    assert_eq!(ok, 1, "good.com must succeed");
    assert_eq!(err, 1, "bad.com must fail, but not affect good.com");
}

// ── 404 → NotFound category ───────────────────────────────────────────────────

#[tokio::test]
async fn http_404_categorised_as_not_found() {
    let mut server = mockito::Server::new_async().await;
    let base = server.url();
    let rdap_base = format!("{base}/rdap");

    server
        .mock("GET", "/dns.json")
        .with_status(200)
        .with_body(common::dns_bootstrap("com", &rdap_base).to_string())
        .create_async()
        .await;

    server
        .mock("GET", "/rdap/domain/gone.com")
        .with_status(404)
        .with_header("content-type", "application/rdap+json")
        .with_body(common::not_found_response().to_string())
        .create_async()
        .await;

    let executor = common::test_executor(&server);
    let mut stream = executor.run_stream(
        vec![BatchQuery::Domain("gone.com".into())],
        common::test_config(2),
    );

    let item = stream.next().await.unwrap();
    match item {
        BatchItemResult::Err(e) => {
            assert_eq!(e.category, ErrorCategory::NotFound);
        }
        BatchItemResult::Ok(_) => panic!("expected an error"),
    }
}

// ── invalid input ─────────────────────────────────────────────────────────────

#[tokio::test]
async fn invalid_domain_categorised_as_invalid_input() {
    let mut server = mockito::Server::new_async().await;

    // Bootstrap returns nothing for empty TLD — but the client will reject ""
    // before even reaching the network.
    server
        .mock("GET", "/dns.json")
        .with_status(200)
        .with_body(common::dns_bootstrap("com", &server.url()).to_string())
        .create_async()
        .await;

    let executor = common::test_executor(&server);
    let mut stream = executor.run_stream(
        vec![BatchQuery::Domain(String::new())],
        common::test_config(2),
    );

    let item = stream.next().await.unwrap();
    match item {
        BatchItemResult::Err(e) => {
            assert_eq!(e.category, ErrorCategory::InvalidInput);
        }
        BatchItemResult::Ok(_) => panic!("expected an error for empty domain"),
    }
}

// ── ordered mode ──────────────────────────────────────────────────────────────

#[tokio::test]
async fn ordered_mode_produces_correct_count() {
    let mut server = mockito::Server::new_async().await;
    let base = server.url();
    let rdap_base = format!("{base}/rdap");

    server
        .mock("GET", "/dns.json")
        .with_status(200)
        .with_body(common::dns_bootstrap("com", &rdap_base).to_string())
        .expect_at_least(1)
        .create_async()
        .await;

    for name in &["a.com", "b.com", "c.com"] {
        let path = format!("/rdap/domain/{name}");
        server
            .mock("GET", path.as_str())
            .with_status(200)
            .with_header("content-type", "application/rdap+json")
            .with_body(common::domain_response(name).to_string())
            .create_async()
            .await;
    }

    let executor = common::test_executor(&server);
    let queries = vec![
        BatchQuery::Domain("a.com".into()),
        BatchQuery::Domain("b.com".into()),
        BatchQuery::Domain("c.com".into()),
    ];
    let cfg = BatchConfig {
        concurrency: 2,
        ordered: true,
        buffer: 8,
    };
    let stream = executor.run_stream(queries, cfg);
    let (ok, err) = tally(stream).await;

    assert_eq!(ok, 3);
    assert_eq!(err, 0);
}

// ── mixed query types ─────────────────────────────────────────────────────────

#[tokio::test]
async fn mixed_query_types_handled() {
    let mut server = mockito::Server::new_async().await;
    let base = server.url();
    let rdap_base = format!("{base}/rdap");

    // Bootstrap for domain "com"
    server
        .mock("GET", "/dns.json")
        .with_status(200)
        .with_body(common::dns_bootstrap("com", &rdap_base).to_string())
        .expect_at_least(1)
        .create_async()
        .await;

    // Domain endpoint
    server
        .mock("GET", "/rdap/domain/example.com")
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(common::domain_response("example.com").to_string())
        .create_async()
        .await;

    let executor = common::test_executor(&server);

    // Mix: one good domain + one domain with unknown TLD (→ NoServerFound → NotFound)
    let queries = vec![
        BatchQuery::Domain("example.com".into()),
        BatchQuery::Domain("example.invalid".into()),
    ];

    let stream = executor.run_stream(queries, common::test_config(4));
    let (ok, err) = tally(stream).await;

    assert_eq!(ok, 1);
    assert_eq!(err, 1);
}

// ── ProgressSink ──────────────────────────────────────────────────────────────

#[tokio::test]
async fn progress_sink_counts_match_query_count() {
    use rdap_batch::ProgressSink;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;

    struct Counter {
        started: AtomicUsize,
        progress: AtomicUsize,
        errors: AtomicUsize,
        completed: AtomicUsize,
    }

    impl ProgressSink for Counter {
        fn on_start(&self, total: usize) {
            self.started.store(total, Ordering::Relaxed);
        }
        fn on_progress(&self, _done: usize) {
            self.progress.fetch_add(1, Ordering::Relaxed);
        }
        fn on_error(&self) {
            self.errors.fetch_add(1, Ordering::Relaxed);
        }
        fn on_complete(&self) {
            self.completed.fetch_add(1, Ordering::Relaxed);
        }
    }

    let mut server = mockito::Server::new_async().await;
    let base = server.url();
    let rdap_base = format!("{base}/rdap");

    server
        .mock("GET", "/dns.json")
        .with_status(200)
        .with_body(common::dns_bootstrap("com", &rdap_base).to_string())
        .expect_at_least(1)
        .create_async()
        .await;

    server
        .mock("GET", "/rdap/domain/a.com")
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(common::domain_response("a.com").to_string())
        .create_async()
        .await;

    server
        .mock("GET", "/rdap/domain/b.com")
        .with_status(404)
        .with_header("content-type", "application/rdap+json")
        .with_body(common::not_found_response().to_string())
        .create_async()
        .await;

    let counter = Arc::new(Counter {
        started: AtomicUsize::new(0),
        progress: AtomicUsize::new(0),
        errors: AtomicUsize::new(0),
        completed: AtomicUsize::new(0),
    });
    let counter_ref = Arc::clone(&counter);

    let client = Arc::new(common::test_client(&server));
    let executor = rdap_batch::BatchExecutor::new(client);

    let queries = vec![
        BatchQuery::Domain("a.com".into()),
        BatchQuery::Domain("b.com".into()),
    ];

    let stream = executor.run_stream_with_progress(
        queries,
        common::test_config(4),
        // Move a plain Counter (not Arc) — the trait requires Send + Sync + 'static
        {
            struct SinkWrapper(Arc<Counter>);
            impl ProgressSink for SinkWrapper {
                fn on_start(&self, total: usize) {
                    self.0.started.store(total, Ordering::Relaxed);
                }
                fn on_progress(&self, _done: usize) {
                    self.0.progress.fetch_add(1, Ordering::Relaxed);
                }
                fn on_error(&self) {
                    self.0.errors.fetch_add(1, Ordering::Relaxed);
                }
                fn on_complete(&self) {
                    self.0.completed.fetch_add(1, Ordering::Relaxed);
                }
            }
            SinkWrapper(counter_ref)
        },
    );

    let (ok, err) = tally(stream).await;

    assert_eq!(ok, 1);
    assert_eq!(err, 1);
    assert_eq!(counter.started.load(Ordering::Relaxed), 2, "on_start total");
    assert_eq!(
        counter.progress.load(Ordering::Relaxed),
        2,
        "on_progress calls"
    );
    assert_eq!(counter.errors.load(Ordering::Relaxed), 1, "on_error calls");
    assert_eq!(
        counter.completed.load(Ordering::Relaxed),
        1,
        "on_complete calls"
    );
}

// ── live tests (require network) ──────────────────────────────────────────────

#[tokio::test]
#[ignore = "requires live network"]
async fn live_batch_domains_no_panic() {
    use rdapify_client::RdapClient;

    let client = Arc::new(RdapClient::new().unwrap());
    let executor = BatchExecutor::new(client);

    let queries: Vec<BatchQuery> = ["example.com", "example.org", "example.net"]
        .iter()
        .map(|d| BatchQuery::Domain(d.to_string()))
        .collect();

    let stream = executor.run_stream(queries, BatchConfig::default());
    let (ok, err) = tally(stream).await;

    println!("live: ok={ok} err={err}");
    // We only assert no panics and some results arrived.
    assert!(ok + err == 3);
}

use rdap_batch::BatchExecutor;
use std::sync::Arc;
