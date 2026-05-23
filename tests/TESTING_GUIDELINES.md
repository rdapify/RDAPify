# RDAPify — Testing Guidelines

> Test policy for the rdapify-rust workspace. Applies to every crate
> under [`crates/`](../crates/), the bindings under
> [`bindings/`](../bindings/), and the load-test harness under
> [`loadtest/`](../loadtest/).
>
> **TL;DR.** Tests assert engine behaviour, not external state.
> Anything that depends on what a third-party RDAP server happens to
> return today does not belong in CI.

---

## 1. The four kinds of test

| Kind | Where | Network | What it asserts | Run by default? |
|------|-------|---------|-----------------|------------------|
| **Unit** | `src/**/mod.rs` `#[cfg(test)]` | No | Pure transformations (parsing, normalisation, encoding, type-shape invariants). Deterministic. | Yes |
| **Integration (mocked)** | `crates/<x>/tests/*.rs` | No (mockito / wiremock) | End-to-end engine paths against a controlled fixture. Deterministic. | Yes |
| **Property** | `crates/<x>/tests/property.rs` (quickcheck / proptest) | No | Invariants under random inputs. Deterministic given a seed. | Yes |
| **Live** | `crates/rdapify/tests/live_tests.rs`, `loadtest/` | **Yes** | Smoke that the engine still talks to real registries. **Structural only.** | No (`#[ignore]`); CI cron daily |

The discipline is simple: prefer the kind highest in this table that
can prove the property you care about. **Do not use a live test to
validate something a unit test could prove.**

---

## 2. Hard rules

### 2.1 Do not rely on mutable upstream data

Anything an external RDAP server publishes can change without notice:

- A domain may be deregistered.
- A registry may stop publishing an optional field
  (we observed this with ARIN's `country` for `8.8.8.8` on
  2026-04-30).
- A name, status, or entity role may be edited.
- A registry may return a different response shape after a software
  upgrade.

**Tests must not break when any of those things happen.** If a test
*could* break because an upstream changed something you don't
control, the test is asserting the wrong thing.

### 2.2 Assert structure, not content

The only field guaranteed to be present, content-stable, and
engine-controlled in every RDAP response is `query` — because the
engine generates it from the input.

Allowed structural assertions on a live response:

```rust
assert_eq!(res.query, "example.com");          // engine echoes input
assert_eq!(res.query, 15169);                  // engine normalised "AS15169"
assert!(!res.query.is_empty());                // query was preserved
```

Forbidden content assertions on a live response:

```rust
assert_eq!(res.country.as_deref(), Some("US"));   // upstream-controlled
assert!(res.name.is_some());                       // optional field
assert!(!res.status.is_empty());                   // upstream-controlled
assert_eq!(res.entities.len(), 3);                 // upstream-controlled
```

If an assertion can be falsified by a registry edit you don't make,
it doesn't belong in a live test.

### 2.3 Prefer unit tests over live data

If you want to validate that the engine produces the right cache
key, the right punycode form, the right SSRF rejection, the right
retry timing — write a **unit test**. Live tests are the
last-resort smoke layer; they exist only to confirm the engine can
still establish a TLS connection, parse a real response, and round-
trip the `query` field. Everything richer is a unit test.

### 2.4 Live tests are gated by `#[ignore]`

Every live test must be tagged:

```rust
#[tokio::test]
#[ignore = "requires network — run with --ignored"]
async fn live_<thing>() { ... }
```

The default `cargo test --workspace` run must remain hermetic. Live
tests are run by `cargo test -- --ignored` manually or by the CI
cron job — never by default.

### 2.5 Engine logic gets a unit test alongside any live coverage

When you add a live test that touches engine logic — IDN encoding,
ASN normalisation, header handling, retry policy — write the
**pure unit test for that logic in the same PR**. The live test
becomes a smoke check; the unit test becomes the real validator.

---

## 3. Authoring checklist for a new live test

Before adding `#[ignore]`-marked live tests, tick all of:

- [ ] The behaviour I'm validating cannot be expressed as a unit
      test against a mockito / wiremock fixture.
- [ ] My assertions reference only the `query` field or non-content
      structural properties (presence vs absence is *also*
      content — see §2.2).
- [ ] My example input is **stable** (an IANA-reserved name, a
      well-known prefix like `8.8.8.8`, a long-standing ASN like
      `AS15169`) — not something that could be reassigned, deleted,
      or rebranded.
- [ ] If the engine logic under test has a pure transformation, I
      have **also** added a unit test for that transformation in
      the same PR (see §2.5).
- [ ] The test is `#[ignore]`-gated.
- [ ] Failure messages explain whether they indicate an engine bug
      or upstream data drift, so a future test engineer doesn't
      waste time chasing the wrong cause.

---

## 4. Reviewing a live-test failure

When a live test fails, classify it before fixing:

1. **Engine regression** — the engine produced wrong output for the
   same upstream response. Fix the engine; add the failing case as
   a unit test if possible.
2. **Upstream data drift** — the upstream changed; the engine still
   normalises correctly. Fix the *test* (loosen the assertion, pick
   a more stable example, or move to a unit test). Document the
   drift in the test comment with the date observed.
3. **Upstream outage** — the upstream is temporarily down. Re-run.
   If it persists, file a ticket with the registry and consider
   whether the test should not be a single-origin dependency.

Most "test failures" we have seen on this codebase are class 2.
A live test that flaps on data drift is calibration debt: every
flap pulls an engineer away from real work to confirm the engine
is fine. The fix is to weaken the assertion or move to a unit test.

---

## 5. Specific examples in this codebase

### 5.1 IDN / punycode

- **Pure unit tests** in
  [`crates/rdapify-client/src/lib.rs`](../crates/rdapify-client/src/lib.rs)
  `mod normalise_domain_tests` — assert `пример.com → xn--e1afmkfd.com`,
  `bücher.de → xn--bcher-kva.de`, `日本.jp → xn--wgv71a.jp`.
  Deterministic. No network. No registration dependency.
- **No live IDN test.** A live IDN test would conflate "engine
  encodes IDN correctly" with "the chosen IDN is registered in its
  TLD". The first is engine correctness; the second is a registrar
  decision.

### 5.2 ASN normalisation

- **Pure unit tests** in `crates/rdapify-client/src/lib.rs` (cache-
  key tests) cover the integer normalisation.
- **Live test** in `crates/rdapify/tests/live_tests.rs::live_asn_google`
  asserts only `query == 15169` after passing `"AS15169"`. Does
  **not** assert on `name` (optional, upstream-controlled).

### 5.3 IP queries

- **Live tests** assert only `query == <input>`. They do **not**
  assert on `country`, `name`, `handle`, or any other optional
  field.
- ARIN's RDAP shape for any specific IP is upstream policy and may
  evolve.

---

## 6. CI policy

| Job | Tests run | Purpose | Failure response |
|-----|-----------|---------|------------------|
| PR build (`cargo test --workspace --release`) | unit + mocked integration + property | Engine correctness. Hermetic, deterministic. | Block the PR. |
| Daily live cron (`cargo test -- --ignored`) | live tests | Smoke that real RDAP still works end-to-end. | File an issue if a class-1 (engine) regression; close as "upstream drift" if class 2. |
| Stage E load test (manual or scheduled) | `loadtest/harness` | SLO and capacity validation. | Trigger calibration review per [`docs/observability/CALIBRATION.md`](../docs/observability/CALIBRATION.md). |

PR builds **never** depend on the network. Anything that does is
not a PR-build test.

---

## 7. Quick reference

```rust
// GOOD — pure, deterministic, no network.
#[test]
fn idn_cyrillic_to_punycode() {
    assert_eq!(normalise_domain("пример.com").unwrap(), "xn--e1afmkfd.com");
}

// GOOD — live but structural only.
#[tokio::test]
#[ignore = "requires network — run with --ignored"]
async fn live_ip_google_dns_v4() {
    let res = client().ip("8.8.8.8").await.expect("IPv4 query failed");
    assert_eq!(res.query, "8.8.8.8");
}

// BAD — couples engine correctness to upstream data.
#[tokio::test]
#[ignore = "requires network — run with --ignored"]
async fn live_ip_google_dns_v4_BAD() {
    let res = client().ip("8.8.8.8").await.expect("IPv4 query failed");
    assert_eq!(res.country.as_deref(), Some("US"));   // upstream-controlled
}

// BAD — depends on whether пример.com is registered today.
#[tokio::test]
#[ignore = "requires network — run with --ignored"]
async fn live_domain_idn_unicode_BAD() {
    client().domain("пример.com").await.expect("...");   // 404 today
}
```

---

_Last updated: 2026-04-30. Authority: this document plus
[`docs/observability/CALIBRATION.md`](../docs/observability/CALIBRATION.md)
§7 ("When NOT to tune")._
