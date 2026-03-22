# معالجة الأخطاء

تُصدر RDAPify أخطاءً مكتوبة تعكس حالات فشل محددة. تستخدم جميع طرق الاستعلام الخمس (`domain` و`ip` و`asn` و`nameserver` و`entity`) تسلسل هرمي موحداً للأخطاء.

---

## فئات الأخطاء

```typescript
import {
  ValidationError,
  SSRFError,
  BootstrapError,
  FetchError,
  NativeBackendError,
} from 'rdapify';
```

| الفئة | السبب |
|-------|-------|
| `ValidationError` | مدخل غير صالح — نطاق أو عنوان IP أو ASN مشوّه |
| `SSRFError` | الهدف محجوب بواسطة حماية SSRF (IP خاصة، loopback، link-local) |
| `BootstrapError` | فشل في اكتشاف خادم RDAP الموثوق من سجل bootstrap التابع لـ IANA |
| `FetchError` | خطأ شبكي، أو استجابة HTTP غير 2xx، أو انتهاء مهلة الطلب — بعد استنفاد جميع محاولات الإعادة المضبوطة |
| `NativeBackendError` | `rdapify-nd` غير متاح وقد تم ضبط `backend: 'native'` عند الإنشاء |

جميع فئات الأخطاء ترث من `Error` المدمج وتحمل سلسلة `message`.

---

## التعامل الأساسي مع try / catch

```typescript
import { RDAPClient, ValidationError, FetchError, SSRFError } from 'rdapify';

const client = new RDAPClient();

try {
  const result = await client.domain('example.com');
  console.log(result.query, result.registrar?.name);
} catch (error) {
  if (error instanceof ValidationError) {
    // مدخل غير صحيح — لا تعيد المحاولة
    console.error('Invalid domain:', error.message);
  } else if (error instanceof SSRFError) {
    // أمان: الهدف عنوان خاص أو محجوز
    console.error('SSRF blocked:', error.message);
  } else if (error instanceof FetchError) {
    // خطأ شبكي أو خطأ في السجل — تمت استنفاد محاولات الإعادة
    console.error('Fetch failed:', error.message);
  } else if (error instanceof BootstrapError) {
    // تعذّر الوصول إلى نقطة bootstrap التابعة لـ IANA
    console.error('Bootstrap failed:', error.message);
  } else {
    throw error; // غير متوقع — أعد الرمي
  }
}
```

---

## سلوك إعادة المحاولة

تُعيد RDAPify المحاولة تلقائياً عند الأعطال العابرة. السياسة الافتراضية هي:

```typescript
{
  maxAttempts: 3,
  initialDelay: 1000,    // ثانية واحدة
  maxDelay: 10000,       // 10 ثوان
  backoff: 'exponential',
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
}
```

عندما يُصدر العميل `FetchError`، يكون قد استنفد بالفعل جميع محاولات الإعادة المضبوطة.

لا يتم إعادة المحاولة أبداً مع `ValidationError` و`SSRFError` — إذ تمثّلان حالات لن تتغير عند إعادة المحاولة.

### تخصيص محاولات الإعادة

```typescript
const client = new RDAPClient({
  retry: {
    maxAttempts: 5,
    initialDelay: 500,
    backoff: 'exponential',
  },
});

// تعطيل إعادة المحاولة كلياً
const client = new RDAPClient({ retry: false });
```

---

## رؤية إعادة المحاولة عبر الخطافات

استخدم خطاف `onRetry` لمتابعة أحداث إعادة المحاولة دون تعديل سلوكها:

```typescript
client.use({
  onRetry(ctx) {
    console.warn(`Retry #${ctx.attempt} for ${ctx.query} in ${ctx.delay} ms`);
  },
  onError(ctx) {
    console.error(`${ctx.query} failed: ${ctx.error?.message}`);
  },
});
```

---

## المهل الزمنية

اضبط مهل الطلبات عند الإنشاء:

```typescript
const client = new RDAPClient({
  timeout: 5000,  // 5 ثوان تُطبَّق على الاتصال والطلب وDNS
});

// أو بشكل أكثر دقة:
const client = new RDAPClient({
  timeout: {
    connect: 3000,
    request: 8000,
    dns: 2000,
  },
});
```

الطلب الذي تنتهي مهلته يتبع سياسة الإعادة — إذا انتهت مهلة جميع المحاولات، يُصدر `FetchError`.

---

## حماية SSRF

حماية SSRF مفعّلة افتراضياً وتحجب الاستعلامات الموجهة إلى:

- نطاقات IPv4 الخاصة (RFC 1918): `10.0.0.0/8`، `172.16.0.0/12`، `192.168.0.0/16`
- Loopback: `127.0.0.0/8`، `::1`
- Link-local: `169.254.0.0/16`

هذه تُصدر `SSRFError` فوراً دون أي إعادة محاولة:

```typescript
try {
  await client.ip('192.168.1.1');
} catch (error) {
  // error instanceof SSRFError === true
}
```

للسماح بنقاط نهاية RDAP داخلية محددة (مثلاً للاختبار على مرآة خاصة):

```typescript
const client = new RDAPClient({
  ssrfProtection: {
    enabled: true,
    allowedDomains: ['rdap-mirror.internal.corp.example.com'],
  },
});
```

---

## أعطال Bootstrap

يُصدر `BootstrapError` عندما يتعذر على العميل تحديد خادم RDAP المطلوب للاستعلام — إما أن بيانات bootstrap التابعة لـ IANA غير متاحة أو أن TLD/RIR غير موجود.

إذا كانت IANA غير قابلة للوصول في بيئتك، يمكنك نسخ ملفات bootstrap محلياً وتوجيه العميل إلى مرآتك:

```typescript
const client = new RDAPClient({
  bootstrapUrl: 'https://rdap-bootstrap.internal.corp.example.com',
});
```

---

## أخطاء الواجهة الخلفية الأصيلة

عند ضبط `backend: 'native'`، يُصدر العميل `NativeBackendError` عند الإنشاء إذا لم يكن `rdapify-nd` مثبتاً:

```typescript
try {
  const client = new RDAPClient({ backend: 'native' });
} catch (error) {
  // NativeBackendError: rdapify-nd is not installed
}
```

استخدم `backend: 'auto'` (الافتراضي) للرجوع تلقائياً إلى الواجهة الخلفية TypeScript عند غياب `rdapify-nd`.

---

## نمط التدهور التدريجي

```typescript
import { RDAPClient, FetchError, BootstrapError } from 'rdapify';

const client = new RDAPClient();

async function safeDomainLookup(domain: string) {
  try {
    return await client.domain(domain);
  } catch (error) {
    if (error instanceof FetchError || error instanceof BootstrapError) {
      // أعد null ودع المُستدعي يقرر كيفية التعامل مع عدم التوفر
      return null;
    }
    throw error;
  }
}

const result = await safeDomainLookup('example.com');
if (result === null) {
  console.warn('RDAP lookup unavailable — skipping');
}
```

---

## انظر أيضاً

- [خيارات الإعادة](../api-reference/types/options.md#retryoptions)
- [خيارات المهلة الزمنية](../api-reference/types/options.md#timeoutoptions)
- [خيارات حماية SSRF](../api-reference/types/options.md#ssrfprotectionoptions)
- [خطافات Middleware — `onError` و`onRetry`](../advanced/middleware.md)
