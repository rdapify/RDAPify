# سجل التغييرات

توثيق جميع التغييرات الملحوظة في هذا المشروع في هذا الملف.

الصيغة مبنية على [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
وهذا المشروع يتبع [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [غير مُصدّر]

## [1.0.0] - مخطط فبراير 2027

### الملخص
إصدار API freeze. واجهة `RDAPClient` مستقرة ومضمونة عدم وجود تغييرات breaking في الإصدارات اللاحقة 1.x. جميع 83 تصديراً عاماً مصنفة في `API_STABILITY_ANALYSIS.md`.

### الميزات البارزة
- **تغطية الفروع**: ≥ 90% (1066 اختبار).
- **API freeze**: 83 تصديراً مقفولة؛ جميع APIs المهملة محذوفة.
- **دعم Runtime**: Node.js (مؤكد)، Bun/Deno/Cloudflare Workers (تم التحقق خارجياً).
- **تدقيق الأمان**: تم حل جميع النتائج الحرجة/العالية (يتطلب اكتمال التدقيق الخارجي).
- **التوثيق**: وثائق عربية وإنجليزية كاملة على rdapify.com.

### تغييرات Breaking (من 0.3.1)
جميع APIs المجهزة بـ `@deprecated` في v0.3.1 محذوفة في v1.0.0.
انظر `MIGRATION_1_0.md` (سيتم نشره مع الإصدار).

## [0.3.1] - غير مُصدّر

### مهملة

APIs التالية مهملة اعتباراً من v0.3.1 وسيتم إزالتها أو تغييرها في v1.0.0.
قوائم المسارات البديلة مدرجة. التحذيرات صادرة عبر `process.emitWarning` (Node.js)
أو `console.warn` (runtimes أخرى) في معظم الأحوال مرة واحدة لكل lifetime العملية.

| API | كود الإيقاف | الهجرة |
|-----|-----------|--------|
| `client.getBatchProcessor()` | `DEP_RDAPIFY_0001` | استخدم `client.streamBatch()` للحصول على نتائج streaming أو استدعاء `processBatch()` عبر معالج الدفعات. في v1.0.0، ستكون `processBatch()` طريقة مباشرة على `RDAPClient`. |

### مضاف

- **تحليل استقرار API** — `API_STABILITY_ANALYSIS.md` في دليل التخطيط الداخلي يصنف جميع 83 تصديراً عاماً كـ Stable / Evolving / Deprecated لـ API freeze v1.0.0؛ تفاصيل مسارات الهجرة لكل API مهملة
- **`BrowserFetcher`** — منتقي RDAP متوافق مع المتصفح يوجه الطلبات عبر وكيل عكسي يدعم CORS من المطور؛ يستخدم فقط Web-standard APIs (`fetch` و `AbortSignal` و `URLSearchParams`)؛ يفعّل rdapify في بيئات React و Vue و Angular و vanilla browser
- **نوع `BrowserFetcherOptions`** — `{ proxyUrl: string; timeout?: number; headers?: Record<string, string> }`

### تم تغييره

- تم تحديث JSDoc فئة `BatchProcessor` ليعكس حالتها المتطورة؛ استيرادات فئة مباشرة يجب أن تفضّل `client.streamBatch()` أو طرق الراحة المضافة في v1.0.0
- تم إصلاح promise rejection غير معالج في `BatchProcessor.processBatch()` عند `continueOnError: false` — `.finally()` على promise الداخلي كان ينشئ promise مرفوض معلق؛ تم استبداله بـ `.then(cleanup, cleanup)` لإزالة آمنة للعناصر المكتملة من قائمة في-التقدم

## [0.3.0] - أكتوبر 2026

### مضاف

- **Streaming Batch API**: `client.streamBatch(queries[])` — `AsyncIterable<QueryResult>` مع back-pressure (لا overflow في 1000+ استعلام)
- **Prometheus Exporter**: فئة `PrometheusExporter` مع `createHttpHandler()` لـ metrics scraping
- **لوحة معلومات Grafana**: قالب JSON مدمج `RDAPIFY_GRAFANA_DASHBOARD` — استيراد مباشر إلى Grafana
- **OpenTelemetry Traces**: `TelemetryExporter` + `ClientConfig.telemetry.endpoint` للتتبع الموزع
- **Bootstrap متعدد المناطق**: `ClientConfig.bootstrap.regions: ['us', 'eu', 'ap']` — اختيار تلقائي لأقرب مرآة IANA
- **محرك الإيقاف**: أداة `deprecated()` — تحذير وقت التشغيل عبر `process.emitWarning`
- **BrowserFetcher**: منتقي متوافق مع المتصفح لبيئات proxy-based browser

### تم تصحيحه

- تم إصلاح promise rejection غير معالج في batch processor
- تحسينات الأداء على connection pooling
- تحسينات دقة اختبار التغطية

## [0.2.3] - سبتمبر 2026

### مضاف

- **مخطط GraphQL**: `{ typeDefs, resolvers }` — يعمل مع graphql-yoga وأي خادم GraphQL
- **وسيط Express**: `rdapifyExpress(client)` — `GET /domain/:name` و `/ip/:address` و `/asn/:number`
- **وحدة NestJS**: `RdapifyModule.forRoot(config)` + decorator `@InjectRdapClient()`

## [0.2.2] - أغسطس 2026

### مضاف

- **دعم Deno**: `DenoFetcher` مع اكتشاف runtime `isDeno()`
- **Cloudflare Workers**: `CloudflareWorkersFetcher` — بدون اعتماديات `fs` أو `process`
- **تصدير الحزمة**: نقاط دخول `./worker` و `./deno` و `./node`

## [0.2.1] - يوليو 2026

### مضاف

- **BunFetcher**: `BunFetcher implements IFetcherPort` — استخدام `Bun.fetch`
- **CI**: وظيفة Bun المضافة إلى `.github/workflows/ci.yml`

## [0.2.0] - يونيو 2026

### مضاف

- **قاطع الدائرة**: الحالة الكاملة `closed → open → half-open → closed/open`
- **Redis Pipeline**: batch `getMany`/`setMany` + ضغط مفاتيح SHA-256
- **Middleware `ctx.abort()`**: يمكن لخطافات `beforeQuery` إيقاف الاستعلامات
- **أولوية Middleware**: ترتيب الأولوية الرقمي (الأقل = أولوية أعلى)
- **دعم HTTP/2**: اختياري عبر `ClientConfig.http2: boolean`

## [0.1.9] - إبريل 2026

### مضاف

- **توفر النطاق**: `client.checkAvailability(domain)` — RDAP فقط
- **التوفر بالدفعات**: `client.checkAvailabilityBatch(domains[])` — دفعة متزامنة
- **اختبارات التكامل المباشرة**: إختيار عبر `LIVE_TESTS=1`
- **إعداد Bootstrap متقدم**: `customServers` و override `ttl`

## [0.1.8] - مارس 2026

### مضاف

- **CLI Tool**: `rdapify domain/ip/asn/nameserver/entity` مع flags
- **استعلامات Nameserver و Entity**: `client.nameserver()` و `client.entity()` مع دعم RDAP الكامل

## [0.1.7] - فبراير 2026

### مضاف

- **أداة CLI**: دعم domain و ip و asn
- **مسارات دخول معكوسة**: تحسينات إضافية

## [0.1.6] - يناير 2026

### مضاف

- **دعم IPv6**: معالجة كاملة للعناوين IPv6
- **تحسينات التحقق**: تحسينات validation

## [0.1.5] - ديسمبر 2025

### مضاف

- **Audit Logging**: مسار تدقيق GDPR/SOC2/CCPA
- **تحسينات الأداء**: تحسينات connection pooling

## [0.1.4] - نوفمبر 2025

### مضاف

- **دعم Proxy**: HTTP/HTTPS/SOCKS4/SOCKS5
- **مصادقة متقدمة**: Basic/Bearer/API Key/OAuth2

## [0.1.3] - أكتوبر 2025

### مضاف

- **ضغط الاستجابة**: gzip/brotli/deflate
- **استراتيجيات إعادة المحاولة**: Circuit breaker مع exponential backoff

## [0.1.2] - سبتمبر 2025

### مضاف

- **Connection Pooling**: إعادة استخدام اتصال HTTP
- **مراقبة ومقاييس**: جمع مقاييس شامل
- **تسجيل منظم**: مستويات قابلة للتكوين

## [0.1.1] - أغسطس 2025

### مضاف

- **Persistent Cache**: ذاكرة مؤقتة قائمة على ملفات JSON
- **Redis Cache**: محول Redis
- **مصادقة**: Basic و Bearer Token و API Key

## [0.1.0] - يوليو 2025

### مضاف

- **عميل RDAP الأساسي**: استعلامات Domain و IP و ASN
- **حماية SSRF**: حجب IPs الخاصة والداخلية
- **حذف PII**: حذف تلقائي للبيانات الشخصية
- **ذاكرة مؤقتة داخل الذاكرة**: ذاكرة مؤقتة LRU مع TTL
- **Normalization**: تطبيع الاستجابة عبر السجلات
- **TypeScript Strict**: تعريفات نوع كاملة

---

تم تعديل آخر: مارس 2026
