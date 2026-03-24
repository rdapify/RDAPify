# سجل التغييرات

توثيق جميع التغييرات الملحوظة في هذا المشروع.

الصيغة مبنية على [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
والمشروع يتبع [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [غير مُصدّر]

## [0.2.1] — 2026-03-23

### مضاف
- **`stream_asn()`** و **`stream_nameserver()`** — إكمال واجهة Streaming
- **rdapify-nd v0.1.3** — تحديث ربط Node.js
- **rdapify-py v0.2.1** — تحديث ربط Python

### تم إصلاحه
- تصحيح إصدار rdapify-py من 0.1.1 إلى 0.2.1

## [0.2.0] — 2026-03-22

### مضاف
- **واجهة Async Streaming** — `stream_domain()` و `stream_ip()` مع back-pressure
- **تكوين Connection pool** — `reuse_connections` و `max_connections_per_host`
- **Go binding** (`rdapify-go`) — دالف cgo أولية مع 5 دوال متزامنة
- **معيار Streaming** — `benches/streaming.rs` (Criterion)

## [0.1.3] — 2026-03-22

### مضاف
- **`domain_available()`** — فحص توفر النطاق عبر RDAP
- **`AvailabilityResult`** — نوع مُصدَّر
- **`custom_bootstrap_servers`** — تجاوز خادم RDAP مخصص
- 11 اختبار تكامل جديد

## [0.1.2] — 2026-03-21

### تم تغييره
- إعادة تسمية Node.js binding: `@rdapify/core` → `rdapify-nd`
- إعادة تسمية Python binding: `rdapify` → `rdapify-py`
- أداء: `OnceLock<RdapClient>` singleton في rdapify-nd

### تم إصلاحه
- CI: إصلاح هدف `aarch64-apple-darwin` المكرر

## [0.1.1] — 2026-03-21

### تم إصلاحه
- **أمان**: ترقية `idna` لحل GHSA لمعالجة تسمية النطاق غير الصحيحة
- **أمان**: ترقية `rustls-webpki` لحل GHSA لاستنزاف CPU
- **CI**: إصلاح وظيفة MSRV وlive-test workflow

### تم تغييره
- سير عمل CI/CD للروابط ينشر تلقائياً على tags

## [0.1.0] — 2026-03-20

### مضاف
- **5 أنواع استعلام** عبر `RdapClient`: `domain()` و `ip()` و `asn()` و `nameserver()` و `entity()`
- **IANA Bootstrap** (RFC 9224) — اكتشاف خادم RDAP تلقائي
- **حماية SSRF** — حجب العناوين الخاصة وloopback وlink-local
- **ذاكرة مؤقتة** — `DashMap` مع TTL قابل للتكوين
- **IDN / Punycode** — عبر `idna` crate (RFC 5891)
- **إعادة محاولة** — exponential back-off
- **CLI** — `rdapify domain/ip/asn/nameserver/entity`
- **ربط Node.js** (`rdapify-nd`) عبر napi-rs
- **ربط Python** (`rdapify-py`) عبر PyO3 + maturin
- 43 اختبار تكامل، CI متعدد المنصات، سير عمل إصدار آلي

---

[Unreleased]: https://github.com/rdapify/rdapify-rs/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/rdapify/rdapify-rs/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/rdapify/rdapify-rs/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/rdapify/rdapify-rs/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/rdapify/rdapify-rs/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/rdapify/rdapify-rs/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/rdapify/rdapify-rs/releases/tag/v0.1.0

© 2026 RDAPify Contributors
