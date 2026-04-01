# دليل الترقية — من 0.x إلى 1.0.0

يُساعدك هذا الدليل على الترقية من أي إصدار `rdapify` 0.x إلى الإصدار 1.0.0.
اقرأه كاملًا قبل ترقية أي بيئة إنتاجية.

> **الإصدار المستهدف:** `rdapify@1.0.0` · `rdapify-rust@1.0.0` · `@rdapify/pro@1.0.0`
> **الموعد المستهدف:** فبراير 2027
> **الحالة:** يُحدَّث هذا الدليل مع استقرار الـ API في 1.0.0. بعض التفاصيل
> لا تزال مُعلَّمة بـ *مخطَّط* حيث لم تُحسم القرارات النهائية بعد.

---

## جدول المحتويات

1. [نظرة عامة](#1-نظرة-عامة)
2. [مسارات الترقية المدعومة](#2-مسارات-الترقية-المدعومة)
3. [التغييرات الجذرية](#3-التغييرات-الجذرية)
4. [الإعدادات الافتراضية الجديدة وتغييرات السلوك](#4-الإعدادات-الافتراضية-الجديدة-وتغييرات-السلوك)
5. [تغييرات الترخيص والتفعيل](#5-تغييرات-الترخيص-والتفعيل)
6. [تغييرات النشر والبنية التحتية](#6-تغييرات-النشر-والبنية-التحتية)
7. [دليل الترقية خطوة بخطوة](#7-دليل-الترقية-خطوة-بخطوة)
8. [مصفوفة التوافق](#8-مصفوفة-التوافق)
9. [استكشاف الأخطاء وإصلاحها](#9-استكشاف-الأخطاء-وإصلاحها)
10. [الحصول على المساعدة](#10-الحصول-على-المساعدة)

---

## 1. نظرة عامة

### لماذا 1.0.0؟

يُمثّل الإصدار 1.0.0 تعهّد الاستقرار العام لـ RDAPify. وهو يعني:

- **الـ API العام مُجمَّد.** لن تُدخَل أي تغييرات جذرية دون إصدار رئيسي جديد.
- **الوضع الأمني تم التحقق منه.** اكتمل تدقيق أمني خارجي وتمت معالجة جميع النتائج.
- **نظام الترخيص جاهز للإنتاج.** تم تنفيذ التفعيل الأولوي عبر الإنترنت وفترات السماح دون اتصال والامتدادات الطارئة واختبارها بالكامل.
- **توافق الحزم المتقاطعة مُطبَّق.** `rdapify` و`rdapify-rust` و`rdapify-nd` و`rdapify-py` و`@rdapify/pro` تُصدر مجتمعةً وتُختبر كنظام متكامل.

### ما الذي تغيّر من حيث المفهوم

| المجال | الحالة في 0.x | الحالة في 1.0.0 |
|--------|--------------|----------------|
| استقرار الـ API | في تطور؛ تغييرات جذرية بين الإصدارات الثانوية | مُجمَّد حتى الإصدار 2.0.0 |
| قاطع الدائرة | كلاس مُصدَّر؛ التوصيل اختياري | مُفعَّل تلقائيًا لكل سجل |
| Batch API | `getBatchProcessor()` + `processBatch()` | `streamBatch()` + `client.processBatch()` مباشرةً |
| اسم الارتباط الأصيل | `@rdapify/core` (npm) | `rdapify-nd` (npm) |
| اسم ارتباط Python | `rdapify` (PyPI) | `rdapify-py` (PyPI) |
| التحقق من ترخيص Pro | أولوية للوضع غير المتصل (قابل للاستغلال) | تفعيل أولوي عبر الإنترنت مع كاش محلي موقَّع |
| الإعداد الافتراضي لـ `onlineValidation` | غير متسق (true في JS و false في Rust) | `false` بشكل متسق |
| الحد الأدنى لإصدار Node.js | `>=18.0.0` (غير متسق عبر القوالب) | `>=20.0.0` مُطبَّق |
| رأس User-Agent | نص إصدار مُضمَّن | ديناميكي: `RDAPify/{version}` |

### من يحتاج لقراءة هذا الدليل

- **كل من يستخدم `rdapify` 0.x مباشرةً.** اقرأ على الأقل §3 (التغييرات الجذرية) و§7 (خطوة بخطوة).
- **كل من يستخدم `@rdapify/pro` 0.x.** اقرأ أيضًا §5 (تغييرات الترخيص والتفعيل) و§6 (النشر).
- **فرق DevOps والمنصات.** اقرأ §6 (النشر) لمعرفة تغييرات متغيرات البيئة والـ CI.
- **مستخدمو `rdapify-nd` أو `rdapify-py`.** اقرأ §3.3 و§3.4 لتفاصيل إعادة التسمية.

---

## 2. مسارات الترقية المدعومة

| من | إلى | المسار | ملاحظات |
|----|-----|--------|---------|
| **0.3.x** | 1.0.0 | مباشر | المسار الموصى به. حلّ جميع تحذيرات الإهمال قبل الترقية. |
| **0.2.x** | 1.0.0 | الترقية إلى 0.3.x أولًا | مطلوب — يُصدر 0.3.x تحذيرات إهمال لجميع الـ API المحذوفة. |
| **0.1.x** | 1.0.0 | غير مدعوم مباشرةً | الترقية: 0.2.x → 0.3.x → 1.0.0. تتراكم تغييرات جذرية متعددة. |

> **لماذا المسار المرحلي؟**
> صُمِّم 0.3.x خصيصًا كجسر ترقية. يُضيف `streamBatch()`،
> ويُصدر `DeprecationWarning` لكل API محذوف، ويوثّق كل مسار ترقية.
> محاولة الترقية المباشرة من 0.1.x إلى 1.0.0 تعني مواجهة جميع التغييرات الجذرية
> دفعة واحدة دون سياق تحذيري. قم بالترقية إلى 0.3.x أولًا.

---

## 3. التغييرات الجذرية

### 3.1 — حذف `client.getBatchProcessor()`

**كود الإهمال:** `DEP_RDAPIFY_0001` (يُصدر منذ v0.3.1)

**ما الذي تغيّر:** تم حذف الأسلوب `getBatchProcessor()` من `RDAPClient`.
أصبح `processBatch()` أسلوبًا مباشرًا على `RDAPClient`.

**لماذا:** أجبر نمط الوصول غير المباشر المستخدمين على إدارة نسخة `BatchProcessor`
بشكل صريح. في 1.0.0، يُعدّ `processBatch()` و`streamBatch()` أساليب أولى على العميل.

**قبل (0.x):**
```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();
const processor = client.getBatchProcessor();

const results = await processor.processBatch([
  { type: 'domain', query: 'example.com' },
  { type: 'ip', query: '8.8.8.8' },
]);
```

**بعد (1.0.0):**
```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

// الخيار أ — streaming (موصى به للمجموعات الكبيرة)
for await (const result of client.streamBatch([
  { type: 'domain', query: 'example.com' },
  { type: 'ip', query: '8.8.8.8' },
])) {
  if (result.success) {
    console.log(result.data);
  }
}

// الخيار ب — جمع جميع النتائج (للمجموعات الصغيرة فقط)
const results = await client.processBatch([
  { type: 'domain', query: 'example.com' },
  { type: 'ip', query: '8.8.8.8' },
]);
```

**كيفية الاكتشاف قبل الترقية:** شغّل كودك بإصدار 0.3.x وراقب تحذيرات عملية Node.js
للكود `DEP_RDAPIFY_0001`. أي استدعاء لـ `client.getBatchProcessor()` سيُصدر التحذير مرة واحدة.

---

### 3.2 — حذف الاستيراد المباشر لـ `BatchProcessor` من الـ API العام

**ما الذي تغيّر:** لم يعد `BatchProcessor` مُصدَّرًا من جذر الحزمة.
أصبح كلاسًا داخليًا.

**لماذا:** مع توفر `processBatch()` و`streamBatch()` مباشرةً على `RDAPClient`،
أصبح استيراد `BatchProcessor` مباشرةً ثغرة هروب متقدمة غير ضرورية
ولم تكن جزءًا من سطح الـ API المستقر.

**قبل (0.x):**
```typescript
import { BatchProcessor } from 'rdapify';

const processor = new BatchProcessor(client, { concurrency: 10 });
const results = await processor.processBatch(requests);
```

**بعد (1.0.0):**
```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({ concurrency: 10 });
const results = await client.processBatch(requests);
```

---

### 3.3 — إعادة تسمية الارتباط الأصيل لـ Node.js: `@rdapify/core` → `rdapify-nd`

**ما الذي تغيّر:** أُعيدت تسمية حزمة npm لارتباط Rust الأصيل لـ Node.js
من `@rdapify/core` إلى `rdapify-nd`. الحزمة القديمة مُهمَلة على npm مع تحذير تثبيت.

**لماذا:** كان الاسم المُدرج `@rdapify/core` مُضلِّلًا — "النواة" هي المكتبة TypeScript
(`rdapify`)، وليس الارتباط الأصيل. `rdapify-nd` (Node Dispatch) يصف الدور بدقة.

**قبل (0.x):**
```bash
npm install @rdapify/core
```
```typescript
import { RDAPClient } from 'rdapify';
// @rdapify/core يُكتشف تلقائيًا إن كان مثبتًا
```

**بعد (1.0.0):**
```bash
npm install rdapify-nd
```
```typescript
import { RDAPClient } from 'rdapify';
// rdapify-nd يُكتشف تلقائيًا إن كان مثبتًا (نفس الاختيار التلقائي، اسم حزمة جديد)
```

إذا كنت تُحدد خيار `backend` صراحةً:
```typescript
// قبل
const client = new RDAPClient({ backend: 'native' }); // يتطلب @rdapify/core

// بعد — نفس الخيار، حزمة أساسية جديدة
const client = new RDAPClient({ backend: 'native' }); // يتطلب rdapify-nd
```

**الإجراء المطلوب:** حدّث `package.json`:
```diff
 "dependencies": {
-  "@rdapify/core": "^0.1.2",
+  "rdapify-nd": "^1.0.0"
 }
```

---

### 3.4 — إعادة تسمية ارتباط Python: `rdapify` → `rdapify-py`؛ الاستيراد عبر `rdapify_py`

**ما الذي تغيّر:** أُعيدت تسمية حزمة Python على PyPI من `rdapify` إلى `rdapify-py`.
تغيّر اسم الوحدة في Python من `rdapify` إلى `rdapify_py`.

**لماذا:** تعارض اسم PyPI `rdapify` مع هوية المكتبة الأصلية. `rdapify-py`
يتبع نفس نمط التسمية كـ `rdapify-nd` ويوضّح المنظومة.

**قبل (0.x):**
```bash
pip install rdapify
```
```python
import rdapify

result = rdapify.domain("example.com")
```

**بعد (1.0.0):**
```bash
pip install rdapify-py
```
```python
import rdapify_py as rdap

result = rdap.domain("example.com")
print(result["registrar"]["name"])
```

**الإجراء المطلوب:** حدّث `requirements.txt` وأي أوامر `pip install`.
حزمة PyPI القديمة `rdapify` مُهمَلة ولن تتلقى تحديثات إضافية.

---

### 3.5 — رفع الحد الأدنى لتبعية `@rdapify/pro` إلى `rdapify >= 1.0.0`

**ما الذي تغيّر:** يتطلب `@rdapify/pro@1.0.0` الإصدار `rdapify@>=1.0.0` كتبعية نظير.
لم يعد نطاق 0.x (الإصدار `>=0.2.0`) مدعومًا.

**لماذا:** يُغيّر تجميد الـ API في 1.0.0 عقد واجهة الإضافات `client.use()`.
يعتمد `@rdapify/pro` على استقرار هذه الواجهة.

**الإجراء المطلوب:**
```bash
npm install rdapify@^1.0.0 @rdapify/pro@^1.0.0
```

---

### 3.6 — رفع الحد الأدنى لإصدار Node.js إلى 20

**ما الذي تغيّر:** يتطلب `rdapify@1.0.0` الإصدار Node.js 20 أو أحدث. حقل `engines`
في `package.json` يُطبّق هذا.

**قبل (0.x):** `"engines": { "node": ">=18.0.0" }` (بعض القوالب كانت `>=16.0.0`)

**بعد (1.0.0):** `"engines": { "node": ">=20.0.0" }`

**الإجراء المطلوب:** إذا كانت بيئتك تعمل بـ Node.js 18، قم بالترقية إلى Node.js 20 (LTS) قبل
ترقية rdapify. Node.js 20 متاح منذ أبريل 2023 ويصل إلى نهاية دعم LTS في أبريل 2026 —
يُوصى بـ Node.js 22 للنشر الجديد.

---

## 4. الإعدادات الافتراضية الجديدة وتغييرات السلوك

هذه ليست API محذوفة بل تغييرات سلوك قد تؤثر على الكود الحالي بصمت.

### 4.1 — تفعيل قاطع الدائرة افتراضيًا (لكل سجل)

في 0.2.0، كان `CircuitBreaker` مُصدَّرًا ككلاس مستقل يمكن للمستخدمين توصيله يدويًا.
في 1.0.0، يُوصَّل قاطع الدائرة تلقائيًا لكل سجل RDAP داخل `Fetcher`.

**الإعداد الافتراضي:**
```typescript
// هذه هي إعدادات قاطع الدائرة الافتراضية في 1.0.0 — تُطبَّق تلقائيًا
{
  failureThreshold: 5,   // يفتح بعد 5 إخفاقات متتالية ضمن النافذة الزمنية
  successThreshold: 1,   // يُغلق بعد نجاح واحد في الحالة نصف-المفتوحة
  halfOpenTimeout: 30_000, // 30 ثانية قبل محاولة الاسترداد
  window: 60_000,         // تُنسى الإخفاقات الأقدم من 60 ثانية
}
```

**ما يعنيه هذا عمليًا:** إذا أعاد سجل RDAP (مثل خادم Verisign لـ `.com`) 5 إخفاقات متتالية،
فسيتوقف rdapify عن إرسال طلبات إلى ذلك السجل لمدة 30 ثانية ويُعيد `CircuitOpenError` فورًا.
الطلبات إلى السجلات الأخرى لا تتأثر.

**لتعطيله أو ضبطه:**
```typescript
import { RDAPClient } from 'rdapify';

// تعطيل كامل
const client = new RDAPClient({
  circuitBreaker: false,
});

// حدود مخصصة
const client = new RDAPClient({
  circuitBreaker: {
    failureThreshold: 10,
    halfOpenTimeout: 60_000,
  },
});
```

**مراقبة حالة قاطع الدائرة:**
```typescript
const stats = client.getCircuitBreakerStats();
// يُعيد: Map<registryHost, { state, failureCount, lastOpenedAt }>

for (const [host, stat] of stats) {
  console.log(`${host}: ${stat.state}`);
}
```

---

### 4.2 — توحيد الإعداد الافتراضي لـ `onlineValidation` إلى `false` في `@rdapify/pro`

في Pro 0.2.1 وما قبله، كان `onlineValidation` يُعيَّن افتراضيًا إلى `true` في مُغلِّف JavaScript
لكن إلى `false` في نواة Rust — مما تسبب في سلوك غير متسق حسب طريقة ضبط الخيار.
اعتبارًا من Pro 0.2.2، أصبح `false` في كل مكان.

في 1.0.0 يُطبَّق هذا: `onlineValidation: false` يعني "استخدام كاش فترة السماح دون اتصال
(30 يومًا)؛ التحقق عبر الإنترنت فقط عند غياب الكاش أو انتهاء صلاحيته."

**إذا احتجت التحقق عبر الإنترنت في كل استدعاء** (مثلًا في CI/CD للكشف الفوري عن الإلغاء):
```typescript
const plugin = await ProPlugin({
  licenseKey: process.env.RDAPIFY_LICENSE_KEY,
  onlineValidation: true, // اشتراك صريح للإجبار على الاتصال
});
```

---

### 4.3 — تغيير تنسيق رأس User-Agent

**قبل (0.x):** `User-Agent: RDAPify/0.1.7` (نص إصدار مُضمَّن)

**بعد (1.0.0):** `User-Agent: RDAPify/{current-version}` (ديناميكي من ثابت `VERSION`)

يؤثر هذا على أي سجلات خوادم RDAP أو أدوات مراقبة تحلّل حقل User-Agent.
تغيير التنسيق مقصود ويبقى مستقرًا في 1.0.0.

---

### 4.4 — بقاء القياس عن بُعد اختياريًا، بلا تغيير

`UsageTelemetry` مُعطَّل افتراضيًا ويتطلب استدعاء `UsageTelemetry.enable()` صراحةً.
لا تُدرج أي بيانات PII في حمولات القياس (لا أسماء نطاقات، لا عناوين IP —
فقط عدادات مجهولة وبيانات وصفية للبيئة).

لا يتغير هذا السلوك في 1.0.0. إذا كان لديك `UsageTelemetry.enable()` في كودك،
سيستمر القياس. للتعطيل الصريح:

```typescript
import { UsageTelemetry } from 'rdapify';

UsageTelemetry.disable(); // لاغية، آمن الاستدعاء بغض النظر عن الحالة الحالية
```

---

### 4.5 — لا يمكن تعطيل `SSRF protection` في 1.0.0

**تغيير مخطَّط.** في 0.x، يمكن تعطيل حماية SSRF عبر `{ ssrfProtection: false }`.
في 1.0.0، تكون حماية SSRF دائمًا مُفعَّلة. يقبل خيار `ssrfProtection` فقط كائن
إعداد — تمرير `false` سيُطلق استثناءً عند الإنشاء.

إذا كنت تُمرّر عناوين IP خاصة لسجلات RDAP داخلية (مثلًا في بيئة اختبار)،
استخدم خيار bootstrap `customServers` لتجاوز الاكتشاف (لا تزال الطلبات تتحقق من SSL)
أو أعِدّ وكيلًا عبر `ProxyManager`.

---

## 5. تغييرات الترخيص والتفعيل

يسري هذا القسم على مستخدمي `@rdapify/pro`.

### 5.1 — التفعيل عبر الإنترنت إلزامي عند الاستخدام الأول

**ما الذي تغيّر:** في المرة الأولى التي يُستدعى فيها `ProPlugin()` بمفتاح ترخيص جديد
على جهاز معين، يجب أن **يصل** إلى `api.rdapify.dev` لإتمام التفعيل.
لا يوجد اختصار دون اتصال للتفعيل الأول.

**لماذا:** الإصدارات السابقة (0.1.x وبعض 0.2.x) فكّت حمولة مفتاح الترخيص
محليًا واعتمدت فقط على تاريخ انتهاء صلاحية المفتاح ذاته. لأن توقيع HMAC لم يُتحقق منه
دون اتصال، كان بإمكان أي مطوّر رأى مفتاحًا حقيقيًا تزوير أي خطة. التفعيل الأولوي
عبر الإنترنت يسدّ هذه الثغرة نهائيًا.

**ما تحتاج إلى فعله:**
- تأكد من إمكانية الوصول إلى `api.rdapify.dev` من بيئة نشرك أثناء التفعيل الأول.
  هذا متطلب لمرة واحدة لكل جهاز ولكل مفتاح ترخيص.
- في البيئات المُحوِّية، يجب تثبيت مجلد كاش التفعيل
  (`~/.rdapify/activation/`) كوحدة تخزين دائمة لتجنب إعادة التفعيل
  عند كل إعادة تشغيل للحاوية.

---

### 5.2 — فترة السماح دون اتصال: 30 يومًا

بعد أول تفعيل ناجح عبر الإنترنت، يُخزِّن rdapify سجل تفعيل موقَّعًا بـ HMAC-SHA256 محليًا:

```
~/.rdapify/activation/{key-id}.json
```

الفترة الافتراضية للسماح هي **30 يومًا**. خلال فترة السماح، يتم كل التحقق
محليًا — بلا استدعاء شبكة، بلا تأخير.

عند نهاية فترة السماح، يحاول rdapify التجديد عبر الإنترنت. إذا كانت الـ API
غير متاحة أثناء التجديد، يُمنح **امتداد طارئ لمدة 7 أيام** تلقائيًا ويُسجَّل تحذير.

لضبط فترة السماح:
```typescript
const plugin = await ProPlugin({
  licenseKey: process.env.RDAPIFY_LICENSE_KEY,
  gracePeriodDays: 14, // نافذة أقصر للبيئات الأكثر صرامة
});
```

---

### 5.3 — الكشف عن التلاعب بكاش التفعيل

سجل التفعيل المحلي موقَّع بـ HMAC. إذا تم تعديل الملف (يدويًا أو بأداة نظام)،
يكتشف استدعاء التحقق التالي التلاعب، يحذف السجل الفاسد، ويطلب إعادة التفعيل عبر الإنترنت.

```
[@rdapify/pro] Activation token tampered. Online re-activation required.
```

هذا متوقع وآمن — يعني استدعاء شبكة واحد إضافي.

---

### 5.4 — ماذا يحدث عند فشل التحقق عبر الإنترنت

| السيناريو | النتيجة |
|-----------|--------|
| التفعيل الأول، الـ API غير متاحة | خطأ: `"License API unreachable"`. لم تتهيأ الإضافة. |
| فترة السماح نشطة، الـ API غير متاحة | نجاح التحقق دون اتصال. لا خطأ. |
| انتهت فترة السماح، الـ API غير متاحة | يُمنح امتداد طارئ لـ 7 أيام. يُسجَّل تحذير. |
| انتهت فترة السماح + انتهى الطارئ | خطأ: `"License key has expired"`. |
| مفتاح الترخيص مُلغى (قاعدة بيانات D1) | خطأ: `"License revoked"` عند التحقق عبر الإنترنت التالي. |
| مفتاح الترخيص منتهي الصلاحية | خطأ: `"License key has expired"`. يُحذف الكاش. |

---

### 5.5 — مفتاح الترخيص في متغيرات البيئة

مرّر دائمًا مفتاح الترخيص عبر متغير بيئة، لا تُضمِّنه في الكود:

```typescript
// صحيح
const plugin = await ProPlugin({
  licenseKey: process.env.RDAPIFY_LICENSE_KEY,
});

// خطأ — يُلتزم المفتاح بالكود المصدري
const plugin = await ProPlugin({
  licenseKey: 'RDAP-PRO-xxxxx-xxxxx',
});
```

في بيئات CI/CD حيث تريد تطبيق الإلغاء فورًا:
```typescript
const plugin = await ProPlugin({
  licenseKey: process.env.RDAPIFY_LICENSE_KEY,
  onlineValidation: true, // يتجاوز الكاش المحلي في كل بناء
});
```

---

## 6. تغييرات النشر والبنية التحتية

### 6.1 — متغيرات البيئة

| المتغير | مستخدَم من قِبَل | الغرض |
|---------|-----------------|-------|
| `RDAPIFY_LICENSE_KEY` | `@rdapify/pro` | مفتاح الترخيص (مطلوب لـ Pro) |
| `HOME` / `USERPROFILE` | `@rdapify/pro` | المسار الأساسي لمجلد كاش التفعيل |

لا تتطلب حزمة `rdapify` مفتوحة المصدر متغيرات بيئة إضافية.

**Kubernetes / Docker:** ثبِّت `~/.rdapify/` كـ `PersistentVolumeClaim` للحفاظ على
كاش التفعيل عبر إعادات تشغيل الـ pod:

```yaml
# deployment.yaml
volumeMounts:
  - name: rdapify-activation
    mountPath: /root/.rdapify
volumes:
  - name: rdapify-activation
    persistentVolumeClaim:
      claimName: rdapify-activation-pvc
```

---

### 6.2 — نقطة نهاية License API

تستضيف Cloudflare Workers الـ API للتحقق من ترخيص Pro:

```
https://api.rdapify.dev/v1/validate
```

تأكد من إمكانية الوصول إلى هذه النقطة من شبكة نشرك. تستخدم HTTPS (المنفذ 443).
لا يلزم تصديق من جانب العميل — مفتاح الترخيص نفسه هو البيانات الاعتمادية.

**قواعد جدار الحماية:** اسمح بـ HTTPS الصادر إلى `api.rdapify.dev`.

---

### 6.3 — الفوترة والـ webhooks

تتولى Paddle الفوترة. لا تتفاعل مع Paddle مباشرةً من تطبيقك.
يُسلَّم مفتاح الترخيص تلقائيًا بعد عملية دفع ناجحة عبر Paddle.

إذا كانت مؤسستك تتطلب الفوترة القائمة على الفاتورة أو عقدًا مخصصًا، تواصل مع
`support@rdapify.com`.

---

### 6.4 — بيئات CI/CD

في خطوط أنابيب CI/CD حيث قد يكون `HOME` غير مُعيَّن أو مؤقتًا:

```typescript
// الإعداد الموصى به لـ CI/CD
const plugin = await ProPlugin({
  licenseKey: process.env.RDAPIFY_LICENSE_KEY,
  onlineValidation: true, // التحقق دائمًا عبر الإنترنت؛ لا حاجة لكاش
});
```

هذا يتجنب الحاجة إلى وحدة تخزين مُثبَّتة ويضمن انعكاس الإلغاء فورًا
في بناءات CI. كل بناء يُجري استدعاء تحقق واحد إلى `api.rdapify.dev` (عادةً < 50ms).

---

### 6.5 — لا تغييرات على بنية المصدر المفتوح التحتية

لا توجد تغييرات على متطلبات البنية التحتية لحزمة npm `rdapify` (MIT).
تستمر في العمل بلا استدعاءات شبكة عند البدء. نقطة IANA Bootstrap
(`data.iana.org/rdap/dns.json`) تُتصل فقط في أول استعلام لكل TLD
(ثم تُخزَّن مؤقتًا لمدة 24 ساعة افتراضيًا).

---

## 7. دليل الترقية خطوة بخطوة

اتبع هذا التسلسل لترقية آمنة ومُتحقَّق منها.

### الخطوة 1 — الترقية إلى أحدث 0.3.x

```bash
npm install rdapify@^0.3.2
```

لـ Pro:
```bash
npm install rdapify@^0.3.2 @rdapify/pro@^0.2.2
```

شغّل مجموعة الاختبارات. يجب أن تنجح قبل المتابعة.

---

### الخطوة 2 — إصلاح جميع تحذيرات الإهمال

شغّل تطبيقك وراقب رسائل `DeprecationWarning`. كل API مُهمَل
يُصدر تحذيرًا مرة واحدة في كل عملية.

```bash
node --trace-deprecation your-app.js 2>&1 | grep DEP_RDAPIFY
```

| التحذير | الكود | الإجراء |
|---------|-------|---------|
| `client.getBatchProcessor() is deprecated` | `DEP_RDAPIFY_0001` | الانتقال إلى `client.streamBatch()` أو `client.processBatch()` |

أصلح جميع التحذيرات قبل الترقية إلى 1.0.0. التحذيرات غير المُعالَجة ستصبح
أخطاء وقت التشغيل في 1.0.0.

---

### الخطوة 3 — تحديث أسماء الحزم (إن انطبق)

**إذا كنت تستخدم الارتباط الأصيل لـ Node.js:**
```bash
npm uninstall @rdapify/core
npm install rdapify-nd@^1.0.0
```

**إذا كنت تستخدم ارتباط Python:**
```bash
pip uninstall rdapify
pip install rdapify-py
```

حدّث جميع عبارات `import` / `require` وملفات المتطلبات.

---

### الخطوة 4 — مراجعة إعداد `RDAPClient`

تحقق من إنشاء `RDAPClient` بحثًا عن أي خيارات تتغير في 1.0.0:

```typescript
// راجع قيم هذه الخيارات قبل الترقية:
const client = new RDAPClient({
  // 1. circuitBreaker — مُفعَّل الآن افتراضيًا؛ مرر false للتعطيل
  circuitBreaker: { failureThreshold: 5 }, // أو false

  // 2. ssrfProtection — لا يمكن تعطيله في 1.0.0
  // ssrfProtection: false, // ← احذف هذا؛ سيُطلق استثناءً في 1.0.0

  // 3. لا تغييرات على الإعدادات الافتراضية الأخرى
});
```

---

### الخطوة 5 — الترقية إلى 1.0.0

```bash
npm install rdapify@^1.0.0
```

لـ Pro:
```bash
npm install rdapify@^1.0.0 @rdapify/pro@^1.0.0
```

لـ Rust:
```toml
# Cargo.toml
rdapify = "1.0"
```

شغّل مجموعة الاختبارات. عالج أي `ReferenceError` أو `TypeError` من API محذوفة
(يجب أن تكون كلها مُحلَّلة في الخطوة 2 إذا أصلحت جميع تحذيرات الإهمال).

---

### الخطوة 6 — التحقق من تفعيل Pro (عند استخدام @rdapify/pro)

في أول تشغيل للتطبيق المُرقَّى، يُنفِّذ Pro التفعيل عبر الإنترنت.
تأكد من نجاحه:

```typescript
const plugin = await ProPlugin({
  licenseKey: process.env.RDAPIFY_LICENSE_KEY,
});

console.log('License valid:', plugin.license.valid);
console.log('Plan:', plugin.license.plan);
console.log('Cached:', plugin.license.activationCached); // false عند التفعيل الأول
console.log('Grace expires:', new Date(plugin.license.graceExpiresAt));
```

المخرجات المتوقعة عند التفعيل الأول:
```
License valid: true
Plan: pro
Cached: false
Grace expires: [تاريخ بعد 30 يومًا من الآن]
```

المخرجات المتوقعة في التشغيلات اللاحقة (ضمن فترة السماح):
```
License valid: true
Plan: pro
Cached: true
Grace expires: [نفس التاريخ]
```

---

### الخطوة 7 — مراقبة السجلات بعد النشر

بعد نشر 1.0.0 في الإنتاج، راقب:

1. **`CircuitOpenError`** — سجل يواجه إخفاقات. تحقق من صفحة حالة السجل المتأثر.
   سيتعافى الدائرة تلقائيًا بعد `halfOpenTimeout`.

2. **`License API temporarily unavailable — 7-day emergency grace active`** — شبكتك
   لا تستطيع الوصول إلى `api.rdapify.dev`. تحقق من قواعد جدار الحماية. تحقق خلال 7 أيام.

3. **`Activation token tampered`** — تم تعديل ملف كاش التفعيل. يُطلق هذا
   إعادة تفعيل تلقائية عبر الإنترنت في الاستدعاء التالي. إذا ظهر هذا في بيئة حاوية،
   تحقق من أن تثبيت الوحدة لا يُكتَّب فوق مجلد التفعيل.

---

## 8. مصفوفة التوافق

يجب أن تكون جميع المكوّنات بنفس الإصدار الرئيسي. خلط الإصدارات الرئيسية بين الحزم
غير مدعوم وسيُطلق خطأ توافق عند بدء التشغيل.

| المكوّن | الإصدار المطلوب لـ 1.0.0 | التثبيت |
|---------|------------------------|---------|
| `rdapify` (npm) | `^1.0.0` | `npm install rdapify@^1.0.0` |
| `rdapify` (crates.io) | `^1.0.0` | `cargo add rdapify@^1.0` |
| `rdapify-nd` (npm) | `^1.0.0` | `npm install rdapify-nd@^1.0.0` |
| `rdapify-py` (PyPI) | `^1.0.0` | `pip install rdapify-py==1.*` |
| `@rdapify/pro` (npm) | `^1.0.0` | `npm install @rdapify/pro@^1.0.0` |
| Node.js | `>=20.0.0` | — |
| Python | `>=3.9` | — |
| Rust MSRV | `1.75` | — |

**تطبيق تبعية النظير:** يُعلن `@rdapify/pro@1.0.0` عن `"rdapify": ">=1.0.0"` كتبعية نظير.
سيُحذِّر npm (أو يُطلق خطأ مع تعطيل `--legacy-peer-deps`) إذا ثبّتت Pro مع نواة 0.x.
هذا مقصود.

---

## 9. استكشاف الأخطاء وإصلاحها

### فشل تفعيل الترخيص عند الاستخدام الأول

**العَرَض:**
```
[@rdapify/pro] License API unreachable — cannot activate on first use.
```

**الأسباب والحلول:**
1. **الشبكة/جدار الحماية:** تأكد من السماح بـ HTTPS الصادر إلى `api.rdapify.dev`.
   ```bash
   curl -I https://api.rdapify.dev/v1/validate
   # المتوقع: HTTP/2 200 أو HTTP/2 400 (نقطة النهاية موجودة)
   ```
2. **تنسيق المفتاح غير صالح:** يجب أن يتبع المفتاح `RDAP-{PLAN}-{payload}-{signature}`.
   ```bash
   echo $RDAPIFY_LICENSE_KEY
   # يجب أن يبدأ بـ RDAP-PRO- أو RDAP-TEAM- أو RDAP-ENTERPRISE-
   ```
3. **مفتاح منتهي الصلاحية:** تاريخ انتهاء مفتاح الترخيص قد مضى. تواصل مع
   `support@rdapify.com` للتجديد.

---

### قاطع الدائرة يُفتح فورًا بعد الترقية

**العَرَض:**
```
CircuitOpenError: Circuit is open — request rejected
```

**السبب:** نشرك به إخفاقات خادم RDAP موجودة مسبقًا يُبرزها قاطع الدائرة الآن بشكل أوضح.

**الحل:** تحقق من أي سجل يُسبب الانفتاح:
```typescript
const stats = client.getCircuitBreakerStats();
for (const [host, stat] of stats) {
  if (stat.state !== 'closed') {
    console.log(`Failing registry: ${host} — state: ${stat.state}`);
  }
}
```

يتعافى الدائرة تلقائيًا بعد `halfOpenTimeout` (30 ثانية افتراضيًا). إذا كان سجل
يُخفق باستمرار، فهذه مشكلة حقيقية في المصدر الخارجي. لزيادة تحمّل الإخفاقات:
```typescript
const client = new RDAPClient({
  circuitBreaker: { failureThreshold: 10, halfOpenTimeout: 60_000 },
});
```

---

### أخطاء نبضات القياس في السجلات

**العَرَض:**
```
[rdapify] Telemetry ping failed (silently ignored)
```

**السبب:** القياس مُفعَّل (`UsageTelemetry.enable()` استُدعي) لكن
`telemetry.rdapify.com` غير متاح. إخفاقات القياس تُبتلع دائمًا بصمت —
لا تؤثر أبدًا على نتائج استعلامات RDAP.

**الحل:** إما إضافة `telemetry.rdapify.com` إلى القائمة البيضاء أو تعطيل القياس:
```typescript
import { UsageTelemetry } from 'rdapify';
UsageTelemetry.disable();
```

---

### عدم توافق الارتباط الأصيل (`rdapify-nd` أو `rdapify-py`)

**العَرَض:**
```
Error: Cannot find module 'rdapify-nd'
# أو
Error: Native module rdapify-nd version 0.1.3 is incompatible with rdapify 1.0.0
```

**الحل:** ثبِّت الإصدار المتوافق من `rdapify-nd`:
```bash
npm install rdapify-nd@^1.0.0
```

إذا كنت تستخدم الواجهة الأصيلة الاختيارية ولا تستطيع تثبيت `rdapify-nd`، ارجع
إلى خط أنابيب TypeScript:
```typescript
const client = new RDAPClient({
  backend: 'typescript', // رجوع صريح؛ يُتجاهل rdapify-nd حتى لو كان مثبتًا
});
```

---

### خطأ استيراد Python بعد ترقية pip

**العَرَض:**
```python
ImportError: No module named 'rdapify'
```

**الحل:** تغيّر اسم الوحدة:
```python
# قبل
import rdapify

# بعد
import rdapify_py as rdap
```

تأكد أيضًا من إزالة الحزمة القديمة:
```bash
pip uninstall rdapify
pip install rdapify-py
```

---

### `ssrfProtection: false` يُطلق استثناءً عند البدء

**العَرَض:**
```
Error: ssrfProtection cannot be disabled. SSRF protection is required in rdapify 1.0.0.
```

**الحل:** احذف خيار `ssrfProtection: false`. إذا كنت تستعلم من سجلات داخلية،
استخدم خيار bootstrap `customServers` بدلًا من ذلك:
```typescript
const client = new RDAPClient({
  bootstrap: {
    customServers: [
      { tld: 'internal', url: 'https://rdap.internal.corp/rdap/' },
    ],
    fallback: false, // تعطيل بحث IANA كليًا للنشر الداخلي فقط
  },
});
```

---

## 10. الحصول على المساعدة

### التوثيق

- **مرجع الـ API الكامل:** [rdapify/docs/api/](docs/api/)
- **الأمان:** [SECURITY.md](SECURITY.md)
- **سجل التغييرات:** [CHANGELOG.md](CHANGELOG.md)

### دعم المجتمع

- **GitHub Issues** (الأخطاء، السلوك غير المتوقع):
  [github.com/rdapify/RDAPify/issues](https://github.com/rdapify/RDAPify/issues)
- **GitHub Discussions** (الأسئلة، مساعدة الترقية):
  [github.com/rdapify/RDAPify/discussions](https://github.com/rdapify/RDAPify/discussions)

### الدعم التجاري

- **مشاكل الترخيص والفوترة:** [support@rdapify.com](mailto:support@rdapify.com)
- **الثغرات الأمنية:** [security@rdapify.com](mailto:security@rdapify.com)
  أو [GitHub Security Advisories](https://github.com/rdapify/RDAPify/security/advisories/new)
- **الطوارئ (استغلال نشط):** [emergency@rdapify.com](mailto:emergency@rdapify.com)
  — هدف الاستجابة 4 ساعات

---

> آخر تحديث: 2026-03-25
> سيُحدَّث هذا الدليل مع اكتمال التغييرات الجذرية خلال مرحلة مرشحي الإصدار 1.0.0
> (الربع الرابع 2026 — الربع الأول 2027). تابع
> [github.com/rdapify/RDAPify/releases](https://github.com/rdapify/RDAPify/releases)
> لإعلانات مرشحي الإصدار.
