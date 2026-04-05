//! Benchmarks for SSRF URL validation.
//!
//! Measures the cost of `SsrfGuard::validate()` for:
//! - A public domain URL (allowed, fast path)
//! - A public IPv4 URL (allowed, parsed as IP)
//! - A private IPv4 URL (blocked at RFC-1918 check)
//! - A link-local IPv4 URL (blocked at 169.254/16 check)
//! - A public IPv6 URL (allowed)
//! - An HTTP (non-HTTPS) URL (blocked immediately at scheme check)

use criterion::{criterion_group, criterion_main, Criterion};

use rdapify::security::{SsrfConfig, SsrfGuard};

fn bench_ssrf_domain_public(c: &mut Criterion) {
    let guard = SsrfGuard::new();
    c.bench_function("ssrf_domain_public", |b| {
        b.iter(|| {
            criterion::black_box(
                guard.validate("https://rdap.verisign.com/com/v1/domain/example.com"),
            )
        });
    });
}

fn bench_ssrf_ipv4_public(c: &mut Criterion) {
    let guard = SsrfGuard::new();
    c.bench_function("ssrf_ipv4_public", |b| {
        b.iter(|| criterion::black_box(guard.validate("https://8.8.8.8/rdap/ip/8.8.8.8")));
    });
}

fn bench_ssrf_ipv4_private_blocked(c: &mut Criterion) {
    let guard = SsrfGuard::new();
    c.bench_function("ssrf_ipv4_private_blocked", |b| {
        b.iter(|| criterion::black_box(guard.validate("https://192.168.1.1/rdap/ip/192.168.1.1")));
    });
}

fn bench_ssrf_ipv4_loopback_blocked(c: &mut Criterion) {
    let guard = SsrfGuard::new();
    c.bench_function("ssrf_ipv4_loopback_blocked", |b| {
        b.iter(|| criterion::black_box(guard.validate("https://127.0.0.1/rdap/ip/127.0.0.1")));
    });
}

fn bench_ssrf_ipv4_link_local_blocked(c: &mut Criterion) {
    let guard = SsrfGuard::new();
    c.bench_function("ssrf_ipv4_link_local_blocked", |b| {
        b.iter(|| {
            criterion::black_box(guard.validate("https://169.254.169.254/latest/meta-data/"))
        });
    });
}

fn bench_ssrf_ipv6_public(c: &mut Criterion) {
    let guard = SsrfGuard::new();
    c.bench_function("ssrf_ipv6_public", |b| {
        b.iter(|| {
            criterion::black_box(
                guard.validate("https://[2001:4860:4860::8888]/rdap/ip/2001:4860:4860::8888"),
            )
        });
    });
}

fn bench_ssrf_http_scheme_blocked(c: &mut Criterion) {
    let guard = SsrfGuard::new();
    c.bench_function("ssrf_http_scheme_blocked", |b| {
        b.iter(|| {
            criterion::black_box(
                guard.validate("http://rdap.verisign.com/com/v1/domain/example.com"),
            )
        });
    });
}

fn bench_ssrf_disabled(c: &mut Criterion) {
    let guard = SsrfGuard::with_config(SsrfConfig {
        enabled: false,
        ..Default::default()
    });
    c.bench_function("ssrf_disabled_bypass", |b| {
        b.iter(|| criterion::black_box(guard.validate("http://127.0.0.1/anything")));
    });
}

criterion_group!(
    benches,
    bench_ssrf_domain_public,
    bench_ssrf_ipv4_public,
    bench_ssrf_ipv4_private_blocked,
    bench_ssrf_ipv4_loopback_blocked,
    bench_ssrf_ipv4_link_local_blocked,
    bench_ssrf_ipv6_public,
    bench_ssrf_http_scheme_blocked,
    bench_ssrf_disabled,
);
criterion_main!(benches);
