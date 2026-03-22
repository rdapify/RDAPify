---
slug: ip-address-lookup-with-rdap
title: "البحث عن عناوين IP باستخدام RDAP: دليل عملي"
authors: [rdapify]
tags: [rdap, ip-lookup, networking, tutorial]
description: "تعلم كيفية البحث عن ملكية عناوين IP، وتلميحات الموقع الجغرافي، وبيانات تخصيص الشبكة باستخدام RDAP. أمثلة عملية مع RDAPify لكل من IPv4 وIPv6."
keywords: [ip address lookup, ip whois lookup, rdap ip query, who owns ip address, ip address information, ip network lookup, ipv6 lookup]
image: /img/rdapify-social-card.png
---

هل تحتاج إلى معرفة من يمتلك عنوان IP، وما الشبكة التي ينتمي إليها، ومتى خُصِّص؟ يوفر RDAP إجابات منظمة وموثوقة. يوضح هذا الدليل كيفية إجراء بحث عن IP بأمثلة كود حقيقية.

<!-- truncate -->

## لماذا البحث عن عناوين IP؟

البحث عن عناوين IP ضروري في حالات عدة:

- **التحقيقات الأمنية** — التعرف على مصدر حركة المرور الضارة
- **الإبلاغ عن الإساءة** — إيجاد جهة الاتصال الصحيحة لإساءات الشبكة
- **الامتثال** — التحقق من مقر البيانات وملكية الشبكة
- **تخطيط الشبكة** — فهم تخصيصات IP والنطاقات المتاحة
- **استخبارات التهديدات** — ربط البنية التحتية بالمؤسسات

## كيف يعمل RDAP للبحث عن IP

تُدار مساحة عناوين IP من قِبل خمسة سجلات إنترنت إقليمية (RIR):

| سجل RIR | المنطقة | رابط RDAP الأساسي |
|-----|--------|---------------|
| ARIN | أمريكا الشمالية | `https://rdap.arin.net/registry/` |
| RIPE NCC | أوروبا، الشرق الأوسط، آسيا الوسطى | `https://rdap.db.ripe.net/` |
| APNIC | آسيا والمحيط الهادئ | `https://rdap.apnic.net/` |
| AFRINIC | أفريقيا | `https://rdap.afrinic.net/rdap/` |
| LACNIC | أمريكا اللاتينية والكاريبي | `https://rdap.lacnic.net/rdap/` |

عند الاستعلام عن IP، يستخدم عميل RDAP بيانات Bootstrap الخاصة بـ IANA لتوجيه طلبك إلى سجل RIR الصحيح.

## البحث الأساسي عن IP

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

// IPv4 lookup
const result = await client.ip('8.8.8.8');

console.log(result.name);          // "GOGL" — network name
console.log(result.handle);        // "NET-8-8-8-0-2"
console.log(result.startAddress);  // "8.8.8.0"
console.log(result.endAddress);    // "8.8.8.255"
console.log(result.country);       // "US"
console.log(result.type);          // "DIRECT ALLOCATION"
console.log(result.parentHandle);  // "NET-8-0-0-0-1"
```

## البحث عن IPv6

```typescript
// IPv6 works the same way
const ipv6Result = await client.ip('2001:4860:4860::8888');

console.log(ipv6Result.name);          // "GOGL"
console.log(ipv6Result.startAddress);  // "2001:4860::"
console.log(ipv6Result.endAddress);    // "2001:4860:ffff:ffff:ffff:ffff:ffff:ffff"
console.log(ipv6Result.country);       // "US"
```

## فهم الاستجابة

تحتوي استجابة RDAP للـ IP على عدة أقسام رئيسية:

### معلومات الشبكة

```typescript
const ip = await client.ip('1.1.1.1');

// Basic network info
ip.name;          // Network name
ip.handle;        // Registry handle
ip.startAddress;  // Start of the IP block
ip.endAddress;    // End of the IP block
ip.ipVersion;     // "v4" or "v6"
ip.type;          // Allocation type
ip.country;       // Country code (ISO 3166-1)
```

### الأحداث (الجدول الزمني)

```typescript
// When was this IP block registered and last updated?
for (const event of ip.events ?? []) {
  console.log(`${event.eventAction}: ${event.eventDate}`);
}
// registration: 2010-07-14T00:00:00Z
// last changed: 2024-03-15T12:30:00Z
```

### الكيانات (جهات الاتصال)

```typescript
// Who manages this IP block?
for (const entity of ip.entities ?? []) {
  console.log(`Role: ${entity.roles?.join(', ')}`);
  console.log(`Handle: ${entity.handle}`);

  // Contact details in vCard format
  if (entity.vcardArray) {
    const vcard = entity.vcardArray[1];
    for (const field of vcard) {
      if (field[0] === 'fn') console.log(`Name: ${field[3]}`);
      if (field[0] === 'email') console.log(`Email: ${field[3]}`);
    }
  }
}
```

### ترميز CIDR

```typescript
// Get the network in CIDR format
if (ip.cidr0_cidrs) {
  for (const cidr of ip.cidr0_cidrs) {
    console.log(`${cidr.v4prefix || cidr.v6prefix}/${cidr.length}`);
    // "8.8.8.0/24"
  }
}
```

## حالات استخدام عملية

### حالة الاستخدام الأولى: التعرف على مالك الشبكة

```typescript
async function identifyOwner(ipAddress: string) {
  const client = new RDAPClient();
  const result = await client.ip(ipAddress);

  const registrant = result.entities?.find(
    e => e.roles?.includes('registrant')
  );

  return {
    network: result.name,
    range: `${result.startAddress} - ${result.endAddress}`,
    country: result.country,
    owner: registrant?.handle ?? 'Unknown',
    type: result.type,
  };
}

const owner = await identifyOwner('151.101.1.140');
console.log(owner);
// {
//   network: "SKYCA-3",
//   range: "151.101.0.0 - 151.101.255.255",
//   country: "US",
//   owner: "SKYCA",
//   type: "DIRECT ALLOCATION"
// }
```

### حالة الاستخدام الثانية: إيجاد جهة التواصل للإبلاغ عن الإساءة

```typescript
async function findAbuseContact(ipAddress: string) {
  const client = new RDAPClient();
  const result = await client.ip(ipAddress);

  const abuseEntity = result.entities?.find(
    e => e.roles?.includes('abuse')
  );

  if (!abuseEntity?.vcardArray) {
    return { email: null, phone: null };
  }

  const vcard = abuseEntity.vcardArray[1];
  const email = vcard.find((f: string[]) => f[0] === 'email')?.[3];
  const phone = vcard.find((f: string[]) => f[0] === 'tel')?.[3];

  return { email, phone };
}

const abuse = await findAbuseContact('203.0.113.50');
console.log(`Report abuse to: ${abuse.email}`);
```

### حالة الاستخدام الثالثة: تحليل IP الجماعي

```typescript
async function analyzeIPs(addresses: string[]) {
  const client = new RDAPClient({ cache: { ttl: 3600 } });

  const results = await Promise.all(
    addresses.map(async (ip) => {
      try {
        const data = await client.ip(ip);
        return {
          ip,
          network: data.name,
          country: data.country,
          type: data.type,
        };
      } catch {
        return { ip, network: 'unknown', country: 'unknown', type: 'error' };
      }
    })
  );

  // Group by country
  const byCountry = new Map<string, number>();
  for (const r of results) {
    byCountry.set(r.country, (byCountry.get(r.country) ?? 0) + 1);
  }

  return { results, countryDistribution: Object.fromEntries(byCountry) };
}

const analysis = await analyzeIPs([
  '8.8.8.8',
  '1.1.1.1',
  '208.67.222.222',
  '9.9.9.9',
]);
console.log(analysis.countryDistribution);
// { US: 3, AU: 1 }
```

## البحث عن IP مقابل البحث عن النطاق

| الجانب | البحث عن IP | البحث عن النطاق |
|--------|-----------|---------------|
| السجل | سجلات RIR (ARIN، RIPE، إلخ) | سجلات النطاقات (Verisign، إلخ) |
| نوع الاستجابة | كائن شبكة IP | كائن نطاق |
| البيانات الرئيسية | التخصيص، المالك، النطاق | التسجيل، الانتهاء، خوادم الأسماء |
| حالة الاستخدام | الطب الشرعي للشبكة، الإساءة | إدارة النطاقات، العناية الواجبة |
| دعم CIDR | نعم | غير منطبق |

## نصائح للبحث عن IP

1. **خزّن النتائج مؤقتًا** — تخصيصات IP لا تتغير كثيرًا؛ خزّن لمدة ساعة على الأقل
2. **تعامل مع كتل CIDR** — الاستجابة تغطي الكتلة الكاملة، وليس فقط الـ IP المفرد
3. **تحقق من معرّفات الوالد** — التخصيصات الكبيرة قد تحتوي على تخصيصات فرعية بجهات اتصال مختلفة
4. **استخدم IPv6** — معظم الإنترنت يتجه نحو IPv6؛ تأكد من دعم أدواتك له
5. **تحديد المعدل** — تُفرض حدود المعدل من سجلات RIR؛ احترم رؤوس `Retry-After`

```typescript
// Recommended client configuration for IP lookups
const client = new RDAPClient({
  cache: { ttl: 3600 },   // 1 hour cache
  timeout: 15000,          // 15s timeout (some RIRs are slow)
});
```

## الخلاصة

البحث عن عناوين IP باستخدام RDAP يمنحك بيانات منظمة وموثوقة حول تخصيصات الشبكة وملكيتها. سواء كنت تحقق في حوادث أمنية، أو تبلّغ عن الإساءة، أو تحلل حركة الشبكة، فإن RDAP يوفر إجابات موثوقة بتنسيق JSON متسق.

---

*جرّب البحث عن IP في [Playground](/playground) الخاص بنا أو ثبّت RDAPify: `npm install rdapify`.*
