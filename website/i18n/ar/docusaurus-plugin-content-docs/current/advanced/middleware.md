# Middleware / خطافات دورة الحياة

يكشف RDAPify عن ستة خطافات دورة حياة تُطلَق عند نقاط محددة في خط أنابيب الاستعلام. تُسجَّل الخطافات عبر خيار `middleware` في المُنشئ أو الطريقة السلسة `.use()` على نسخة `RDAPClient`.

---

## الخطافات المتاحة

```typescript
interface MiddlewareOptions {
  /** يُستدعى قبل كل استعلام، قبل البحث في التخزين المؤقت */
  beforeQuery?: (ctx: QueryContext) => Promise<void> | void;

  /** يُستدعى بعد استعلام ناجح (من الشبكة أو التخزين المؤقت) */
  afterQuery?: (ctx: QueryResultContext) => Promise<void> | void;

  /** يُستدعى عند رمي استعلام خطأً */
  onError?: (ctx: QueryResultContext) => Promise<void> | void;

  /** يُستدعى عندما يحتوي التخزين المؤقت على إدخال صالح للاستعلام */
  onCacheHit?: (ctx: QueryContext) => Promise<void> | void;

  /** يُستدعى عندما لا يحتوي التخزين المؤقت على إدخال للاستعلام */
  onCacheMiss?: (ctx: QueryContext) => Promise<void> | void;

  /** يُستدعى في كل مرة على وشك محاولة إعادة المحاولة */
  onRetry?: (ctx: QueryContext & { attempt: number; delay: number }) => Promise<void> | void;
}
```

---

## كائنات السياق

### `QueryContext`

```typescript
interface QueryContext {
  queryType:  'domain' | 'ip' | 'asn' | 'nameserver' | 'entity';
  query:      string;     // المدخل الخام (مثلاً 'example.com')
  normalized: string;     // الشكل المُعيَّر
  startTime:  number;     // Date.now() عند بداية الاستعلام
  cached?:    boolean;
  serverUrl?: string;     // عنوان URL لخادم RDAP (متاح بعد اكتشاف التمهيد)
  attempt?:   number;
}
```

### `QueryResultContext`

```typescript
interface QueryResultContext extends QueryContext {
  duration:  number;           // المللي ثانية المنقضية
  result?:   RDAPResponse;     // الاستجابة (غير معرّفة عند الخطأ)
  error?:    Error;            // الخطأ المرمي (غير معرّف عند النجاح)
  fromCache: boolean;
}
```

---

## التسجيل

### خيار المُنشئ

```typescript
const client = new RDAPClient({
  middleware: {
    beforeQuery(ctx) {
      console.log(`[${ctx.queryType}] ${ctx.query}`);
    },
    afterQuery(ctx) {
      console.log(`اكتمل في ${ctx.duration} مللي ثانية`);
    },
  },
});
```

### الطريقة السلسة `.use()`

```typescript
const client = new RDAPClient();

client.use({
  beforeQuery(ctx) {
    console.log(`استعلام ${ctx.queryType}: ${ctx.query}`);
  },
});

// تدعم .use() التسلسل لأنها تُعيد `this`
client
  .use({ afterQuery:  (ctx) => console.log(`${ctx.duration} مللي ثانية`) })
  .use({ onCacheHit:  (ctx) => console.log(`إصابة تخزين مؤقت: ${ctx.query}`) });
```

تُلغي استدعاءات `.use()` اللاحقة السابقة لنفس اسم الخطاف.

---

## عزل الأخطاء

يتم التقاط أخطاء الخطافات بصمت. الخطاف الفاشل **لا يوقف** خط أنابيب الاستعلام ولا يظهر للمستدعي أبداً:

```typescript
client.use({
  afterQuery(ctx) {
    throw new Error('خطأ في الخطاف'); // يُبتلع بصمت
  },
});

// الاستعلام لا يزال ينجح
const result = await client.domain('example.com');
```

---

## أمثلة عملية

### تسجيل الطلبات

```typescript
client.use({
  beforeQuery(ctx) {
    console.log(`بداية ${ctx.queryType} ${ctx.query} في ${new Date(ctx.startTime).toISOString()}`);
  },
  afterQuery(ctx) {
    const status = ctx.fromCache ? 'تخزين مؤقت' : 'شبكة';
    console.log(`نهاية   ${ctx.query} [${status}] ${ctx.duration} مللي ثانية`);
  },
  onError(ctx) {
    console.error(`خطأ ${ctx.query} — ${ctx.error?.message}`);
  },
});
```

### جمع المقاييس

```typescript
const counters = { hits: 0, misses: 0, errors: 0 };

client.use({
  onCacheHit()  { counters.hits++; },
  onCacheMiss() { counters.misses++; },
  onError()     { counters.errors++; },
});
```

### رؤية إعادة المحاولات

```typescript
client.use({
  onRetry(ctx) {
    console.warn(`إعادة المحاولة #${ctx.attempt} لـ ${ctx.query} بعد ${ctx.delay} مللي ثانية`);
  },
});
```

### التسجيل المنظم مع مُسجِّل مخصص

```typescript
import pino from 'pino';
const logger = pino();

client.use({
  beforeQuery(ctx) {
    logger.info({ queryType: ctx.queryType, query: ctx.query }, 'بداية استعلام rdap');
  },
  afterQuery(ctx) {
    logger.info(
      { query: ctx.query, durationMs: ctx.duration, fromCache: ctx.fromCache },
      'نهاية استعلام rdap',
    );
  },
  onError(ctx) {
    logger.error({ query: ctx.query, err: ctx.error }, 'فشل استعلام rdap');
  },
});
```

---

## فحص الخطافات المسجّلة

```typescript
const manager = client.getMiddlewareManager();

// أسماء الخطافات التي لديها معالجات حالياً
console.log(manager.getRegisteredHooks());
// ['beforeQuery', 'afterQuery', 'onError']

// إزالة جميع الخطافات
manager.clear();
```

---

## ملاحظات مهمة

- تعمل الخطافات في **الواجهة الخلفية لـ TypeScript فقط**. عندما يكون `backend: 'native'` نشطاً (باستخدام `rdapify-nd`)، يتم تجاوز الخطافات — خط أنابيب Rust لا يستدعي طبقة middleware لـ TypeScript.
- **لا** تُستدعى الخطافات لإصابات التخزين المؤقت التي تحدث قبل وصول الاستعلام إلى المُنسِّق (تخزين التمهيد المؤقت).
- يُطلَق `onRetry` قبل كل محاولة إعادة، وليس بعد الفشل الذي أطلقها.

---

## انظر أيضاً

- [RDAPClient — `.use()`](../api-reference/client.md#usehooks)
- [نوع MiddlewareOptions](../api-reference/types/options.md#middlewarehooksconfig)
