---
slug: understanding-rdap-protocol-replacing-whois
title: "فهم بروتوكول RDAP: البروتوكول الذي يحل محل WHOIS"
authors: [rdapify]
tags: [rdap, protocol, internet-standards, education]
description: "مقدمة شاملة لـ RDAP (بروتوكول الوصول إلى بيانات التسجيل). تعلم ما هو RDAP وكيف يعمل وأنواع كائناته ولماذا يحل محل WHOIS كمعيار لبيانات تسجيل الإنترنت."
keywords: [what is rdap, rdap explained, rdap protocol, registration data access protocol, rdap standard, rdap rfc, how rdap works]
image: /img/rdapify-social-card.png
---

RDAP (بروتوكول الوصول إلى بيانات التسجيل) هو المعيار الحديث للاستعلام عن بيانات تسجيل الإنترنت — أسماء النطاقات وعناوين IP وأرقام الأنظمة المستقلة. إذا كنت تعمل في مجال DNS أو الشبكات أو الأمن السيبراني أو إدارة النطاقات، فـ RDAP بروتوكول تحتاج إلى معرفته.

يشرح هذا المقال RDAP من الصفر: ما هو، وكيف يعمل، وما الذي يمكنك فعله به.

<!-- truncate -->

## ما هو RDAP؟

RDAP اختصار لـ **Registration Data Access Protocol** (بروتوكول الوصول إلى بيانات التسجيل). وهو مجموعة من معايير IETF (RFC 7480-7484، محدَّثة بـ RFC 9082-9083) التي تحدد كيفية الاستعلام عن بيانات التسجيل واسترجاعها لموارد الإنترنت.

فكر فيه كواجهة برمجية RESTful منظمة وآمنة للبحث عن:

- **من سجّل اسم نطاق** ومتى ينتهي
- **من يمتلك كتلة عناوين IP** وأين خُصِّصت
- **من يشغّل نظامًا مستقلًا** (ASN) وتفاصيل الاتصال به

## كيف يعمل RDAP

### تدفق الطلب

```
1. Client wants to look up "example.com"
2. Client queries IANA bootstrap to find the right RDAP server
3. IANA says: ".com domains → rdap.verisign.com"
4. Client sends: GET https://rdap.verisign.com/com/v1/domain/example.com
5. Server responds with structured JSON
```

### Bootstrap: إيجاد الخادم المناسب

على خلاف WHOIS (حيث تحتاج إلى معرفة الخادم المطلوب الاستعلام عنه)، يستخدم RDAP نظام **Bootstrap**. تحتفظ IANA بملفات JSON تُعيِّن:

- امتدادات النطاقات TLDs ← روابط خوادم RDAP
- نطاقات IP ← روابط خوادم RDAP (ARIN، RIPE، APNIC، إلخ)
- نطاقات ASN ← روابط خوادم RDAP

هذه الملفات متاحة للعموم على `https://data.iana.org/rdap/`.

### أنماط URL

يستخدم RDAP أنماط URL متسقة وفق أسلوب RESTful:

```
# Domain lookup
GET {base}/domain/{name}
GET https://rdap.verisign.com/com/v1/domain/example.com

# IP lookup
GET {base}/ip/{address}
GET https://rdap.arin.net/registry/ip/8.8.8.8

# IP network lookup
GET {base}/ip/{prefix}/{length}
GET https://rdap.arin.net/registry/ip/8.8.8.0/24

# ASN lookup
GET {base}/autnum/{number}
GET https://rdap.arin.net/registry/autnum/15169

# Nameserver lookup
GET {base}/nameserver/{name}

# Entity (contact) lookup
GET {base}/entity/{handle}
```

## أنواع الكائنات الخمسة في RDAP

### 1. النطاق (Domain)

الكائن الأكثر استعلامًا. يعيد معلومات التسجيل وخوادم الأسماء والحالة والأحداث.

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();
const domain = await client.domain('google.com');

// Key fields
domain.ldhName;       // "google.com"
domain.status;        // ["client delete prohibited", "client transfer prohibited", ...]
domain.events;        // Registration, expiration, last changed dates
domain.nameservers;   // NS records
domain.entities;      // Registrant, admin, tech contacts
domain.secureDNS;     // DNSSEC information
```

### 2. شبكة IP (IP Network)

تعيد معلومات حول عنوان IP أو كتلة شبكة، بما في ذلك المؤسسة المالكة للتخصيص.

```typescript
const ip = await client.ip('8.8.8.8');

ip.name;         // "GOGL" (network name)
ip.startAddress; // "8.8.8.0"
ip.endAddress;   // "8.8.8.255"
ip.country;      // "US"
ip.type;         // "DIRECT ALLOCATION"
ip.entities;     // Google LLC contact info
```

### 3. رقم النظام المستقل (ASN)

يعيد معلومات حول من يشغّل رقم ASN محدد.

```typescript
const asn = await client.asn(15169);

asn.handle; // "AS15169"
asn.name;   // "GOOGLE"
asn.type;   // "DIRECT ALLOCATION"
asn.events; // Registration and last changed dates
```

### 4. خادم الأسماء (Nameserver)

يعيد معلومات حول خادم أسماء محدد.

```typescript
const ns = await client.nameserver('ns1.google.com');

ns.ldhName;      // "ns1.google.com"
ns.ipAddresses;  // { v4: ["216.239.32.10"], v6: ["2001:4860:4802:32::a"] }
```

### 5. الكيان (Entity)

يعيد معلومات حول جهة اتصال مسجَّلة (شخص أو مؤسسة).

```typescript
const entity = await client.entity('GOGL');

entity.handle;   // "GOGL"
entity.roles;    // ["registrant"]
entity.vcardArray; // Contact info in jCard format
```

## هيكل استجابة RDAP

كل استجابة RDAP تتبع هيكلًا متسقًا:

```json
{
  "objectClassName": "domain",
  "handle": "unique-id",
  "ldhName": "example.com",
  "unicodeName": "example.com",

  "status": ["active", "client transfer prohibited"],

  "events": [
    {
      "eventAction": "registration",
      "eventDate": "2024-01-15T00:00:00Z"
    }
  ],

  "entities": [
    {
      "objectClassName": "entity",
      "roles": ["registrant"],
      "vcardArray": ["vcard", [
        ["fn", {}, "text", "John Doe"],
        ["email", {}, "text", "john@example.com"]
      ]]
    }
  ],

  "links": [
    {
      "rel": "self",
      "href": "https://rdap.example.com/domain/example.com",
      "type": "application/rdap+json"
    }
  ],

  "notices": [
    {
      "title": "Terms of Use",
      "description": ["Service subject to terms at ..."]
    }
  ],

  "rdapConformance": ["rdap_level_0", "icann_rdap_response_profile_0"]
}
```

### الأقسام الرئيسية

- **status** — رموز الحالة القياسية (RFC 8056): `active`، `inactive`، `locked`، `client delete prohibited`، إلخ
- **events** — أحداث دورة الحياة بطوابع زمنية: `registration`، `expiration`، `last changed`، `transfer`
- **entities** — جهات الاتصال مع أدوارها: `registrant`، `administrative`، `technical`، `abuse`
- **links** — روابط بأسلوب HATEOAS للتنقل بين الكائنات المرتبطة
- **notices** — شروط الخدمة ومعلومات حدود المعدل وإشعارات الحذف
- **rdapConformance** — يعلن عن امتدادات RDAP التي يدعمها الخادم

## معايير RDAP (RFCs)

| RFC | العنوان |
|-----|---------|
| RFC 7480 | استخدام HTTP في بروتوكول الوصول إلى بيانات التسجيل |
| RFC 7481 | خدمات الأمان لـ RDAP |
| RFC 7482 | صيغة الاستعلام في بروتوكول الوصول إلى بيانات التسجيل |
| RFC 7483 | استجابات JSON لـ RDAP |
| RFC 7484 | إيجاد خدمة بيانات التسجيل الموثوقة |
| RFC 8056 | تعيين حالات EPP لـ RDAP |
| RFC 9082 | صيغة الاستعلام في RDAP (محدَّث) |
| RFC 9083 | استجابات JSON لـ RDAP (محدَّث) |
| RFC 9224 | إيجاد خدمة RDAP الموثوقة (محدَّث) |

## الاستعلام عبر RDAP باستخدام RDAPify

يُجرِّد RDAPify تعقيدات اكتشاف Bootstrap والتفاوض على HTTP وتحليل الاستجابات:

```bash
npm install rdapify
```

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  cache: { ttl: 3600 },     // Built-in response caching
  timeout: 10000,            // 10s timeout
});

// All five object types
const domain = await client.domain('example.com');
const ip = await client.ip('192.0.2.1');
const asn = await client.asn(64496);
const ns = await client.nameserver('ns1.example.com');
const entity = await client.entity('EXAMPLE-HANDLE');
```

لا داعي لاكتشاف الخوادم يدويًا، أو تحليل ملفات Bootstrap، أو التعامل مع التفاوض على محتوى HTTP. يتولى RDAPify كل ذلك.

## الخلاصة

RDAP بروتوكول حديث ومُصمَّم بعناية يحل المشاكل الحقيقية في WHOIS. سواء كنت تبني أداة أمنية أو منصة إدارة نطاقات أو نظام امتثال، فإن فهم أساسيات RDAP سيفيدك كثيرًا.

البروتوكول حي ومُفعَّل بالفعل ويُعدّ مرجعًا لمعظم بيانات تسجيل الإنترنت. الوقت الآن هو لتعلمه والبناء عليه.

---

*هل أنت مستعد للبدء؟ ثبّت RDAPify بالأمر `npm install rdapify` واتبع [دليل البدء السريع](/docs/getting-started/installation).*
