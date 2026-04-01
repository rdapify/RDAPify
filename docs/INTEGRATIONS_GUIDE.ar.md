# دليل تكاملات RDAPify

> آخر تحديث: 2026-03-25 | يتطلب Node.js 20+ | v0.3.2

يغطي هذا الدليل نشر rdapify في عشرة بيئات تشغيل مختلفة. كل قسم يجيب على: متى تستخدم هذه البيئة، وكيفية التثبيت، ومثال عملي مختصر، وملاحظات الإنتاج، والأخطاء الشائعة.

---

## جدول المحتويات

1. [Node.js (Express)](#1-nodejs-express)
2. [NestJS](#2-nestjs)
3. [GraphQL](#3-graphql)
4. [Cloudflare Workers](#4-cloudflare-workers)
5. [AWS Lambda](#5-aws-lambda)
6. [Azure Functions](#6-azure-functions)
7. [Google Cloud Run](#7-google-cloud-run)
8. [المتصفح (Browser)](#8-المتصفح-browser)
9. [Bun](#9-bun)
10. [Deno](#10-deno)

---

## 1. Node.js (Express)

### متى تستخدم هذه البيئة

خوادم HTTP التقليدية على Node.js. هذا هو نمط النشر الأكثر شيوعاً — عملية طويلة الأمد، نسخة مشتركة من العميل، وإمكانية الوصول الكاملة لـ Node.js API.

### التثبيت

```bash
npm install rdapify express
```

### مثال مختصر

يأتي rdapify مزوداً بمصنع middleware لـ Express يُضيف ثلاثة مسارات تلقائياً:

```typescript
import express from 'express';
import { RDAPClient, rdapifyExpress } from 'rdapify';

const app = express();
const client = new RDAPClient({ cache: true, timeout: 10000 });

// يُضيف: GET /domain/:name و GET /ip/:address و GET /asn/:number
app.use('/rdap', rdapifyExpress(client));

app.listen(3000);
```

للإضافة إلى router موجود مسبقاً:

```typescript
import { Router } from 'express';
import { rdapifyExpress } from 'rdapify';

const router = Router();
rdapifyExpress(client, router);  // يُعدِّل router في مكانه ويُعيده
export default router;
```

### ملاحظات الإنتاج

- هيِّئ `RDAPClient` مرة واحدة على مستوى الوحدة — وليس داخل كل طلب. العميل يحتفظ بـ bootstrap cache وحالة circuit breaker.
- اضبط `timeout` ليتوافق مع مهلة خادم Express. القيمة الافتراضية (30 ثانية) آمنة لكن اضبطها وفق متطلبات SLA.
- لاستخدام Redis للتخزين المؤقت، راجع [integrations/redis.md](integrations/redis.md).

### الأخطاء الشائعة

| الخطأ | الحل |
|-------|-------|
| استدعاء `new RDAPClient()` داخل معالج الطلب | انقله إلى مستوى الوحدة |
| إهمال معالجة `CircuitOpenError` | أضف try/catch وأعد 503 |
| استخدام `allowPrivateIPs: true` في الإنتاج | لا تُفعِّله أبداً — حماية SSRF إلزامية |
| استخدام `req.params.domain` مباشرة بدون تنظيف | `rdapifyExpress` يُنظِّفه تلقائياً؛ في المعالجات المخصصة نظِّف المدخلات أولاً |

---

## 2. NestJS

### متى تستخدم هذه البيئة

الخدمات المبنية على إطار عمل NestJS، سواء كانت خدمات متكاملة أو مصغَّرة. نمط Dynamic Module يتناسب بشكل نظيف مع نظام حقن الاعتمادية في NestJS.

### التثبيت

```bash
npm install rdapify @nestjs/common @nestjs/core
```

### مثال مختصر

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { RdapifyModule } from 'rdapify';

@Module({
  imports: [
    RdapifyModule.forRoot({
      cache: true,
      timeout: 10000,
    }),
  ],
})
export class AppModule {}
```

```typescript
// domain.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRdapClient } from 'rdapify';
import type { RDAPClient } from 'rdapify';

@Injectable()
export class DomainService {
  constructor(@InjectRdapClient() private readonly rdap: RDAPClient) {}

  async lookup(domain: string) {
    return this.rdap.domain(domain);
  }
}
```

رمز الحقن متاح للاستخدام المباشر:

```typescript
import { RDAPIFY_CLIENT_TOKEN } from 'rdapify';

// في provider مخصص:
{ provide: RDAPIFY_CLIENT_TOKEN, useValue: myClient }
```

### ملاحظات الإنتاج

- `RdapifyModule.forRoot()` يُسجِّل العميل كـ singleton provider. استورده مرة واحدة في `AppModule`.
- لا يحتاج NestJS إلى `@nestjs/axios` أو أي وحدة HTTP — rdapify يستخدم fetcher خاصاً به.

### الأخطاء الشائعة

| الخطأ | الحل |
|-------|-------|
| استيراد `RdapifyModule` في وحدات features متعددة | استورده مرة واحدة في `AppModule` فقط |
| استخدام `@Inject('RDAPIFY_CLIENT')` (نص نصي) | استخدم `@InjectRdapClient()` أو استورد `RDAPIFY_CLIENT_TOKEN` Symbol |
| نسيان `@Injectable()` على الخدمة | أضف `@Injectable()` |

---

## 3. GraphQL

### متى تستخدم هذه البيئة

عندما يعرض تطبيقك بالفعل نقطة نهاية GraphQL وتريد إتاحة بيانات RDAP عبر نفس المخطط. يعمل مع أي خادم GraphQL (graphql-yoga, Apollo, Mercurius).

### التثبيت

```bash
npm install rdapify graphql
# بالإضافة إلى خادم GraphQL، مثلاً:
npm install graphql-yoga
```

### مثال مختصر

```typescript
import { createServer } from '@graphql-yoga/node';
import { RDAPClient, createRdapifySchema } from 'rdapify';

const client = new RDAPClient({ cache: true });
const { typeDefs, resolvers } = createRdapifySchema(client);

const server = createServer({ typeDefs, resolvers });
server.start();
```

مثال استعلام:

```graphql
query {
  domain(name: "example.com") {
    name
    status
    expiresAt
    nameservers { name }
    registrant { name email }
  }

  ip(address: "1.1.1.1") {
    address
    network
    country
  }

  asn(number: 13335) {
    number
    name
    country
  }
}
```

لدمجه مع مخطط موجود:

```typescript
import { RDAPIFY_TYPE_DEFS, createRdapifySchema } from 'rdapify';
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';

const { typeDefs: rdapTypeDefs, resolvers: rdapResolvers } = createRdapifySchema(client);

const typeDefs = mergeTypeDefs([yourTypeDefs, rdapTypeDefs]);
const resolvers = mergeResolvers([yourResolvers, rdapResolvers]);
```

### ملاحظات الإنتاج

- `createRdapifySchema` يُعيد `{ typeDefs: string, resolvers: object }` عادياً — بدون أي ارتباط بخادم محدد.
- `RDAPIFY_TYPE_DEFS` هو سلسلة SDL الخام إذا أردت الاطلاع على المخطط أو توسيعه دون استدعاء المصنع.
- فعِّل Persisted Queries على خادم GraphQL لتجنب إعادة تحليل مخطط RDAP في كل طلب.

### الأخطاء الشائعة

| الخطأ | الحل |
|-------|-------|
| إنشاء `RDAPClient` جديد داخل كل resolver | مرر العميل إلى `createRdapifySchema` مرة واحدة |
| توقع وجود `registrant.email` بدون إعداد `privacy: false` | البريد الإلكتروني محجوب افتراضياً؛ خففه فقط إذا كان لديك أساس قانوني |
| دمج type definitions بالتسلسل النصي `+` | استخدم `mergeTypeDefs` من `@graphql-tools/merge` |

---

## 4. Cloudflare Workers

### متى تستخدم هذه البيئة

الحوسبة على الحافة (Edge) — بحثات RDAP موزعة عالمياً بزمن استجابة منخفض قريب من المستخدمين. لا تتوفر Node.js APIs؛ Workers تعمل على V8 فقط.

### التثبيت

```bash
npm install rdapify wrangler
```

### مثال مختصر

```typescript
// worker.ts
import { RDAPClient, CloudflareWorkersFetcher } from 'rdapify';

const client = new RDAPClient({
  fetcher: new CloudflareWorkersFetcher(),
  cache: false,        // Workers عديمة الحالة — لا يوجد cache دائم
  timeout: 8000,       // Workers لها حد 30 ثانية CPU؛ ابقِ مكالمات RDAP أقصر
});

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const domain = url.searchParams.get('domain');

    if (!domain) {
      return new Response(JSON.stringify({ error: 'Missing domain parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const result = await client.domain(domain);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: (err as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
```

```toml
# wrangler.toml
name = "rdap-worker"
main = "src/worker.ts"
compatibility_date = "2024-01-01"
```

### ملاحظات الإنتاج

- `CloudflareWorkersFetcher` يستخدم `globalThis.fetch` و `AbortSignal.timeout()` — كلاهما متاح أصلاً في Workers.
- حماية SSRF تعمل بشكل مختلف على الحافة: تعتمد الفحوصات المبنية على DNS على ما يحله runtime بالـ Workers. لا تعتمد على حماية SSRF وحدها — تحقق من المدخلات بقائمة سماح.
- لا تخزن حالة قابلة للتعديل في مستوى الوحدة خارج العميل.
- للتخزين المؤقت عبر الطلبات، استخدم [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) أو [KV](https://developers.cloudflare.com/kv/).

### الأخطاء الشائعة

| الخطأ | الحل |
|-------|-------|
| استخدام الـ Fetcher الافتراضي (يعتمد على `http` في Node.js) | مرر دائماً `new CloudflareWorkersFetcher()` |
| استخدام `cache: true` مع الذاكرة الداخلية الافتراضية | Workers عديمة الحالة؛ استخدم KV أو Cache API |
| قراءة `process.env` | استخدم `[vars]` في `wrangler.toml` أو معامل `env` في المعالج |
| تهيئة العميل داخل معالج `fetch` | انقل التهيئة إلى مستوى الوحدة — Workers تُعيد استخدام الوحدة عبر الطلبات |

---

## 5. AWS Lambda

### متى تستخدم هذه البيئة

نقاط نهاية HTTP أو مُشغَّلة بالأحداث على AWS. مناسبة لبحثات RDAP غير المتكررة أو المتفرقة حيث تدفع فقط مقابل ما تستخدمه.

### التثبيت

```bash
npm install rdapify
```

### مثال مختصر

```typescript
// handler.ts
import { RDAPClient, RDAPError } from 'rdapify';

// التهيئة خارج المعالج — يُعاد استخدامها عبر الاستدعاءات الدافئة
const client = new RDAPClient({
  cache: true,
  timeout: 8000,    // مهلة Lambda الافتراضية 3 ثوانٍ؛ ارفعها إلى 10 ثوانٍ على الأقل
});

interface APIGatewayEvent {
  pathParameters?: { type?: string; value?: string };
}

export const handler = async (event: APIGatewayEvent) => {
  const type = event.pathParameters?.type;
  const value = event.pathParameters?.value;

  if (!type || !value) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing path parameters' }) };
  }

  try {
    let result: unknown;
    if (type === 'domain')  result = await client.domain(value);
    else if (type === 'ip') result = await client.ip(value);
    else if (type === 'asn') result = await client.asn(Number(value));
    else return { statusCode: 400, body: JSON.stringify({ error: `Unknown type: ${type}` }) };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    };
  } catch (err) {
    const status = err instanceof RDAPError && err.statusCode ? err.statusCode : 500;
    return { statusCode: status, body: JSON.stringify({ error: (err as Error).message }) };
  }
};
```

### ملاحظات الإنتاج

- اضبط مهلة Lambda على **15 ثانية** على الأقل — استعلامات RDAP قد تستغرق 5–10 ثوانٍ لبعض السجلات البطيئة.
- استخدم معمارية **ARM64 (Graviton)** لتوفير ~20% من التكلفة بدون أي تعديل في الكود.
- اضبط الذاكرة على **512 MB** كحد أدنى — bootstrap cache والـ connection pool يستفيدان من مساحة heap أكبر.
- قالب SAM في `templates/cloud/aws_lambda/template.yaml` يحدد `Runtime: nodejs18.x` — غيِّره إلى `nodejs20.x`.

### الأخطاء الشائعة

| الخطأ | الحل |
|-------|-------|
| استدعاء `new RDAPClient()` داخل المعالج | انقله إلى مستوى الوحدة |
| مهلة Lambda أقصر من `client.timeout` | مهلة Lambda يجب أن تتجاوز `client.timeout` بعدة ثوانٍ |
| استخدام `require()` المتزامن داخل المعالج | انقل كل imports إلى المستوى الأعلى |
| إهمال التعامل مع Cold Starts | الاستدعاء الأول أبطأ؛ استخدم Provisioned Concurrency للحالات الحرجة |

---

## 6. Azure Functions

### متى تستخدم هذه البيئة

نقاط نهاية HTTP أو مُشغَّلة بالأحداث على Azure. النمط مشابه لـ Lambda لكنه يستخدم `function.json` للتوجيه.

### التثبيت

```bash
npm install rdapify
```

### مثال مختصر

```javascript
// index.js
const { RDAPClient, RDAPError } = require('rdapify');

// عميل على مستوى الوحدة — يُعاد استخدامه عبر الاستدعاءات الدافئة
const client = new RDAPClient({
  cache: true,
  timeout: 8000,
});

module.exports = async function (context, req) {
  const { queryType, value } = context.bindingData;

  try {
    let result;
    switch (queryType) {
      case 'domain': result = await client.domain(value); break;
      case 'ip':     result = await client.ip(value); break;
      case 'asn':    result = await client.asn(Number(value)); break;
      default:
        context.res = { status: 400, body: { error: `Unknown query type: ${queryType}` } };
        return;
    }
    context.res = { status: 200, body: result };
  } catch (err) {
    const status = err instanceof RDAPError && err.statusCode ? err.statusCode : 500;
    context.res = { status, body: { error: err.message } };
  }
};
```

```json
// function.json
{
  "bindings": [
    {
      "authLevel": "function",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["get"],
      "route": "{queryType}/{value}"
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}
```

```json
// host.json
{
  "version": "2.0",
  "functionTimeout": "00:00:30",
  "extensions": {
    "http": {
      "maxOutstandingRequests": 200,
      "maxConcurrentRequests": 100,
      "routePrefix": "api"
    }
  }
}
```

### ملاحظات الإنتاج

- `functionTimeout: "00:00:30"` — 30 ثانية هي الحد الأقصى لخطة Consumption. إذا احتجت أكثر، انتقل إلى Premium أو Dedicated.
- اضبط `FUNCTIONS_WORKER_PROCESS_COUNT` على `1` لتجنب تعدد نسخ العميل المتنافسة على نفس bootstrap cache.
- أوقات Cold Start على خطة Consumption عادةً 1–3 ثوانٍ. استخدم Premium للأعباء الحساسة للزمن.

### الأخطاء الشائعة

| الخطأ | الحل |
|-------|-------|
| الوصول إلى `req.params` بدلاً من `context.bindingData` | استخدم `context.bindingData.queryType` لمعاملات المسار |
| استخدام `async function` بدون `await` على مكالمة RDAP | دائماً استخدم `await` |
| تضمين مفاتيح Function كنصوص ثابتة | استخدم متغيرات البيئة عبر Application Settings |

---

## 7. Google Cloud Run

### متى تستخدم هذه البيئة

خدمات HTTP في حاويات على GCP. Cloud Run يتوسع تلقائياً وصولاً إلى الصفر، مما يجعله خياراً فعالاً من حيث التكلفة لواجهات RDAP ذات الحركة المتوسطة.

### التثبيت

```bash
npm install rdapify express
```

### مثال مختصر

```typescript
// server.ts
import express from 'express';
import { RDAPClient, rdapifyExpress } from 'rdapify';

const app = express();
const client = new RDAPClient({ cache: true, timeout: 10000 });

app.use('/rdap', rdapifyExpress(client));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const port = parseInt(process.env.PORT ?? '8080', 10);
app.listen(port, () => console.log(`Listening on port ${port}`));
```

```dockerfile
# Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
EXPOSE 8080
CMD ["node", "dist/server.js"]
```

نشر:

```bash
gcloud run deploy rdap-service \
  --image gcr.io/PROJECT_ID/rdap-service \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 100 \
  --port 8080
```

### ملاحظات الإنتاج

- دائماً اقرأ `process.env.PORT` — Cloud Run يحقنه ديناميكياً.
- اضبط `--min-instances 1` إذا كان زمن الاستجابة مهماً لتجنب Cold Starts.
- أول طلب على حاوية جديدة أبطأ بسبب تحميل bootstrap cache. مسار `/health` يُمكن استخدامه لتسخينه مسبقاً.
- الـ Dockerfile في `templates/cloud/google_cloud_run/Dockerfile` يستخدم `node:18-alpine` — غيِّره إلى `node:20-alpine`.

### الأخطاء الشائعة

| الخطأ | الحل |
|-------|-------|
| تضمين المنفذ `8080` كنص ثابت | استخدم `process.env.PORT ?? '8080'` |
| تشغيل الحاوية بصلاحيات root | أضف مستخدماً غير root في Dockerfile |
| غياب نقطة نهاية health check | أضف `GET /health` — Cloud Run يستخدمها للفحص |
| النشر بدون `.dockerignore` | استبعد `node_modules` و `.git` وملفات الاختبار |

---

## 8. المتصفح (Browser)

### متى تستخدم هذه البيئة

JavaScript على جانب العميل في المتصفح. نظراً لأن المتصفحات تُطبِّق CORS، لا يمكن لـ rdapify الوصول إلى سجلات RDAP مباشرة. يجب توجيه الطلبات عبر خادمك الخاص.

### التثبيت

```bash
npm install rdapify
```

### مثال مختصر

`BrowserFetcher` يُوجِّه جميع طلبات RDAP عبر URL بروكسي. البروكسي يُضيف `?url=<encoded-rdap-url>` ويُعيد توجيه الطلب من جانب الخادم:

```typescript
import { RDAPClient, BrowserFetcher } from 'rdapify';

const client = new RDAPClient({
  fetcher: new BrowserFetcher({ proxyUrl: 'https://your-api.example.com/rdap-proxy' }),
  cache: true,
  timeout: 15000,
});

const result = await client.domain('example.com');
// → المتصفح يستدعي: GET https://your-api.example.com/rdap-proxy?url=https%3A%2F%2Frdap.verisign.com%2F...
```

خادم بروكسي مختصر (Express):

```typescript
import express from 'express';
import { RDAPClient } from 'rdapify';

const app = express();
const client = new RDAPClient({ cache: true });

// رؤوس CORS مطلوبة للوصول من المتصفح
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.get('/rdap-proxy', async (req, res) => {
  const url = req.query.url as string;
  if (!url || !url.startsWith('https://')) {
    return res.status(400).json({ error: 'Invalid url parameter' });
  }
  // نفِّذ جلب RDAP من جانب الخادم هنا
  res.status(501).json({ error: 'Implement server-side RDAP fetch here' });
});
```

> في الممارسة العملية، انشر `rdapifyExpress(client)` على خادمك وأشر المتصفح إلى `/domain/:name` على خادمك بدلاً من استخدام `BrowserFetcher` مباشرة. `BrowserFetcher` مخصص للحالات المتقدمة التي تحتاج فيها إلى client API في المتصفح.

### ملاحظات الإنتاج

- يجب على خادم البروكسي **التحقق** من معامل `url` مقابل قائمة سماح من بوادئ خوادم RDAP المعروفة. لا تُوجِّه URLs عشوائية — هذا ثغرة SSRF.
- `Access-Control-Allow-Origin: *` مقبول لبيانات RDAP العامة. للبروكسيات المُوثَّقة، قيِّده بنطاقك.
- حجم bundle المتصفح: rdapify هو CommonJS. استخدم bundler (webpack, esbuild, Vite) مع tree-shaking للحصول على حجم output أصغر.

### الأخطاء الشائعة

| الخطأ | الحل |
|-------|-------|
| استخدام `RDAPClient` الافتراضي بدون `BrowserFetcher` | مرر دائماً `fetcher: new BrowserFetcher(...)` في بيئات المتصفح |
| خادم بروكسي يُعيد توجيه أي URL بدون تحقق | تحقق من معامل `url` مقابل قائمة سماح ثابتة |
| غياب رؤوس CORS على البروكسي | أضف `Access-Control-Allow-Origin: *` |
| توقع أن `privacy: true` تعمل بشكل مختلف في المتصفح | حجب PII يحدث على مستوى العميل ويعمل بشكل طبيعي؛ البروكسي ينقل البيانات فقط |

---

## 9. Bun

### متى تستخدم هذه البيئة

بديل Node.js متوافق مع TypeScript مدمج وبدء تشغيل أسرع. `BunFetcher` يستخدم `Bun.fetch` بدلاً من `http` في Node.js لأداء أفضل.

### التثبيت

```bash
bun add rdapify
```

### مثال مختصر

```typescript
import { RDAPClient, BunFetcher } from 'rdapify';

const client = new RDAPClient({
  fetcher: new BunFetcher(),
  cache: true,
  timeout: 10000,
});

const result = await client.domain('example.com');
console.log(result);
```

`BunFetcher` يكتشف البيئة تلقائياً:

```typescript
// BunFetcher.resolveFetch() يُعيد Bun.fetch عند توفره،
// ويعود إلى globalThis.fetch. لا حاجة لاكتشاف البيئة يدوياً.
const fetcher = new BunFetcher();
```

لخادم HTTP مختصر:

```typescript
import { RDAPClient, BunFetcher } from 'rdapify';

const client = new RDAPClient({ fetcher: new BunFetcher(), cache: true });

Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const domain = url.searchParams.get('domain');
    if (!domain) return new Response('Missing domain', { status: 400 });
    const result = await client.domain(domain);
    return Response.json(result);
  },
});
```

### ملاحظات الإنتاج

- Bun يدعم معظم Node.js APIs. للتحقق من التوافق، راجع [bun.sh/docs/runtime/nodejs-apis](https://bun.sh/docs/runtime/nodejs-apis).
- bootstrap cache والـ circuit breaker في `RDAPClient` يعملان بنفس الطريقة كما في Node.js.
- `Bun.serve` الأصلي يتفوق على Express على Bun. للخدمات الجديدة، يُفضَّل استخدامه.

### الأخطاء الشائعة

| الخطأ | الحل |
|-------|-------|
| استخدام الـ fetcher الافتراضي على Bun | مرر `fetcher: new BunFetcher()` لاستخدام `Bun.fetch` |
| دمج `Bun.serve` مع محول Express بشكل غير صحيح | `Bun.serve({ fetch: app.fetch })` يتطلب Express 5 أو shim؛ اختبر قبل النشر |
| افتراض أن `globalThis.Bun` متاح دائماً | `BunFetcher` يتعامل مع fallback — لا تُفعِّل الحماية يدوياً |

---

## 10. Deno

### متى تستخدم هذه البيئة

بيئة تشغيل آمنة بالافتراضي مع Web-standard APIs. `DenoFetcher` يستخدم `globalThis.fetch` (مدمج في Deno). لا حاجة لأي polyfills.

### التثبيت

```json
// deno.json
{
  "imports": {
    "rdapify": "npm:rdapify@0.3.2"
  }
}
```

أو مباشرة:

```typescript
import { RDAPClient, DenoFetcher } from 'npm:rdapify@0.3.2';
```

### مثال مختصر

```typescript
import { RDAPClient, DenoFetcher } from 'npm:rdapify@0.3.2';

const client = new RDAPClient({
  fetcher: new DenoFetcher(),
  cache: true,
  timeout: 10000,
});

const result = await client.domain('example.com');
console.log(result);
```

لخادم HTTP مختصر:

```typescript
import { RDAPClient, DenoFetcher } from 'npm:rdapify@0.3.2';

const client = new RDAPClient({ fetcher: new DenoFetcher(), cache: true });

Deno.serve({ port: 3000 }, async (req) => {
  const url = new URL(req.url);
  const domain = url.searchParams.get('domain');
  if (!domain) return new Response('Missing domain', { status: 400 });

  try {
    const result = await client.domain(domain);
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
});
```

التشغيل مع صلاحية الشبكة:

```bash
deno run --allow-net server.ts
```

### ملاحظات الإنتاج

- Deno يتطلب العلامة `--allow-net` الصريحة. في الإنتاج، قيِّدها بخوادم RDAP المحددة.
- Deno Deploy لا يدعم npm specifiers في جميع البيئات — اختبر قبل النشر.
- `DenoFetcher` يستخدم `globalThis.fetch` (معيار الويب). لا يعتمد على `http` في Node.js.

### الأخطاء الشائعة

| الخطأ | الحل |
|-------|-------|
| استخدام الـ fetcher الافتراضي على Deno | مرر `fetcher: new DenoFetcher()` |
| التشغيل بدون `--allow-net` | جميع وصول الشبكة يتطلب صلاحية صريحة |
| استخدام `require()` | Deno يدعم ESM فقط؛ استخدم `import` |
| افتراض التوافق الكامل مع npm | اختبر كل حزمة قبل النشر على Deno Deploy |

---

## اكتشاف بيئة التشغيل

إذا احتجت لاختيار fetcher بشكل ديناميكي بناءً على البيئة:

```typescript
import {
  RDAPClient,
  isCloudflareWorkers,
  isBun,
  isDeno,
  isBrowser,
  isNode,
  getRuntimeName,
  CloudflareWorkersFetcher,
  BunFetcher,
  DenoFetcher,
  BrowserFetcher,
} from 'rdapify';

function createFetcher() {
  if (isCloudflareWorkers()) return new CloudflareWorkersFetcher();
  if (isBun())               return new BunFetcher();
  if (isDeno())              return new DenoFetcher();
  if (isBrowser())           return new BrowserFetcher({ proxyUrl: '/rdap-proxy' });
  return undefined;           // الافتراضي لـ Node.js
}

const client = new RDAPClient({ fetcher: createFetcher(), cache: true });
console.log(`Running on: ${getRuntimeName()}`);
```

---

## معالجة الأخطاء عبر جميع البيئات

جميع البيئات تستخدم نفس فئات الأخطاء:

```typescript
import {
  RDAPError,
  RDAPNotFoundError,
  RDAPTimeoutError,
  RDAPValidationError,
  CircuitOpenError,
  QueryAbortedError,
} from 'rdapify';

try {
  const result = await client.domain('example.com');
} catch (err) {
  if (err instanceof RDAPNotFoundError) {
    // 404 من السجل — النطاق غير موجود أو غير متاح في RDAP
  } else if (err instanceof RDAPTimeoutError) {
    // تجاوز الطلب المهلة المحددة
  } else if (err instanceof CircuitOpenError) {
    // circuit breaker مفتوح — السجل معطَّل
    // err.registry يحتوي على السجل الذي تعطَّل
  } else if (err instanceof RDAPValidationError) {
    // المدخلات فشلت في التحقق — نطاق أو IP أو ASN غير صحيح
  } else if (err instanceof RDAPError) {
    // خطأ RDAP عام — تحقق من err.statusCode و err.message
  }
}
```

---

## وثائق ذات صلة

| الوثيقة | الوصف |
|---|---|
| [API_REFERENCE.md](API_REFERENCE.md) | مرجع API الكامل — جميع الصادرات والأنواع والخيارات |
| [MIGRATION_GUIDE.md](../MIGRATION_GUIDE.md) | الترقية من 0.x إلى 1.0.0 |
| [integrations/express.md](integrations/express.md) | دليل Express متعمق مع Multi-tenant والمراقبة و Redis |
| [integrations/nestjs.md](integrations/nestjs.md) | دليل NestJS متعمق |
| [integrations/bun.md](integrations/bun.md) | دليل Bun متعمق |
| [integrations/deno.md](integrations/deno.md) | دليل Deno متعمق |
| [integrations/cloudflare-workers.md](integrations/cloudflare-workers.md) | دليل Cloudflare Workers متعمق |
| [integrations/cloud/aws-lambda.md](integrations/cloud/aws-lambda.md) | دليل Lambda متعمق |
| [integrations/cloud/azure-functions.md](integrations/cloud/azure-functions.md) | دليل Azure Functions متعمق |
| [integrations/cloud/google-cloud-run.md](integrations/cloud/google-cloud-run.md) | دليل Cloud Run متعمق |
| [security/ssrf-prevention.md](security/ssrf-prevention.md) | آليات حماية SSRF الداخلية |
