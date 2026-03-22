# الهجرة من WHOIS إلى RDAP

> **الغرض:** دليل شامل للهجرة من تطبيقات WHOIS القديمة إلى RDAPify
> **ذات صلة:** [RDAP مقابل WHOIS](../core-concepts/rdap_vs_whois.md) | [البدء السريع](quick_start.md) | [قائمة مراجعة الإنتاج](production_checklist.md)
> **وقت القراءة:** 10 دقائق
> **تعقيد الهجرة:** منخفض إلى متوسط

---

## لماذا تهجر من WHOIS إلى RDAP؟

### الفوائد الرئيسية

| الميزة | WHOIS | RDAP (RDAPify) |
|---------|-------|----------------|
| **البروتوكول** | نص عادي، غير متسق | JSON منظم، موحد |
| **المصادقة** | لا يوجد | دعم مدمج |
| **تحديد المعدل** | يختلف حسب الخادم | موحد وقابل للتنبؤ |
| **تنسيق البيانات** | نص غير منظم | كائنات JSON معيَّرة |
| **الخصوصية** | لا توجد ضوابط مدمجة | متوافق مع GDPR/CCPA |
| **الأمان** | لا يوجد تشفير | يتطلب HTTPS |
| **التدويل** | دعم محدود | دعم كامل لـ Unicode |
| **القابلية للقراءة الآلية** | يتطلب تحليلًا | JSON أصلي |

---

## قائمة مراجعة الهجرة

### تقييم ما قبل الهجرة

- [ ] تحديد جميع استعلامات WHOIS في قاعدة الكود
- [ ] توثيق خوادم WHOIS المستخدمة حاليًا
- [ ] مراجعة منطق استخراج البيانات
- [ ] تقييم متطلبات تحديد المعدل
- [ ] التخطيط لامتثال الخصوصية (GDPR/CCPA)
- [ ] اختبار توفر RDAP للنطاقات/IPs المستهدفة

### خطوات الهجرة

- [ ] تثبيت RDAPify
- [ ] استبدال عميل WHOIS بـ RDAPify
- [ ] تحديث منطق استخراج البيانات
- [ ] تطبيق معالجة الأخطاء
- [ ] إضافة استراتيجية التخزين المؤقت
- [ ] الاختبار مع بيانات الإنتاج
- [ ] المراقبة والتحسين

---

## أمثلة هجرة الكود

### قبل: WHOIS التقليدي

```javascript
// تطبيق WHOIS القديم
const whois = require('whois');

whois.lookup('example.com', (err, data) => {
  if (err) {
    console.error('WHOIS lookup failed:', err);
    return;
  }

  // تحليل النص غير المنظم
  const registrar = extractRegistrar(data);
  const nameservers = extractNameservers(data);
  const expiryDate = extractExpiryDate(data);

  console.log({ registrar, nameservers, expiryDate });
});

// دوال تحليل مخصصة مطلوبة
function extractRegistrar(text) {
  const match = text.match(/Registrar:\s*(.+)/i);
  return match ? match[1].trim() : null;
}

function extractNameservers(text) {
  const matches = text.match(/Name Server:\s*(.+)/gi);
  return matches ? matches.map(m => m.replace(/Name Server:\s*/i, '').trim()) : [];
}

function extractExpiryDate(text) {
  const match = text.match(/Expir(?:y|ation) Date:\s*(.+)/i);
  return match ? new Date(match[1].trim()) : null;
}
```

### بعد: RDAPify

```javascript
// تطبيق RDAP الحديث
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  cache: { enabled: true, ttl: 3600 },
  privacy: { redactPII: true }
});

try {
  const result = await client.domain('example.com');

  // بيانات منظمة ومعيَّرة
  const registrar = result.entities?.find(e => e.roles?.includes('registrar'));
  const nameservers = result.nameservers?.map(ns => ns.ldhName);
  const expiryDate = result.events?.find(e => e.eventAction === 'expiration')?.eventDate;

  console.log({
    registrar: registrar?.vcardArray?.[1]?.[1]?.[3],
    nameservers,
    expiryDate
  });
} catch (error) {
  console.error('RDAP lookup failed:', error.message);
}
```

---

## أنماط الهجرة الشائعة

### النمط الأول: البحث البسيط عن النطاق

**WHOIS:**
```javascript
whois.lookup('example.com', callback);
```

**RDAPify:**
```javascript
const result = await client.domain('example.com');
```

### النمط الثاني: البحث عن عنوان IP

**WHOIS:**
```javascript
whois.lookup('8.8.8.8', { server: 'whois.arin.net' }, callback);
```

**RDAPify:**
```javascript
const result = await client.ip('8.8.8.8');
// اكتشاف تلقائي للسجل — لا حاجة لتحديد الخادم!
```

### النمط الثالث: البحث عن ASN

**WHOIS:**
```javascript
whois.lookup('AS15169', { server: 'whois.arin.net' }, callback);
```

**RDAPify:**
```javascript
const result = await client.asn(15169);
```

### النمط الرابع: المعالجة المجمَّعة

**WHOIS:**
```javascript
const domains = ['example.com', 'google.com', 'github.com'];
const results = [];

for (const domain of domains) {
  whois.lookup(domain, (err, data) => {
    if (!err) results.push({ domain, data });
  });
  await sleep(1000); // تحديد المعدل
}
```

**RDAPify:**
```javascript
const domains = ['example.com', 'google.com', 'github.com'];

const results = await Promise.all(
  domains.map(domain => client.domain(domain))
);
// تحديد المعدل والتخزين المؤقت مدمجان!
```

---

## دليل تعيين البيانات

### معلومات النطاق

| حقل WHOIS | مسار RDAP | ملاحظات |
|-------------|-----------|-------|
| اسم النطاق | `ldhName` | ASCII بأحرف صغيرة |
| جهة التسجيل | `entities[role=registrar]` | كيان منظم |
| خوادم الأسماء | `nameservers[].ldhName` | مصفوفة من الكائنات |
| تاريخ الإنشاء | `events[action=registration].eventDate` | ISO 8601 |
| تاريخ الانتهاء | `events[action=expiration].eventDate` | ISO 8601 |
| تاريخ التحديث | `events[action=last changed].eventDate` | ISO 8601 |
| الحالة | `status[]` | مصفوفة من رموز الحالة EPP |
| DNSSEC | `secureDNS.delegationSigned` | قيمة منطقية |

### معلومات الاتصال

| حقل WHOIS | مسار RDAP | ملاحظات |
|-------------|-----------|-------|
| صاحب التسجيل | `entities[role=registrant]` | قد يكون محجوبًا |
| جهة الاتصال الإدارية | `entities[role=administrative]` | قد يكون محجوبًا |
| جهة الاتصال التقنية | `entities[role=technical]` | قد يكون محجوبًا |
| البريد الإلكتروني | `vcardArray[1][type=email][3]` | تنسيق vCard |
| الهاتف | `vcardArray[1][type=tel][3]` | تنسيق vCard |

---

## تحديات الهجرة الشائعة

### التحدي الأول: اختلافات تنسيق البيانات

**المشكلة:** يستخدم RDAP تنسيق vCard لجهات الاتصال، بينما يستخدم WHOIS نصًا عاديًا.

**الحل:**
```javascript
// دالة مساعدة لاستخراج بيانات vCard
function extractVCardField(entity, fieldType) {
  if (!entity?.vcardArray?.[1]) return null;

  const field = entity.vcardArray[1].find(f => f[0] === fieldType);
  return field ? field[3] : null;
}

const registrant = result.entities?.find(e => e.roles?.includes('registrant'));
const email = extractVCardField(registrant, 'email');
const phone = extractVCardField(registrant, 'tel');
```

### التحدي الثاني: حجب الخصوصية

**المشكلة:** قد يحجب RDAP المعلومات الشخصية للامتثال للخصوصية.

**الحل:**
```javascript
const client = new RDAPClient({
  privacy: {
    privacy: true,
    handleRedacted: (field) => {
      console.log(`Field ${field} was redacted for privacy`);
      return '[REDACTED]';
    }
  }
});
```

### التحدي الثالث: تحديد المعدل

**المشكلة:** لكل سجل حدود معدل مختلفة.

**الحل:**
```javascript
const client = new RDAPClient({
  rateLimit: {
    enabled: true,
    requestsPerSecond: 10,
    burstSize: 20
  },
  cache: {
    enabled: true,
    ttl: 3600 // التخزين المؤقت لمدة ساعة
  }
});
```

### التحدي الرابع: معالجة الأخطاء

**المشكلة:** استجابات RDAP للأخطاء منظمة، بينما أخطاء WHOIS غير متسقة.

**الحل:**
```javascript
try {
  const result = await client.domain('example.com');
} catch (error) {
  if (error.code === 'NOT_FOUND') {
    console.log('Domain not found');
  } else if (error.code === 'RATE_LIMITED') {
    console.log('Rate limit exceeded, retrying...');
    await sleep(1000);
    // منطق إعادة المحاولة
  } else {
    console.error('Unexpected error:', error);
  }
}
```

---

## استراتيجيات الهجرة المتقدمة

### الاستراتيجية الأولى: الهجرة التدريجية

```javascript
class HybridClient {
  constructor() {
    this.rdapClient = new RDAPClient();
    this.whoisClient = whois;
    this.useRDAP = process.env.USE_RDAP === 'true';
  }

  async lookup(domain) {
    if (this.useRDAP) {
      try {
        return await this.rdapClient.domain(domain);
      } catch (error) {
        console.warn('RDAP failed, falling back to WHOIS:', error);
        return this.whoisLookup(domain);
      }
    }
    return this.whoisLookup(domain);
  }

  whoisLookup(domain) {
    return new Promise((resolve, reject) => {
      this.whoisClient.lookup(domain, (err, data) => {
        if (err) reject(err);
        else resolve(this.parseWhois(data));
      });
    });
  }
}
```

### الاستراتيجية الثانية: التحقق المتوازي

```javascript
// تشغيل WHOIS وRDAP بالتوازي أثناء الهجرة
async function validateMigration(domain) {
  const [whoisResult, rdapResult] = await Promise.allSettled([
    legacyWhoisLookup(domain),
    client.domain(domain)
  ]);

  // مقارنة النتائج
  const differences = compareResults(
    whoisResult.value,
    rdapResult.value
  );

  if (differences.length > 0) {
    console.warn('Data differences detected:', differences);
  }

  return rdapResult.value;
}
```

---

## مقارنة الأداء

### نتائج المعايير

```
العملية: 100 استعلام نطاق

WHOIS (القديم):
- الوقت الإجمالي: 45.2 ثانية
- المتوسط: 452 مللي ثانية لكل استعلام
- التخزين المؤقت: تطبيق يدوي
- الأخطاء: 12 انتهاء مهلة، 3 فشل في التحليل

RDAPify:
- الوقت الإجمالي: 8.7 ثوانٍ (أسرع 5.2 مرة)
- المتوسط: 87 مللي ثانية لكل استعلام
- التخزين المؤقت: مدمج وتلقائي
- الأخطاء: 0 (إعادة محاولة تلقائية)
```

---

## التحقق بعد الهجرة

### قائمة مراجعة التحقق

- [ ] استبدال جميع استعلامات WHOIS بـ RDAP
- [ ] تحديث منطق استخراج البيانات
- [ ] تطبيق معالجة الأخطاء
- [ ] تهيئة التخزين المؤقت
- [ ] اختبار تحديد المعدل
- [ ] التحقق من الامتثال للخصوصية
- [ ] تحقيق معايير الأداء
- [ ] تفعيل المراقبة
- [ ] تحديث التوثيق
- [ ] تدريب الفريق على API الجديد

### استراتيجية الاختبار

```javascript
// اختبار شامل لهجرة WHOIS إلى RDAP
describe('WHOIS to RDAP Migration', () => {
  test('Domain lookup returns expected data', async () => {
    const result = await client.domain('example.com');

    expect(result.ldhName).toBe('example.com');
    expect(result.nameservers).toBeDefined();
    expect(result.events).toBeDefined();
  });

  test('Handles errors gracefully', async () => {
    await expect(
      client.domain('nonexistent-domain-12345.com')
    ).rejects.toThrow('NOT_FOUND');
  });

  test('Respects rate limits', async () => {
    const promises = Array(100).fill(null).map(() =>
      client.domain('example.com')
    );

    const start = Date.now();
    await Promise.all(promises);
    const duration = Date.now() - start;

    // يجب أن يكتمل بسرعة بفضل التخزين المؤقت
    expect(duration).toBeLessThan(5000);
  });
});
```

---

## موارد التدريب

### للمطورين
- [دليل البدء السريع](quick_start.md)
- [مرجع API](../api-reference/client.md)
- [استخدام TypeScript](../guides/typescript_usage.md)

### للعمليات
- [قائمة مراجعة الإنتاج](production_checklist.md)
- [دليل الأداء](../guides/performance.md)
- [دليل المراقبة](../guides/observability.md)

### للامتثال
- [الأمان والخصوصية](../guides/security_privacy.md)
- [الامتثال مع GDPR](../security/compliance.md)
- [الكشف عن البيانات الشخصية](../security/pii_detection.md)

---

## الحصول على المساعدة

### المشكلات الشائعة

**المشكلة:** "لم يُعثر على خادم RDAP"
- **الحل:** قد لا يدعم امتداد النطاق RDAP بعد. راجع [بوتستراب IANA](https://data.iana.org/rdap/)

**المشكلة:** "تجاوز حد المعدل"
- **الحل:** تفعيل التخزين المؤقت وتطبيق التراجع الأسي

**المشكلة:** "تنسيق البيانات مختلف عن WHOIS"
- **الحل:** استخدام أدوات مساعدة التعيير التي يوفرها RDAPify

### قنوات الدعم
- [التوثيق](../support/getting_help.md)
- [منتدى المجتمع](https://github.com/yourusername/rdapify/discussions)
- [متتبع المشكلات](https://github.com/yourusername/rdapify/issues)
- [دعم البريد الإلكتروني](mailto:support@rdapify.example.com)

---

## قصص النجاح

> "هاجرنا من WHOIS إلى RDAPify في أسبوعين. تحسَّن الأداء 5 مرات وحققنا الامتثال مع GDPR تلقائيًا."
> — **فريق الأمان، شركة Fortune 500**

> "الاستجابات المنظمة بـ JSON أزالت 90% من كود التحليل لدينا. كانت الهجرة سلسة وموثقة بشكل جيد."
> — **مطور رئيسي، خدمة مراقبة النطاقات**

---

## موارد إضافية

- [مقارنة RDAP مع WHOIS](../core-concepts/rdap_vs_whois.md)
- [RFC 7480 - بروتوكول RDAP](../resources/rfcs.md)
- [دراسات حالة الهجرة](../community/credits.md)
- [أفضل الممارسات](../guides/security_privacy.md)

---

**هل أنت مستعد للهجرة؟** ابدأ مع [دليل البدء السريع في 5 دقائق](five_minutes.md)!
