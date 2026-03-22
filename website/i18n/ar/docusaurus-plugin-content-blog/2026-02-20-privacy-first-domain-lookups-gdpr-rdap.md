---
slug: privacy-first-domain-lookups-gdpr-rdap
title: "البحث عن النطاقات مع أولوية الخصوصية: استعلامات RDAP متوافقة مع GDPR"
authors: [rdapify]
tags: [privacy, gdpr, rdap, compliance, pii-redaction]
description: "كيفية إجراء بحث عن النطاقات مع احترام GDPR ولوائح الخصوصية. تعلم عن حجب البيانات الشخصية، وتقليل البيانات، وبناء أدوات بيانات التسجيل المتوافقة مع اللوائح باستخدام RDAP."
keywords: [gdpr domain lookup, privacy rdap, pii redaction domain, gdpr whois, domain data privacy, compliant domain lookup, data protection rdap]
image: /img/rdapify-social-card.png
---

منذ دخول GDPR حيز التنفيذ عام 2018، أصبحت بيانات تسجيل النطاقات مجالًا دقيقًا من الناحية التنظيمية. كان WHOIS يكشف البيانات الشخصية بحرية. أما RDAP فقد صُمّم مع مراعاة الخصوصية — لكنك لا تزال بحاجة إلى التعامل الحذر مع الاستجابات. يوضح هذا الدليل كيفية بناء أدوات بحث عن النطاقات متوافقة مع الخصوصية.

<!-- truncate -->

## مشكلة الخصوصية في بيانات النطاقات

غالبًا ما تحتوي سجلات تسجيل النطاقات على معلومات تعريف شخصية (PII):

- **اسم المسجّل** — الشخص أو المؤسسة التي سجّلت النطاق
- **عناوين البريد الإلكتروني** — بريد التواصل للمسجّل والمسؤول والدور التقني
- **أرقام الهاتف** — أرقام التواصل
- **العناوين الفعلية** — عنوان الشارع والمدينة والبلد للمسجّل
- **اسم المؤسسة** — قد يُحدد أفرادًا في الشركات الصغيرة

بموجب GDPR (ولوائح مماثلة كـ CCPA وLGPD وPIPEDA)، يُعدّ جمع هذه البيانات أو تخزينها أو معالجتها دون أساس قانوني مناسب انتهاكًا.

## كيف يتعامل RDAP مع الخصوصية

صُمّم RDAP بعد GDPR. يتضمن ميزات خصوصية لم يمتلكها WHOIS قط:

### 1. الوصول التمييزي

يمكن لخوادم RDAP إعادة بيانات مختلفة بناءً على هوية مُقدّم الطلب:

```
مستخدم مجهول:
  → بيانات الاتصال محجوبة
  → معلومات النطاق الأساسية فقط

مسجّل مصادق عليه:
  → تفاصيل الاتصال الكاملة
  → وصول إداري

جهة إنفاذ القانون (بتفويض مناسب):
  → بيانات غير محجوبة
  → سجل تدقيق كامل
```

### 2. إشعارات الحجب

عند حجب البيانات، تتضمن خوادم RDAP إشعارات صريحة:

```json
{
  "entities": [
    {
      "roles": ["registrant"],
      "remarks": [
        {
          "title": "REDACTED FOR PRIVACY",
          "description": [
            "Personal data redacted per GDPR."
          ]
        }
      ]
    }
  ]
}
```

### 3. تقييد الغرض

تتضمن استجابات RDAP إشعارات حول الاستخدام المسموح به:

```json
{
  "notices": [
    {
      "title": "Terms of Use",
      "description": [
        "This data may not be used for marketing purposes.",
        "Mass collection of registration data is prohibited."
      ]
    }
  ]
}
```

## حجب PII مع RDAPify

يتضمن RDAPify أداة حجب PII مدمجة تُزيل البيانات الشخصية من استجابات RDAP قبل وصولها إلى تطبيقك:

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  ppiRedaction: true, // Enable PII redaction
});

const domain = await client.domain('example.com');

// Contact entities are automatically redacted
// Email addresses → [REDACTED]
// Phone numbers → [REDACTED]
// Personal names → [REDACTED]
// Street addresses → [REDACTED]
```

### ما الذي يُحجب

| الحقل | قبل الحجب | بعد الحجب |
|-------|-----------------|-----------------|
| البريد الإلكتروني | john@example.com | [REDACTED] |
| الهاتف | +1-555-0123 | [REDACTED] |
| الاسم | John Smith | [REDACTED] |
| العنوان | 123 Main St, City | [REDACTED] |
| المؤسسة | يُحفظ (ليس شخصيًا) | يُحفظ |
| اسم النطاق | يُحفظ (عام) | يُحفظ |
| خوادم الأسماء | يُحفظ (تقني) | يُحفظ |
| الحالة | يُحفظ (عام) | يُحفظ |
| الأحداث | يُحفظ (تواريخ) | يُحفظ |

### الحجب الانتقائي

قد تكون لديك أسباب مشروعة للوصول إلى بعض حقول PII. يتيح لك RDAPify تكوين ما يُحجب:

```typescript
const client = new RDAPClient({
  ppiRedaction: {
    redactEmails: true,
    redactPhones: true,
    redactNames: true,
    redactAddresses: true,
  },
});
```

## بناء أدوات بحث متوافقة مع GDPR

### المبدأ الأول: تقليل البيانات

استعلم فقط عما تحتاجه. لا تجلب استجابات RDAP كاملة إذا كنت تحتاج تاريخ الانتهاء فقط:

```typescript
async function getExpiryOnly(domain: string) {
  const client = new RDAPClient({ ppiRedaction: true });
  const result = await client.domain(domain);

  // Only extract what you need
  return {
    domain: result.ldhName,
    expires: result.events?.find(
      e => e.eventAction === 'expiration'
    )?.eventDate,
  };
  // All PII is redacted, and you only return the expiry date
}
```

### المبدأ الثاني: تقييد الغرض

وثّق سبب احتياجك للبيانات ولا تستخدمها لأغراض أخرى:

```typescript
// Good: Security investigation with documented purpose
async function investigateDomain(domain: string, incidentId: string) {
  const client = new RDAPClient();
  const result = await client.domain(domain);

  // Log the purpose
  console.log(`RDAP query for incident ${incidentId}: ${domain}`);

  return {
    domain: result.ldhName,
    status: result.status,
    nameservers: result.nameservers?.map(ns => ns.ldhName),
    registrationDate: result.events?.find(
      e => e.eventAction === 'registration'
    )?.eventDate,
    // No contact PII needed for status investigation
  };
}
```

### المبدأ الثالث: تقييد التخزين

لا تحتفظ باستجابات RDAP أطول من اللازم:

```typescript
const client = new RDAPClient({
  cache: {
    ttl: 3600,  // Cache for 1 hour, then discard
  },
});

// Cached responses are automatically expired
// No long-term PII storage
```

### المبدأ الرابع: مسار التدقيق

سجّل البيانات التي تصل إليها ولماذا:

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

// Use middleware to log queries
client.use({
  name: 'audit-logger',
  beforeQuery: (query) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      action: 'rdap_query',
      queryType: query.type,
      queryValue: query.value,
      purpose: 'domain_monitoring',
    }));
    return query;
  },
});
```

## مرجع سريع للوائح الخصوصية

| اللائحة | المنطقة | المتطلبات الرئيسية لبيانات النطاقات |
|-----------|--------|--------------------------------|
| **GDPR** | EU/EEA | أساس قانوني مطلوب، تقليل البيانات، الحق في المحو، مسؤول حماية بيانات للمعالجة الجماعية |
| **CCPA/CPRA** | كاليفورنيا | الانسحاب من البيع، الحق في المعرفة، الحق في الحذف |
| **LGPD** | البرازيل | مماثل لـ GDPR، قائم على الموافقة، مسؤول حماية البيانات |
| **PIPEDA** | كندا | موافقة مطلوبة، تقييد الغرض، حقوق الوصول |
| **POPIA** | جنوب أفريقيا | معالجة مشروعة، تقليل البيانات، ضمانات الأمان |

### الأسس القانونية لـ GDPR لعمليات البحث عن النطاقات

1. **المصلحة المشروعة** (الأكثر شيوعًا) — البحث الأمني، حماية العلامة التجارية، منع الاحتيال
2. **الالتزام القانوني** — الامتثال لأوامر المحاكم، المتطلبات التنظيمية
3. **الضرورة التعاقدية** — عمليات المسجّلين، خدمات إدارة النطاقات
4. **الموافقة** — يوافق المستخدم صراحةً على معالجة البيانات (نادر في RDAP)

## الأخطاء الشائعة التي يجب تجنبها

### الخطأ الأول: تخزين استجابات RDAP الكاملة

```typescript
// BAD: Storing everything including PII
const result = await client.domain('example.com');
await database.save('rdap_cache', result); // Contains PII!

// GOOD: Store only non-PII fields
const result = await client.domain('example.com');
await database.save('domain_status', {
  domain: result.ldhName,
  status: result.status,
  expires: result.events?.find(e => e.eventAction === 'expiration')?.eventDate,
  nameservers: result.nameservers?.map(ns => ns.ldhName),
  // No contact entities stored
});
```

### الخطأ الثاني: كشف PII في السجلات

```typescript
// BAD: Logging full responses
console.log('RDAP result:', JSON.stringify(result));

// GOOD: Log only non-sensitive fields
console.log('RDAP result:', {
  domain: result.ldhName,
  status: result.status,
  queryTime: Date.now(),
});
```

### الخطأ الثالث: غياب سياسة الاحتفاظ بالبيانات

حدد فترات احتفاظ واضحة واحذف البيانات القديمة تلقائيًا:

```typescript
// Implement automatic cleanup
async function cleanupOldRecords() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  await database.deleteWhere('rdap_queries', {
    createdAt: { $lt: thirtyDaysAgo },
  });
}
```

## قائمة مراجعة: تكامل RDAP المتوافق مع الخصوصية

- [ ] تمكين حجب PII في عميل RDAP
- [ ] توثيق الأساس القانوني لمعالجة بيانات التسجيل
- [ ] تطبيق تقليل البيانات — استخرج الحقول التي تحتاجها فقط
- [ ] تعيين مدد صلاحية الكاش/التخزين — لا تحتفظ بالبيانات أطول من اللازم
- [ ] إضافة سجلات تدقيق لجميع استعلامات RDAP
- [ ] عدم تسجيل PII في سجلات التطبيق
- [ ] تطبيق إجراءات حذف البيانات
- [ ] مراجعة سياسة الخصوصية لتشمل بيانات البحث عن النطاقات
- [ ] تدريب فريقك على التعامل مع بيانات التسجيل

## الخلاصة

صُمّم RDAP مع مراعاة الخصوصية، لكن البروتوكول وحده لا يجعلك متوافقًا. تحتاج إلى التعامل الحذر مع الاستجابات، وتقليل جمع البيانات، وتطبيق الضمانات المناسبة. يمنحك حجب PII المدمج في RDAPify نقطة انطلاق قوية.

---

*تعرّف على المزيد حول ميزات الخصوصية في RDAPify في [وثائقنا](/docs/getting-started/installation) أو راجع [سياسة الخصوصية](/privacy).*
