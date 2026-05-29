# سجل التغييرات

توثيق جميع التغييرات الملحوظة في هذا المشروع.

الصيغة مبنية على [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
والمشروع يتبع [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [غير مُصدّر]

## [0.7.0] — 2026-05-29 — أساس الأداء والأمان

> **إصدار التحصين الموحّد لما قبل 1.0.** إغلاقٌ كاملٌ لمحيط SSRF، ومحرّك تخزين
> مؤقت عالي الأداء (Moka)، وحلّ ccSLD مطابقٌ للبروتوكول، وحذف 3,442 سطرًا من
> الديون التقنية — في خطّ أساسٍ واحدٍ مُراجَع. حجم ثنائي `rdapify` بعد التجريد:
> **3.48 ميبي‌بايت** (ضمن ميزانية 4 ميبي‌بايت). **405 اختبارًا ناجحًا**، وفحوصات
> `clippy` و`fmt` نظيفة. لا توجد تغييرات كاسِرة على الواجهات العامة.

### 🔒 تحصين الأمان

- توجيه كل حركة الخروج عبر `secure_request` المُدقَّق: التحقق من عنوان الـ IP بعد
  دقّة الـ DNS وقبل الاتصال، وإعادة التحقق من كل قفزة إعادة توجيه (إغلاق ثغرة
  SSRF عبر إعادة التوجيه).
- **تثبيت دقّة الـ DNS وقت الاتصال** عبر `SecureResolver` — يُغلق ثغرة إعادة ربط
  الـ DNS (DNS rebinding TOCTOU)، مع `.no_proxy()` لمنع الالتفاف عبر وكيلٍ بيئي.
- **تطبيع عناوين IPv4 المُضمَّنة في IPv6** (مثل `::ffff:192.168.1.1`) قبل التصنيف
  — إغلاق تجاوزٍ للمرشّحات نحو عناوين loopback/خاصة/محلية/بيانات وصفية.
- توجيه تنزيلات bootstrap من IANA عبر نفس مسار `secure_request`.

### ⚡ الأداء والتخزين المؤقت

- **محرّك Moka للتخزين المؤقت**: استبدال الإخلاء اليدوي بكلفة `O(n)` بمحرّك Moka
  المتزامن — إخلاء TinyLFU بكلفة `O(1)` مُستهلَكة، مع انتهاء صلاحيةٍ لكل مدخل.
  (كان Moka مرتبطًا مسبقًا، فالكلفة الإضافية ضئيلة.)
- **`CachePolicy` ذكية**: احترام `Cache-Control: max-age` مع تقييده ضمن نطاقٍ آمن
  (حدٌّ أدنى يمنع إبطال التخزين المؤقت العدائي)، وقيمٌ افتراضية لكل نوع استعلام
  (النطاقات ساعة واحدة · عناوين IP/ASN 24 ساعة)، وتخزينٌ سلبيّ لأخطاء 404.

### 🏛️ المعمارية والتنظيف

- **مطابقة ccSLD وفق RFC 7484** (أطول لاحقة) عبر فهرس `HashMap` بكلفة `O(1)` —
  حلٌّ صحيحٌ لنطاقاتٍ مثل `example.co.uk`.
- التحقق عبر قائمة اللواحق العامة (PSL) خلف ميزة `psl-validation` (مُعطَّلة
  افتراضيًا للحفاظ على حجم الثنائي).
- حذف شجرة `/src/` اليتيمة (22 ملفًا، 3,442 سطرًا من التعليمات الميتة).

### 📦 مقاييس الإصدار

| المقياس | القيمة |
|---|---|
| ثنائي `rdapify` (إصدار مُجرَّد) | **3.48 ميبي‌بايت** (✅ < 4 ميبي‌بايت) |
| الاختبارات | **405 ناجحًا**، 0 فاشلًا |
| ملف تعريف الإصدار | `lto = true` · `codegen-units = 1` · `strip` · `panic = "abort"` |
| الإصدار الموحّد | جميع حزم مساحة العمل على `0.7.0` |

## [0.5.0] — 2026-04-08

### الأداء
- استبدال التنفيذ القائم على chunks بـ `buffer_unordered` في `rdap-batch` — معالجة batch أسرع 3–10×
- تنفيذ batch streaming مع ذاكرة O(1) بغض النظر عن حجم المدخلات
- واجهة `BatchExecutor::run_stream()` الجديدة — النتائج تصل فور توفرها عبر `ReceiverStream`
- تحسين `rdapify-client` لدمج rate limiting في مسار الاستعلام

### مضاف
- **`rdap-rate-limit`**: تطبيق GCRA الكامل عبر `governor` — محدودات لكل مضيف وعالمية
  - `RdapRateLimiter` مع حالة `DashMap` لكل مضيف
  - `RateLimitConfig` بإعدادات افتراضية معقولة (10 req/s / 20 burst لكل مضيف، 100 req/s عالمي)
- **`rdap-batch`**: تعداد `BatchQuery` يشمل `Domain` و `Ip` و `Asn` و `Nameserver`
- **`rdap-types`**: متغير `RdapError::RateLimited { host, wait_time }` + دالة `is_rate_limited()`
- **`rdap-service`**: واجهة HTTP كاملة مع نقطة نهاية Prometheus (`/metrics`)، إيقاف تشغيل سلس
- **`rdapify-client`**: حقل `ClientConfig::rate_limit: Option<RateLimitConfig>`
- 188 اختبار إجمالي (36 اختبار تكامل جديد + 6 اختبارات streaming)
- معايير جديدة: `batch.rs` و `bootstrap.rs` و `validation.rs`
- `QUICKSTART.md` — دليل البدء السريع
- `docs/CLI.md` — مرجع CLI محدث
- مكدس مراقبة Prometheus + Grafana في `deploy/monitoring/`

### تم إصلاحه
- اختناق تزامن chunk في محرك batch (لم تعد الاستعلامات البطيئة تعطل chunk كاملاً)
- غياب فرض rate limit في مسار استعلام العميل

### rdapify-nd / rdapify-py
- **rdapify-nd 0.5.0** — تحديث ربط Node.js N-API
- **rdapify-py 0.5.0** — تحديث ربط Python PyO3

## [0.4.0] — 2026-04-06

### مضاف
- **مساحة عمل 11-crate** — `rdap-types` و `rdap-security` و `rdap-bootstrap` و `rdap-core` و `rdapify-client` و `rdap-cache` و `rdap-stream` و `rdap-rate-limit` و `rdap-batch` و `rdap-cli` و `rdapify`
- **`rdap-config`** — نظام تكوين `rdapify.toml` مع تجاوزات متغيرات البيئة
- **`rdap-logging`** — تسجيل JSON/نص منظم
- **`rdap-service`** — هيكل خدمة HTTP عبر axum (`/health` و `/version`)
- علامات الميزات: `memory-cache` و `stream` و `batch` و `rate-limit` و `service` و `sqlite`
- **ثبات SQLite المُقوّى** — WAL، فحوصات السلامة، ترحيل المخطط
- **rdapify-nd 0.4.0** — تحديث ربط Node.js N-API
- **rdapify-py 0.4.0** — تحديث ربط Python PyO3

### الأمان
- حماية SSRF في `rdap-security` (التحقق من URL + pre-resolution DNS)
- حماية من DNS rebinding
- التحقق من سلسلة إعادة التوجيه HTTP
- حد حجم الاستجابة القابل للتكوين
- `#![forbid(unsafe_code)]` على جميع crates

### الأداء
- ذاكرة مؤقتة DashMap مع TTL (`rdap-cache`)
- `opt-level = "z"` و LTO و strip و `panic = "abort"` في إصدار الإنتاج
- معايير Criterion: `cache` و `ssrf` و `query` و `streaming` و `batch` و `bootstrap`

### داخلي
- رفع MSRV إلى **1.77**
- CI متعدد المنصات (Ubuntu، macOS، Windows)
- فرض `cargo clippy --workspace -- -D warnings`

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

[Unreleased]: https://github.com/rdapify/rdapify-rs/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/rdapify/rdapify-rs/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/rdapify/rdapify-rs/compare/v0.2.1...v0.4.0
[0.2.1]: https://github.com/rdapify/rdapify-rs/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/rdapify/rdapify-rs/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/rdapify/rdapify-rs/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/rdapify/rdapify-rs/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/rdapify/rdapify-rs/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/rdapify/rdapify-rs/releases/tag/v0.1.0

© 2026 RDAPify Contributors
