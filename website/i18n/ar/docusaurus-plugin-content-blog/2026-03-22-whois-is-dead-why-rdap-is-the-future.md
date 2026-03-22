---
slug: whois-is-dead-why-rdap-is-the-future
title: "WHOIS مات: لماذا RDAP هو مستقبل البحث عن النطاقات"
authors: [rdapify]
tags: [rdap, whois, domain-lookup, internet-standards]
description: "خدم WHOIS الإنترنت أكثر من 40 عامًا، لكنه في طريقه إلى الاستبدال. تعلم لماذا RDAP هو المعيار الحديث لبيانات تسجيل النطاقات وكيف تبدأ باستخدامه اليوم."
keywords: [whois alternative, rdap protocol, domain lookup api, whois replacement, rdap vs whois, domain registration data]
image: /img/rdapify-social-card.png
---

كان WHOIS العمود الفقري لعمليات بحث تسجيل النطاقات منذ عام 1982. لكن بعد أكثر من 40 عامًا من الخدمة، يُستبدل رسميًا. أصدرت ICANN قرارًا بالانتقال إلى RDAP (بروتوكول الوصول إلى بيانات التسجيل)، وبدأت السجلات الكبرى في إجراء التحول.

إذا كنت لا تزال تبني على WHOIS، إليك لماذا يجب أن تُهاجر — وكيف تفعل ذلك بسلاسة.

<!-- truncate -->

## مشكلة WHOIS

صُمِّم WHOIS في عصر كان الإنترنت فيه يضم أقل من 300 مضيفًا. لم يُبنَ قط للويب الحديث:

- **لا صيغة موحَّدة** — يُعيد كل مسجِّل بيانات بصيغة نصية مختلفة، مما يجعل التحليل كابوسًا
- **لا توثيق** — يستطيع أي شخص الاستعلام عن أي شيء دون أي تحكم في الوصول
- **لا دعم للتدويل** — مقيَّد بـ ASCII، مُخفق أمام مليارات مستخدمي غير الإنجليزية
- **لا تشفير** — تنتقل الاستعلامات والاستجابات كنص واضح عبر المنفذ 43
- **فوضى في تحديد المعدل** — يُطبِّق كل خادم حدوده الخاصة دون معيار موحَّد

```bash
# Traditional WHOIS - unstructured text output
$ whois example.com
Domain Name: EXAMPLE.COM
Registry Domain ID: 2336799_DOMAIN_COM-VRSN
Registrar WHOIS Server: whois.iana.org
Updated Date: 2024-08-14T07:01:38Z
# ... every registrar formats this differently
```

## جاء RDAP: المعيار الحديث

يحل RDAP (المُعرَّف في [RFC 7480-7484](https://datatracker.ietf.org/doc/rfc7480/)) كل مشكلة في WHOIS:

| الميزة | WHOIS | RDAP |
|--------|-------|------|
| صيغة البيانات | نص غير منظم | JSON منظم |
| النقل | TCP المنفذ 43 | HTTPS (المنفذ 443) |
| التوثيق | لا يوجد | Auth عبر HTTP |
| التدويل | ASCII فقط | Unicode كامل (دعم IDN) |
| اكتشاف الخدمة | يدوي | آلي عبر Bootstrap الخاص بـ IANA |
| التشفير | لا يوجد | TLS افتراضيًا |
| التحكم في الوصول | لا يوجد | تمييز حسب الدور |

### استجابات JSON منظمة

مع RDAP، تحصل على JSON نظيف وقابل للتحليل:

```json
{
  "objectClassName": "domain",
  "handle": "EXAMPLE-DOM",
  "ldhName": "example.com",
  "status": ["active"],
  "events": [
    {
      "eventAction": "registration",
      "eventDate": "1995-08-14T04:00:00Z"
    },
    {
      "eventAction": "expiration",
      "eventDate": "2025-08-13T04:00:00Z"
    }
  ],
  "nameservers": [
    { "ldhName": "a.iana-servers.net" },
    { "ldhName": "b.iana-servers.net" }
  ]
}
```

لا مزيد من التعقيدات مع تعبيرات regex. لا مزيد من المُحللين المعطوبين حين يغيِّر المسجِّل صيغة نصه.

## الجدول الزمني لـ ICANN: إيقاف تشغيل WHOIS

كانت ICANN واضحة بشأن عملية الانتقال:

- **2015** — نشر معيار RDAP (RFC 7480-7484)
- **2019** — إلزام سجلات gTLD والمسجِّلين بدعم RDAP
- **2024** — ICANN تبدأ في التخلص التدريجي من متطلبات WHOIS
- **2025+** — السجلات تُوقف تدريجيًا نقاط نهاية WHOIS

الأمر واضح. السجلات الكبرى كـ Verisign وARIN وRIPE NCC تُعطي الأولوية لـ RDAP على WHOIS بالفعل.

## البدء مع RDAP باستخدام RDAPify

[RDAPify](https://github.com/rdapify/rdapify) هو عميل RDAP TypeScript-first يتولى كل التعقيدات نيابةً عنك:

```bash
npm install rdapify
```

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

// Domain lookup
const domain = await client.domain('example.com');
console.log(domain.events);     // Registration, expiration dates
console.log(domain.nameservers); // NS records
console.log(domain.status);      // Domain status codes

// IP lookup
const ip = await client.ip('8.8.8.8');
console.log(ip.name);    // Network name
console.log(ip.country); // Country code

// ASN lookup
const asn = await client.asn(15169);
console.log(asn.name); // "GOOGLE"
```

### لماذا RDAPify؟

- **Bootstrap الخاص بـ IANA آليًا** — يكتشف خادم RDAP الصحيح لأي استعلام
- **تخزين مؤقت مدمج** — يُقلِّل طلبات الشبكة الزائدة
- **حماية SSRF** — يمنع هجمات تزوير الطلبات جانب الخادم
- **تنقيح PII** — معالجة استجابات متوافقة مع GDPR
- **TypeScript أصلي** — أمان كامل للأنواع مع دعم IntelliSense

## قائمة مراجعة الترحيل

هل أنت مستعد للانتقال من WHOIS إلى RDAP؟ إليك قائمة المراجعة:

1. **مراجعة استخدام WHOIS الحالي** — ابحث عن جميع الأماكن التي يستدعي فيها كودك WHOIS
2. **تثبيت عميل RDAP** — `npm install rdapify`
3. **تعيين حقول WHOIS إلى RDAP** — لمعظم الحقول ما يعادلها مباشرةً في RDAP
4. **تحديث تحليل الاستجابات** — JSON بدلًا من تحليل النصوص
5. **الاختبار بالاستعلامات الحقيقية** — تحقق من أن الإخراج يلبي توقعاتك
6. **إزالة تبعيات WHOIS** — نظِّف كود التحليل القديم
7. **المراقبة والتخزين المؤقت** — يدعم RDAP رؤوس HTTP للتخزين المؤقت

## الخلاصة

خدم WHOIS الإنترنت بشكل جيد لأربعة عقود، لكن وقته قد انتهى. يُدخل RDAP بيانات تسجيل النطاقات إلى العصر الحديث مع البيانات المنظمة والتشفير والتدويل والتحكم المناسب في الوصول.

الانتقال ليس اختياريًا — إنه يحدث الآن. كلما أسرعت في الترحيل، كلما تراكمت عليك ديون تقنية أقل.

ابدأ بـ `npm install rdapify` وأجرِ أول استعلام RDAP في أقل من 5 دقائق.

---

*هل لديك أسئلة حول الترحيل من WHOIS إلى RDAP؟ انضم إلى [GitHub Discussions](https://github.com/rdapify/rdapify/discussions) أو اطّلع على [دليل البدء السريع](/docs/getting-started/installation).*
