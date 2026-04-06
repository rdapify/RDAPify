# سجل التغييرات

توثيق جميع التغييرات الملحوظة في هذا المشروع.

الصيغة مبنية على [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
وهذا المشروع يتبع [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [غير مُصدّر]

## [0.4.0] - 2026-04-06

### الأمان

- حماية SSRF محسّنة: عناوين IPv4 المخططة إلى IPv6 (`::ffff:`) يتم حجبها الآن بشكل صحيح بغض النظر عن حالة الأحرف
- إضافة CGN (RFC 6598, 100.64.0.0/10) إلى قائمة النطاقات الخاصة المحجوبة
- إضافة اختبارات انحدار لـ IPv4-mapped IPv6 bypass و CGN range

### تم تغييره

- الترخيص تم تغييره من MIT إلى Apache-2.0
- MSRV (Minimum Supported Rust Version) تم تحديثه إلى 1.77 في rdapify-rust

### التوثيق

- تم تحديث جدول التوافق في README
- إضافة PERFORMANCE_SPEC.md
- تحديث التوثيق العربي (README.ar.md) مع تغيير الترخيص

## [0.3.2] - 2026-03-24

### تم إصلاحه
- `TelemetryExporter`: `RDAPIFY_VERSION` يُقرأ الآن من `package.json` (كان `'0.2.3'`)
- `src/index.ts`: JSDoc `@version` صُحّح إلى `0.3.2`
- تصدير `VERSION` حُدّث إلى `'0.3.2'`
- قوالب cloud ومثال `express_app` حُدّثت إلى `^0.3.1`
- `SECURITY.md`: 0.2.x و 0.3.x مدعومان الآن

### داخلي
- خطاف `prepublishOnly` أُعيد تفعيله
- `docs.yml`: أُزيلت حلول `|| true`

## [0.3.1] - 2026-03-23

### مهملة
- `client.getBatchProcessor()` (`DEP_RDAPIFY_0001`) — استخدم `client.streamBatch()`

### مضاف
- تحليل استقرار API — 83 تصديراً مصنّفاً
- `BrowserFetcher` — منتقي RDAP متوافق مع المتصفح

### تم تغييره
- إصلاح promise rejection غير معالج في `BatchProcessor.processBatch()`

## [0.3.0] - 2026-03-22

### مضاف
- **Streaming Batch API** — `client.streamBatch()` مولّد async
- **Prometheus Exporter** — مع `createHttpHandler()`
- **قالب Grafana** — `RDAPIFY_GRAFANA_DASHBOARD`
- **OpenTelemetry OTLP** — `TelemetryExporter`
- **Bootstrap متعدد المناطق** — `regions`
- **أداة الإيقاف** — `deprecated()`
- 42 اختبار جديد

## [0.2.3] - 2026-03-22

### مضاف
- **مخطط GraphQL** — `createRdapifySchema(client)`
- **وسيط Express** — `rdapifyExpress(client)`
- **وحدة NestJS** — `RdapifyModule.forRoot()`
- 24 اختبار جديد

## [0.2.2] - 2026-03-22

> **ملاحظة:** الإصدارات 0.1.9 إلى 0.2.2 نُشرت دفعة واحدة (2026-03-22) من نفس الـ commit.

### مضاف
- **دعم Deno** — `DenoFetcher`
- **Cloudflare Workers** — `CloudflareWorkersFetcher`
- **تصدير الحزمة** — `./worker` و `./deno` و `./node`
- 22 اختبار جديد

## [0.2.1] - 2026-03-22

### مضاف
- **دعم Bun** — `BunFetcher` مع `isBun()`
- 14 اختبار جديد

## [0.2.0] - 2026-03-22

### مضاف
- **قاطع الدائرة** — `CircuitBreaker`
- **إيقاف Middleware** — `ctx.abort()`
- **أولوية Middleware** — ترتيب رقمي
- **ضغط مفاتيح Redis** — SHA-256
- **Redis pipeline** — `getMany`/`setMany`
- **HTTP/2** — اختياري
- 63 اختبار جديد

## [0.1.9] - 2026-03-22

### مضاف
- **توفر النطاق** — `client.checkAvailability()` و `checkAvailabilityBatch()`
- **اختبارات تكامل مباشرة** — `LIVE_TESTS=1`
- **إعداد Bootstrap متقدم** — `customServers` و `ttl` و `fallback`
- 17 اختبار جديد

## [0.1.8] - 2026-03-21

### مضاف
- **Rust native backend** — عبر `rdapify-nd`
- **خيار `backend`** — `'auto'` | `'native'` | `'typescript'`
- 28 اختبار جديد

## [0.1.7] - 2026-03-19

### تم إصلاحه
- مزامنة Playground، Jest forceExit، اختبارات redis-cache

### مضاف
- استعلامات Nameserver و Entity مع أوامر CLI

## [0.1.6] - 2026-03-17

### مضاف
- أداة CLI — `rdapify domain/ip/asn`
- كشف Cloudflare Workers

### تم إصلاحه
- RedisCache.clear() و size() (حرج) — إصلاح مسح DB الكامل

## [0.1.5] - 2026-03-14

### مضاف
- RedisCache، AuthenticationManager، ProxyManager، CompressionManager
- PersistentCache، MiddlewareManager، QueryDeduplicator، AuditLogger، ResponseValidator

## [0.1.4] - 2026-03-13

### مضاف
- MiddlewareHooks، QueryDeduplicator، AuditLogger، ResponseValidator

## [0.1.3] - 2026-03-12

### تم إصلاحه
- فحوصات null دفاعية في Normalizer و BootstrapDiscovery و Fetcher
- مهلة ConnectionPool، نسخ عميق PIIRedactor، أقواس IPv6، حماية القسمة على صفر

## [0.1.2] - 2026-01-28

### مضاف
- Playground تفاعلي، Connection Pooling، مقاييس ومراقبة، تسجيل منظم

## [0.1.1] - 2026-01-25

### مضاف
- مصادقة، دعم Proxy، ضغط الاستجابة، استراتيجيات إعادة المحاولة
- أولوية الاستعلامات، التحقق المحسّن، Persistent Cache، Rate Limiting

## [0.1.0] - 2025-12-05

### مضاف
- الإصدار العام الأول — عميل RDAP مع domain و IP و ASN
- IANA Bootstrap، حماية SSRF، حذف PII، ذاكرة مؤقتة، 146 اختبار

## [0.1.0-alpha.4] - 2026-01-23

### مضاف
- Dependabot، CI/CD محسّن، CodeQL، Playground، ملفات صحة المجتمع

## [0.1.0-alpha.2] - 2026-01-22

### تم إصلاحه
- إلغاء مؤقت timeout في `withTimeout()`

## [0.1.0-alpha.1] - 2026-01-22

### مضاف
- إصدار alpha الأول — عميل RDAP، حماية SSRF، حذف PII، 146 اختبار

---

[Unreleased]: https://github.com/rdapify/RDAPify/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/rdapify/RDAPify/compare/v0.3.2...v0.4.0
[0.3.2]: https://github.com/rdapify/RDAPify/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/rdapify/RDAPify/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/rdapify/RDAPify/compare/v0.2.3...v0.3.0
[0.2.3]: https://github.com/rdapify/RDAPify/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/rdapify/RDAPify/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/rdapify/RDAPify/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/rdapify/RDAPify/compare/v0.1.9...v0.2.0
[0.1.9]: https://github.com/rdapify/RDAPify/compare/v0.1.8...v0.1.9
[0.1.8]: https://github.com/rdapify/RDAPify/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/rdapify/RDAPify/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/rdapify/RDAPify/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/rdapify/RDAPify/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/rdapify/RDAPify/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/rdapify/RDAPify/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/rdapify/RDAPify/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/rdapify/RDAPify/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/rdapify/RDAPify/compare/v0.1.0-alpha.4...v0.1.0
[0.1.0-alpha.4]: https://github.com/rdapify/RDAPify/compare/v0.1.0-alpha.2...v0.1.0-alpha.4
[0.1.0-alpha.2]: https://github.com/rdapify/RDAPify/compare/v0.1.0-alpha.1...v0.1.0-alpha.2
[0.1.0-alpha.1]: https://github.com/rdapify/RDAPify/releases/tag/v0.1.0-alpha.1
