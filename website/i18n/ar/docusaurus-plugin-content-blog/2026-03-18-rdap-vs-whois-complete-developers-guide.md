---
slug: rdap-vs-whois-complete-developers-guide
title: "RDAP مقابل WHOIS: الدليل الشامل للمطورين (2026)"
authors: [rdapify]
tags: [rdap, whois, comparison, tutorial]
description: "مقارنة تقنية مفصّلة بين RDAP وWHOIS للمطورين. فهم الفوارق في البروتوكول وصيغة البيانات والأمان، مع أمثلة كود حقيقية لكليهما."
keywords: [rdap vs whois, rdap whois comparison, domain lookup protocol, whois replacement 2026, rdap tutorial, registration data protocol]
image: /img/rdapify-social-card.png
---

الاختيار بين RDAP وWHOIS في عام 2026 ليس حقًا خيارًا — RDAP هو الخلف الواضح. لكن فهم *لماذا* و*كيف* يختلفان يساعدك على بناء أدوات استخبارات نطاقات أفضل. يستعرض هذا الدليل كل فرق تقني مع أمثلة كود حقيقية.

<!-- truncate -->

## بنية البروتوكول

### WHOIS: نص عبر TCP

يستخدم WHOIS اتصالًا TCP بسيطًا على المنفذ 43. ترسل سلسلة استعلام وتحصل على نص غير منظم:

```
Client → TCP:43 → "example.com\r\n"
Server → TCP:43 → "Domain Name: EXAMPLE.COM\r\n..."
```

لا يوجد مخطط، ولا تفاوض على المحتوى، ولا رموز أخطاء. إذا لم يفهم الخادم استعلامك، قد تحصل على رسالة خطأ — أو مجرد استجابة فارغة. لا توجد طريقة للتحقق برمجيًا.

### RDAP: HTTPS بأسلوب RESTful

يستخدم RDAP بروتوكول HTTPS القياسي مع أنماط URL على أسلوب RESTful:

```
GET https://rdap.verisign.com/com/v1/domain/example.com
Accept: application/rdap+json

→ HTTP/1.1 200 OK
  Content-Type: application/rdap+json
  {
    "objectClassName": "domain",
    "ldhName": "example.com",
    ...
  }
```

رموز حالة HTTP قياسية (200، 404، 429) وتفاوض على نوع المحتوى ورؤوس التخزين المؤقت.

## مقارنة صيغ البيانات

### استجابة WHOIS (غير منظمة)

```text
Domain Name: EXAMPLE.COM
Registry Domain ID: 2336799_DOMAIN_COM-VRSN
Registrar WHOIS Server: whois.iana.org
Registrar URL: http://www.iana.org
Updated Date: 2024-08-14T07:01:38Z
Creation Date: 1995-08-14T04:00:00Z
Registry Expiry Date: 2025-08-13T04:00:00Z
Registrar: RESERVED-Internet Assigned Numbers Authority
Domain Status: clientDeleteProhibited
Name Server: A.IANA-SERVERS.NET
Name Server: B.IANA-SERVERS.NET
```

تحليل هذا النص يتطلب تعبيرات regex مخصصة لكل مسجِّل. بعضهم يستخدم "Creation Date" وآخرون "Created" وبعضهم "Registration Date".

### استجابة RDAP (JSON منظم)

```json
{
  "objectClassName": "domain",
  "handle": "2336799_DOMAIN_COM-VRSN",
  "ldhName": "example.com",
  "status": ["client delete prohibited"],
  "events": [
    {
      "eventAction": "registration",
      "eventDate": "1995-08-14T04:00:00Z"
    },
    {
      "eventAction": "last changed",
      "eventDate": "2024-08-14T07:01:38Z"
    },
    {
      "eventAction": "expiration",
      "eventDate": "2025-08-13T04:00:00Z"
    }
  ],
  "nameservers": [
    {
      "objectClassName": "nameserver",
      "ldhName": "a.iana-servers.net"
    },
    {
      "objectClassName": "nameserver",
      "ldhName": "b.iana-servers.net"
    }
  ]
}
```

لكل حقل اسم محدد. التواريخ دائمًا بصيغة ISO 8601. رموز الحالة موحدة.

## مقارنة الكود

### البحث عن نطاق: طريقة WHOIS

```javascript
// Using a WHOIS library
const whois = require('whois');

whois.lookup('example.com', (err, data) => {
  if (err) throw err;

  // Parse unstructured text... good luck
  const creationMatch = data.match(
    /Creat(?:ion|ed)\s*Date:\s*(.+)/i
  );
  const expiryMatch = data.match(
    /(?:Expir(?:y|ation)|Registry Expiry)\s*Date:\s*(.+)/i
  );

  const created = creationMatch ? new Date(creationMatch[1]) : null;
  const expires = expiryMatch ? new Date(expiryMatch[1]) : null;
  // Fragile, breaks when registrar changes format
});
```

### البحث عن نطاق: طريقة RDAP

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();
const domain = await client.domain('example.com');

// Structured, typed access
const created = domain.events.find(
  e => e.eventAction === 'registration'
)?.eventDate;

const expires = domain.events.find(
  e => e.eventAction === 'expiration'
)?.eventDate;

// Works for every registrar, every TLD
```

## مقارنة الأمان

| الجانب | WHOIS | RDAP |
|--------|-------|------|
| تشفير النقل | لا يوجد (TCP نص واضح) | TLS (HTTPS) |
| التوثيق | غير مدعوم | HTTP Auth (Basic، Bearer، OAuth) |
| التحكم في الوصول | الكل أو لا شيء | استجابات متباينة حسب الدور |
| معيار تحديد المعدل | لا يوجد (مخصص) | HTTP 429 + رأس Retry-After |
| التحقق من المدخلات | حسب الخادم | معيار HTTP |
| مخاطر SSRF | المنفذ 43 — غير معتاد | المنفذ 443 — قواعد جدار حماية قياسية |

### الوصول المتباين في RDAP

يمكن لخوادم RDAP إعادة بيانات مختلفة حسب هوية المستعلِم:

- **المستخدمون المجهولون** — معلومات النطاق الأساسية وجهات الاتصال المُنقَّحة
- **المسجِّلون الموثَّقون** — تفاصيل الاتصال الكاملة
- **جهات إنفاذ القانون** — بيانات غير مُنقَّحة مع مسار تدقيق

هذا غير ممكن مع WHOIS.

## اكتشاف الخدمة

### WHOIS: خوادم مُرمَّزة يدويًا

مع WHOIS، تحتاج إلى معرفة الخادم المطلوب الاستعلام عنه:

```
.com → whois.verisign-grs.com
.net → whois.verisign-grs.com
.org → whois.pir.org
.uk  → whois.nic.uk
```

امتدادات TLD جديدة؟ عليك تحديث قائمة الخوادم يدويًا.

### RDAP: Bootstrap الخاص بـ IANA

يستخدم RDAP [ملفات Bootstrap الخاصة بـ IANA](https://data.iana.org/rdap/) لاكتشاف الخادم الصحيح تلقائيًا:

```typescript
// RDAPify handles bootstrap automatically
const client = new RDAPClient();

// Works for any TLD — discovers the right server
await client.domain('example.com');     // → Verisign RDAP
await client.domain('example.org');     // → PIR RDAP
await client.domain('example.uk');      // → Nominet RDAP
await client.domain('example.xyz');     // → Centralnic RDAP
```

لا قوائم خوادم مُرمَّزة. لا صيانة يدوية.

## التدويل

WHOIS مقيَّد بـ ASCII. يدعم RDAP Unicode بالكامل:

```typescript
const client = new RDAPClient();

// Internationalized domain names work natively
const domain = await client.domain('example.xn--p1ai'); // .рф (Russian)

// Unicode contact data is properly encoded
// Not garbled or transliterated like WHOIS
```

## مقارنة الأداء

| المقياس | WHOIS | RDAP |
|---------|-------|------|
| إعادة استخدام الاتصال | لا (TCP جديد لكل استعلام) | نعم (HTTP keep-alive) |
| التخزين المؤقت | غير موحَّد | رؤوس HTTP Cache-Control |
| الضغط | لا | gzip/brotli عبر HTTP |
| التوجيه | لا | HTTP/2 multiplexing |

مع كاش RDAPify المدمج:

```typescript
const client = new RDAPClient({
  cache: { ttl: 3600 } // Cache responses for 1 hour
});

// First call: network request (~200ms)
await client.domain('example.com');

// Second call: cache hit (~1ms)
await client.domain('example.com');
```

## متى تستخدم كلًا منهما

**استخدم RDAP** (الموصى به) عند:
- بناء تطبيقات جديدة
- الحاجة إلى بيانات منظمة وموثوقة
- الحاجة إلى الأمان (TLS، التوثيق)
- الاستعلام عن نطاقات دولية
- الحاجة إلى الامتثال (GDPR)

**WHOIS لا يزال ضروريًا** عند:
- الاستعلام عن خوادم قديمة لم تُهجَّر بعد
- بعض امتدادات ccTLD لا تزال تقدم WHOIS فقط (في تناقص)
- الأدوات الداخلية ذات تحليل WHOIS موجود لا يمكن إعادة كتابته الآن

## الخلاصة

RDAP متفوق بكل معيار قابل للقياس: الأمان والموثوقية والتحليل والأداء والتدويل والامتثال. السبب الوحيد لاستخدام WHOIS في عام 2026 هو التوافق مع الإصدارات السابقة — وهذه النافذة تضيق.

```bash
# Start using RDAP today
npm install rdapify
```

---

*هل تحتاج مساعدة في الترحيل من WHOIS إلى RDAP؟ اطّلع على [دليل الترحيل](/blog/whois-to-rdap-enterprise-migration-guide) أو اطرح سؤالك في [GitHub Discussions](https://github.com/rdapify/rdapify/discussions).*
