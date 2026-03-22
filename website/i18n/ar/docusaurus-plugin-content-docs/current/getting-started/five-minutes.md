# 5 دقائق مع RDAPify: البدء السريع التفاعلي

> **الهدف:** استعلام بيانات تسجيل النطاق مع حمايات الخصوصية في أقل من 5 دقائق
> **المتطلبات الأساسية:** معرفة أساسية بـ JavaScript/TypeScript وNode.js 18+ أو متصفح حديث
> **نصيحة:** اتبع الخطوات في [بيئة اللعب على الإنترنت](https://rdapify.dev/playground) إذا لم ترغب في تثبيت أي شيء بعد!

---

## الدقيقة الأولى: التثبيت والإعداد

### الخيار أ: بيئة Node.js
```bash
# إنشاء مجلد مشروع جديد
mkdir rdap-test && cd rdap-test

# تهيئة npm وتثبيت RDAPify
npm init -y
npm install rdapify
```

### الخيار ب: بيئة المتصفح (CDN)
```html
<!DOCTYPE html>
<html>
<head>
  <title>RDAPify Quick Start</title>
  <script type="module">
    // الاستيراد من CDN
    import { RDAPClient } from 'https://unpkg.com/rdapify@latest/dist/browser/index.js';
  </script>
</head>
<body>
  <div id="result"></div>
</body>
</html>
```

✅ **نقطة تحقق:** RDAPify جاهز للاستخدام الآن!

---

## الدقيقة الثانية: أول استعلام (مع الخصوصية المدمجة)

أنشئ ملفًا باسم `app.js` بهذا الكود:

```javascript
import { RDAPClient } from 'rdapify';

// إنشاء عميل بإعدادات افتراضية تحمي الخصوصية
const client = new RDAPClient({
  // حجب البيانات الشخصية مفعَّل بشكل افتراضي (متوافق مع GDPR/CCPA)
  privacy: true,

  // تخزين مؤقت آمن مع انتهاء صلاحية تلقائي
  cache: {
    ttl: 3600 // ساعة واحدة بالثواني
  }
});

// استعلام عن نطاق - جرِّب example.com أولًا (نطاق اختبار عام)
const domain = 'example.com';

try {
  const result = await client.domain(domain);
  console.log(`Registration data for ${domain}:`);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error('Query failed:', error.message);
}
```

✅ **نقطة تحقق:** لقد أجريت أول استعلام RDAP محمي للخصوصية!

---

## الدقيقة الثالثة: مشاهدة الخصوصية في العمل

شغّل الكود:
```bash
node app.js
```

**المخرجات المتوقعة:**
```json
{
  "domain": "example.com",
  "registrar": "REDACTED",
  "registrant": {
    "name": "REDACTED",
    "organization": "Internet Corporation for Assigned Names and Numbers",
    "email": "REDACTED@redacted.invalid",
    "phone": "REDACTED"
  },
  "nameservers": ["a.iana-servers.net", "b.iana-servers.net"],
  "events": [
    {
      "action": "registration",
      "date": "1995-08-14T04:00:00Z"
    },
    {
      "action": "last changed",
      "date": "2023-08-14T07:01:44Z"
    }
  ],
  "status": ["client delete prohibited", "client transfer prohibited", "client update prohibited"],
  "raw": false
}
```

**ملاحظة حول الخصوصية:** لاحظ كيف تُحجب المعلومات الشخصية تلقائيًا مع الحفاظ على البيانات التقنية المفيدة. هذا هو نهج RDAPify في تطبيق الخصوصية الافتراضية.

---

## الدقيقة الرابعة: معاينة الميزات المتقدمة

حدِّث ملف `app.js` لتجربة هذه الميزات القوية:

```javascript
// أضف هذا بعد استعلامك الأول

// 1. الحصول على البيانات الخام (فقط إذا كان لديك الأساس القانوني!)
const rawResult = await client.domain('example.com', {
  privacy: false,
  includeRaw: true
});
console.log('Raw RDAP response (use responsibly):');
console.log(JSON.stringify(rawResult.rawResponse, null, 2).substring(0, 200) + '...');

// 2. البحث عن عنوان IP
const ipResult = await client.ip('8.8.8.8');
console.log('IP lookup for 8.8.8.8:');
console.log(`Organization: ${ipResult.entity.name}`);
console.log(`Country: ${ipResult.country}`);
console.log(`Network: ${ipResult.cidr}`);
```

✅ **نقطة تحقق:** لقد جرّبت الآن قدرات RDAPify الأساسية مع ضوابط الخصوصية المدمجة!

---

## الدقيقة الخامسة: الخطوات التالية واعتبارات الإنتاج

لقد أكملت البدء السريع في 5 دقائق! إليك ما يمكنك فعله بعد ذلك:

### تعميق معرفتك
- [مسار التعلم](./learning-path.md) - رحلة تعلم منظمة
- [المفاهيم الأساسية](../core-concepts/what-is-rdap.md) - فهم أساسيات RDAP
- [دليل ضوابط الخصوصية](../api-reference/privacy-controls.md) - إتقان ميزات حماية البيانات

### قائمة مراجعة الجاهزية للإنتاج
```markdown
- [ ] إعداد معالجة الأخطاء الصحيحة مع منطق إعادة المحاولة
- [ ] تهيئة التخزين المؤقت الدائم مع التشفير
- [ ] تطبيق تحديد المعدل للامتثال مع السجل
- [ ] إضافة تسجيل التدقيق لوصول البيانات
- [ ] مراجعة الأساس القانوني لحالة الاستخدام المحددة
- [ ] إعداد المراقبة والتنبيهات
```

### ما يمكنك تجربته بعد ذلك
```javascript
// مثال على إعداد عميل جاهز للإنتاج
const productionClient = new RDAPClient({
  privacy: true,
  timeout: 10000,
  retry: { maxAttempts: 3 },
  cacheAdapter: new RedisAdapter({
    url: process.env.REDIS_URL,
    redactBeforeStore: true,
    encryptionKey: process.env.CACHE_ENCRYPTION_KEY
  }),
  telemetry: {
    enabled: true,
    anonymize: true
  }
});
```

---

## تحدٍّ تفاعلي (اختياري)

**عدِّل الكود لـ:**
1. إنشاء دالة تتحقق مما إذا كان نطاق مسجَّلًا لمؤسسة معينة
2. تطبيق دالة مسح ذاكرة مؤقتة بسيطة تحترم لوائح الخصوصية
3. إضافة معالجة أخطاء تميّز بين أخطاء الشبكة وحالات "البيانات غير موجودة"

**معاينة الحل:** راجع [مستودع الأمثلة](../../../examples/basic/) للاطلاع على التطبيقات المرجعية.

---

## هل تحتاج مساعدة؟

- **عالق؟** جرِّب [دليل استكشاف الأخطاء](../troubleshooting/common-errors.md)
- **أسئلة؟** انضم إلى [نقاشات المجتمع](https://github.com/rdapify/rdapify/discussions)
- **مساعدة فورية:** انضم إلى ساعات المكتب الأسبوعية (أيام الخميس الساعة 2 مساءً UTC)

---

> **تذكير الخصوصية:** صُمِّم RDAPify مع الخصوصية الافتراضية، لكنك تبقى مسؤولًا عن الامتثال للوائح المعمول بها. قيِّم دائمًا الأساس القانوني لمعالجة بيانات التسجيل. عند الشك، أبقِ `privacy: true` مفعَّلًا!

[← العودة إلى البدء](./README.md) | [التالي: مسار التعلم ←](./learning-path.md)

*آخر تحديث للوثيقة: 5 ديسمبر 2025*
*إصدار RDAPify المستخدم في الأمثلة: 2.3.0*
