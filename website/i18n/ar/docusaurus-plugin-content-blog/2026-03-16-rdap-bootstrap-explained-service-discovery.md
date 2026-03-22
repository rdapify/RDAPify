---
slug: rdap-bootstrap-explained-service-discovery
title: "شرح Bootstrap في RDAP: كيف يعمل الاكتشاف التلقائي للخدمة"
authors: [rdapify]
tags: [rdap, bootstrap, iana, protocol, deep-dive]
description: "تعمق في آلية Bootstrap في RDAP — كيف تكتشف عملاء RDAP تلقائيًا الخادم الصحيح لأي نطاق أو IP أو ASN دون قوائم خوادم مُرمَّزة يدويًا."
keywords: [rdap bootstrap, rdap service discovery, iana bootstrap, rdap server discovery, how rdap works, rdap iana files]
image: /img/rdapify-social-card.png
---

من أكثر ميزات RDAP أناقةً الاكتشاف التلقائي للخدمة عبر Bootstrap. تستعلم عن `example.com` ويعرف عميلك تلقائيًا أن يتصل بخادم RDAP الخاص بـ Verisign — دون قوائم مُرمَّزة يدويًا. إليك كيف يعمل ذلك خلف الكواليس.

<!-- truncate -->

## المشكلة التي يحلها Bootstrap

مع WHOIS، كنت بحاجة إلى الاحتفاظ بقائمة خوادم:

```javascript
// Old WHOIS approach — hardcoded, fragile, always out of date
const WHOIS_SERVERS = {
  'com': 'whois.verisign-grs.com',
  'net': 'whois.verisign-grs.com',
  'org': 'whois.pir.org',
  'uk':  'whois.nic.uk',
  'io':  'whois.nic.io',
  // ... hundreds more, constantly changing
};
```

امتدادات TLD جديدة؟ ستعلم بها حين يتوقف كودك عن العمل. يحل RDAP هذه المشكلة بنظام Bootstrap مركزي وقابل للقراءة آليًا تديره IANA.

## ملفات Bootstrap الخاصة بـ IANA

تنشر IANA ثلاثة ملفات JSON تغطي جميع بيانات تسجيل الإنترنت:

| المورد | الرابط | التغطية |
|--------|--------|---------|
| النطاقات | `https://data.iana.org/rdap/dns.json` | جميع امتدادات TLD |
| IPv4 | `https://data.iana.org/rdap/ipv4.json` | جميع فضاء IPv4 |
| IPv6 | `https://data.iana.org/rdap/ipv6.json` | جميع فضاء IPv6 |
| أرقام ASN | `https://data.iana.org/rdap/asn.json` | جميع نطاقات ASN |

### هيكل ملف Bootstrap

```json
{
  "version": "1.0",
  "publication": "2024-08-01T00:00:00Z",
  "description": "RDAP bootstrap file for domain name spaces",
  "services": [
    [
      ["com", "net"],
      ["https://rdap.verisign.com/com/v1/", "https://rdap.verisign.com/net/v1/"]
    ],
    [
      ["org"],
      ["https://rdap.publicinterestregistry.org/rdap/"]
    ],
    [
      ["uk"],
      ["https://rdap.nominet.uk/uk/"]
    ]
  ]
}
```

كل إدخال هو زوج: **[قائمة امتدادات TLD/نطاقات] + [قائمة روابط خوادم RDAP]**.

## كيف يعمل Bootstrap خطوة بخطوة

### البحث عن النطاق: `example.co.uk`

```
1. Extract TLD: "co.uk"
2. Load dns.json from IANA
3. Search services for "co.uk" → found: ["https://rdap.nominet.uk/uk/"]
4. If not found, try "uk" → found: same
5. Build URL: https://rdap.nominet.uk/uk/domain/example.co.uk
6. Make HTTPS request → get JSON response
```

### البحث عن IP: `8.8.8.8`

```
1. Load ipv4.json from IANA
2. Convert 8.8.8.8 to number: 134744072
3. Find matching range: 8.0.0.0/8 → ARIN
4. Server: https://rdap.arin.net/registry/
5. URL: https://rdap.arin.net/registry/ip/8.8.8.8
```

### البحث عن ASN: `AS15169`

```
1. Load asn.json from IANA
2. Find range containing 15169: 14593-15371 → ARIN
3. Server: https://rdap.arin.net/registry/
4. URL: https://rdap.arin.net/registry/autnum/15169
```

## مطابقة TLD متعدد المستويات

يستخدم Bootstrap المطابقة الأطول أولًا:

```
Query: example.co.uk

Try "co.uk" → found? Use it.
Try "uk"    → found? Use it.
Try ""      → fallback (root)
```

هذا مهم للامتدادات ccTLD ذات السجلات من المستوى الثاني كـ `.co.uk` و `.com.au` و `.co.jp`.

## التخزين المؤقت لـ Bootstrap

جلب ملفات Bootstrap الخاصة بـ IANA عند كل استعلام سيكون بطيئًا ومُكلفًا. العملاء الذكيون يُخزّنونها:

```typescript
import { RDAPClient } from 'rdapify';

// RDAPify caches bootstrap files automatically
// Default TTL: 24 hours (bootstrap files change rarely)
const client = new RDAPClient({
  cache: {
    ttl: 86400, // 24 hours
  },
});

// First query: fetches bootstrap + RDAP data
await client.domain('example.com');   // ~400ms

// Second query (same TLD): bootstrap cached
await client.domain('google.com');    // ~200ms

// Completely different TLD: bootstrap cached, new RDAP server
await client.domain('example.de');    // ~250ms
```

## الخوادم الاحتياطية

عندما لا يُعثر على امتداد TLD في Bootstrap (نادر لكن ممكن)، يمكن للعملاء الرجوع إلى خادم RDAP الخاص بـ IANA:

```
https://rdap.iana.org/domain/example.tld
```

يتعامل خادم IANA مع بيانات المنطقة الجذرية ويمكنه إعادة التوجيه إلى الخادم الموثوق.

## ما يفعله RDAPify داخليًا

تنفيذ Bootstrap في RDAPify:

```
1. Check local cache for bootstrap data
2. If cache miss or expired: fetch from data.iana.org
3. Parse services array
4. Match query against services (longest match wins)
5. Select RDAP server URL (prefer HTTPS)
6. Construct RESTful URL
7. Make request with proper Accept header
8. Return parsed response
```

يحدث كل هذا بشفافية تامة:

```typescript
const client = new RDAPClient();

// You just call this — bootstrap is handled automatically
const domain = await client.domain('example.xyz');
// Internally: fetched dns.json, found XYZ Registry, queried their RDAP server
```

## حالات الحافة

### خوادم متعددة في Bootstrap

بعض امتدادات TLD لها خوادم RDAP متعددة (أساسي + احتياطي):

```json
[
  ["com", "net"],
  [
    "https://rdap.verisign.com/com/v1/",
    "https://rdap-backup.verisign.com/com/v1/"
  ]
]
```

تُجرّب العملاء عادةً الخادم الأول وتنتقل إلى التالي عند الفشل.

### تحديثات ملفات Bootstrap

تُحدِّث IANA ملفات Bootstrap عند:
- تفويض امتدادات TLD جديدة
- تغيير السجلات لروابط خوادم RDAP الخاصة بها
- تحديث RIRs لنقاط نهايتها

يُخبرك تاريخ `publication` في كل ملف بآخر تحديث له. يجب على العملاء التحديث بشكل دوري (يفعل ذلك RDAPify تلقائيًا).

## الخلاصة

Bootstrap في RDAP حل أنيق لمشكلة اكتشاف الخوادم. بدلًا من الاحتفاظ بقوائم مُرمَّزة هشة، تثق العملاء بمصدر مركزي وقابل للقراءة آليًا تديره IANA. إنه أحد الأسباب التي تجعل RDAP يتوسع بسلاسة إلى أكثر من 1,500 امتداد TLD وجميع فضاء IP على الإنترنت.

---

*هل تريد التعمق في آليات RDAPify الداخلية؟ اطّلع على [الكود المصدري على GitHub](https://github.com/rdapify/rdapify).*
