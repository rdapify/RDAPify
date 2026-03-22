---
slug: asn-lookup-made-simple-with-rdap
title: "البحث عن ASN بسهولة: الاستعلام عن أرقام الأنظمة المستقلة باستخدام RDAP"
authors: [rdapify]
tags: [rdap, asn, networking, bgp, tutorial]
description: "تعلم كيفية البحث عن أرقام الأنظمة المستقلة (ASN) باستخدام RDAP. افهم تخصيصات ASN، وحدد مشغلي الشبكة، وابنِ أدوات استخبارات ASN بأمثلة كود عملية."
keywords: [asn lookup, autonomous system number, asn whois, bgp asn lookup, who owns asn, asn information api, asn query tool]
image: /img/rdapify-social-card.png
---

كل شبكة رئيسية على الإنترنت تُعرَّف برقم نظام مستقل (ASN). سواء كنت تحلل مسارات BGP، أو تحقق في ملكية الشبكة، أو تبني أدوات استخبارات البنية التحتية، فإن البحث عن ASN يُعدّ قدرة أساسية. إليك كيفية القيام بذلك باستخدام RDAP.

<!-- truncate -->

## ما هو ASN؟

**رقم النظام المستقل (ASN)** هو معرف فريد يُسنَد إلى شبكة أو مجموعة شبكات خاضعة لسلطة إدارية واحدة. كل مؤسسة تدير سياسة توجيه خاصة بها على الإنترنت لديها رقم ASN.

بعض أرقام ASN الشهيرة:

| رقم ASN | المؤسسة | الوصف |
|-----|-------------|-------------|
| AS15169 | Google | رقم ASN الرئيسي لـ Google |
| AS13335 | Cloudflare | شبكة Cloudflare العالمية |
| AS16509 | Amazon | بنية AWS التحتية |
| AS32934 | Meta (Facebook) | شبكة Meta |
| AS8075 | Microsoft | شبكة Microsoft العالمية |
| AS714 | Apple | شبكة Apple |

أرقام ASN إما **2 بايت** (0–65535) أو **4 بايت** (0–4294967295، أُدخلت لمعالجة نفاد مساحة 2 بايت).

## الاستعلام عن ASN باستخدام RDAP

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

// Look up Google's ASN
const asn = await client.asn(15169);

console.log(asn.handle);  // "AS15169"
console.log(asn.name);    // "GOOGLE"
console.log(asn.type);    // "DIRECT ALLOCATION"
console.log(asn.status);  // ["active"]
```

### استجابة ASN الكاملة

```typescript
const asn = await client.asn(13335); // Cloudflare

// Registration events
for (const event of asn.events ?? []) {
  console.log(`${event.eventAction}: ${event.eventDate}`);
}
// registration: 2010-07-14T00:00:00Z
// last changed: 2024-01-10T15:20:00Z

// Contact entities
for (const entity of asn.entities ?? []) {
  console.log(`Role: ${entity.roles?.join(', ')}`);
  console.log(`Handle: ${entity.handle}`);
}

// Links to related resources
for (const link of asn.links ?? []) {
  console.log(`${link.rel}: ${link.href}`);
}
```

## فهم تخصيص ASN

تُدار مساحة ASN بشكل هرمي:

```
IANA (global)
  ├── ARIN    (AS1-AS65535 partial, various 4-byte blocks)
  ├── RIPE    (AS1-AS65535 partial, various 4-byte blocks)
  ├── APNIC   (various ranges)
  ├── AFRINIC (various ranges)
  └── LACNIC  (various ranges)
```

يُوجّه Bootstrap الخاص بـ RDAP استعلامك تلقائيًا إلى سجل RIR الصحيح.

### نطاقات ASN حسب سجل RIR

```typescript
const client = new RDAPClient();

// These automatically go to the correct RIR
await client.asn(15169);  // → ARIN (Google, US)
await client.asn(13335);  // → ARIN (Cloudflare, US)
await client.asn(3356);   // → ARIN (Lumen/CenturyLink)
await client.asn(6805);   // → RIPE (Telefonica Germany)
await client.asn(4766);   // → APNIC (Korea Telecom)
await client.asn(37100);  // → AFRINIC (SEACOM, Africa)
await client.asn(28001);  // → LACNIC (TeleCentro, Argentina)
```

## حالات استخدام عملية

### حالة الاستخدام الأولى: التعرف على مشغل الشبكة

```typescript
async function identifyOperator(asnNumber: number) {
  const client = new RDAPClient({ cache: { ttl: 86400 } });
  const asn = await client.asn(asnNumber);

  const registrant = asn.entities?.find(
    e => e.roles?.includes('registrant')
  );

  return {
    asn: asn.handle,
    name: asn.name,
    type: asn.type,
    registered: asn.events?.find(
      e => e.eventAction === 'registration'
    )?.eventDate,
    registrant: registrant?.handle,
  };
}

const operator = await identifyOperator(15169);
// { asn: "AS15169", name: "GOOGLE", type: "DIRECT ALLOCATION", ... }
```

### حالة الاستخدام الثانية: استخبارات ASN الجماعية

```typescript
async function buildASNReport(asns: number[]) {
  const client = new RDAPClient({ cache: { ttl: 86400 } });

  const results = await Promise.all(
    asns.map(async (num) => {
      try {
        const data = await client.asn(num);
        return {
          asn: num,
          name: data.name ?? 'Unknown',
          handle: data.handle,
          status: data.status?.[0] ?? 'unknown',
          type: data.type ?? 'unknown',
        };
      } catch {
        return {
          asn: num,
          name: 'Error',
          handle: `AS${num}`,
          status: 'error',
          type: 'unknown',
        };
      }
    })
  );

  return results;
}

const report = await buildASNReport([
  15169, 13335, 16509, 32934, 8075
]);

console.table(report);
// ┌─────────┬───────┬──────────────┬───────────┬────────┬──────────────────┐
// │ (index) │  asn  │     name     │  handle   │ status │      type        │
// ├─────────┼───────┼──────────────┼───────────┼────────┼──────────────────┤
// │    0    │ 15169 │   "GOOGLE"   │ "AS15169" │ active │ DIRECT ALLOCATION│
// │    1    │ 13335 │ "CLOUDFLARENET"│"AS13335"│ active │ DIRECT ALLOCATION│
// │    2    │ 16509 │  "AMAZON-02" │ "AS16509" │ active │ DIRECT ALLOCATION│
// │    3    │ 32934 │ "FACEBOOK"   │ "AS32934" │ active │ DIRECT ALLOCATION│
// │    4    │  8075 │ "MICROSOFT"  │ "AS8075"  │ active │ DIRECT ALLOCATION│
// └─────────┴───────┴──────────────┴───────────┴────────┴──────────────────┘
```

### حالة الاستخدام الثالثة: ربط ASN بالمؤسسة

```typescript
async function mapASNtoOrg(asnNumber: number) {
  const client = new RDAPClient();
  const asn = await client.asn(asnNumber);

  // Extract organization info from entities
  const orgEntity = asn.entities?.find(
    e => e.roles?.includes('registrant') || e.roles?.includes('administrative')
  );

  let orgName = asn.name;

  if (orgEntity?.vcardArray) {
    const vcard = orgEntity.vcardArray[1];
    const fn = vcard.find((f: string[]) => f[0] === 'fn');
    if (fn) orgName = fn[3] as string;
  }

  return {
    asn: `AS${asnNumber}`,
    organization: orgName,
    registeredTo: orgEntity?.handle,
  };
}
```

## البحث عن ASN مقابل البحث عن IP

أحيانًا لديك عنوان IP وتريد العثور على رقم ASN الخاص به، أو العكس. إليك كيفية ارتباطهما:

```
IP Address → IP RDAP Lookup → Network Block → Organization
ASN        → ASN RDAP Lookup → Operator Info → Contact Details
```

يمكن أن تمتلك مؤسسة واحدة:
- أرقام ASN متعددة (لدى Google عدة أرقام)
- كتل IP متعددة لكل رقم ASN
- كتل IP مسجّلة بشكل منفصل عن أرقام ASN

```typescript
// Start from an IP, then investigate the ASN
const ip = await client.ip('8.8.8.8');
console.log(ip.name); // "GOGL" — this is Google

// Now look up Google's ASN for more details
const asn = await client.asn(15169);
console.log(asn.name); // "GOOGLE"
```

## نصائح للبحث عن ASN

1. **خزّن بشكل مكثف** — تخصيصات ASN نادرًا ما تتغير؛ خزّن لمدة 24 ساعة
2. **تعامل مع أرقام ASN ذات 4 بايت** — التخصيصات الحديثة تستخدم أرقام ASN ذات 4 بايت (> 65535)
3. **تحقق من الحالة** — ليست كل أرقام ASN نشطة؛ راجع حقل `status`
4. **تتبّع الكيانات** — استخدم معرّفات الكيانات للبحث عن تفاصيل الاتصال الكاملة
5. **تحديد المعدل** — جمّع استعلاماتك واحترم حدود معدل سجلات RIR

## الخلاصة

البحث عن ASN باستخدام RDAP يمنحك بيانات منظمة وموثوقة حول مشغلي الشبكة. بدمجه مع البحث عن IP، يمكنك بناء أدوات استخبارات شبكية شاملة تربط البنية التحتية بالمؤسسات.

---

*جرّب البحث عن ASN في [Playground](/playground) الخاص بنا أو ثبّت RDAPify: `npm install rdapify`.*
