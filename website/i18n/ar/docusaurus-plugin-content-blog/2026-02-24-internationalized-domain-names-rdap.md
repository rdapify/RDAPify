---
slug: internationalized-domain-names-rdap
title: "أسماء النطاقات الدولية (IDN) مع RDAP: دليل شامل"
authors: [rdapify]
tags: [rdap, idn, internationalization, unicode]
description: "كيف يتعامل RDAP مع أسماء النطاقات الدولية (IDN) — النطاقات بالأحرف العربية والصينية والروسية وغيرها. تعلم عن Punycode وIDNA والاستعلام عن IDN باستخدام RDAPify."
keywords: [internationalized domain names, idn rdap, unicode domain lookup, punycode rdap, arabic domain names, chinese domain lookup, idna rdap]
image: /img/rdapify-social-card.png
---

أكثر من نصف سكان العالم لا يستخدمون الحروف اللاتينية. تتيح أسماء النطاقات الدولية (IDN) تسجيل النطاقات بالأحرف العربية والصينية والسيريلية والديفانغاري وعشرات الخطوط الأخرى. بُني RDAP مع الأخذ بعين الاعتبار التدويل — على عكس WHOIS الذي كان مقتصرًا على ASCII فقط. إليك كل ما تحتاج معرفته.

<!-- truncate -->

## ما هي نطاقات IDN؟

نطاقات IDN تحتوي على أحرف غير ASCII من معيار Unicode:

| النطاق | الخط | البلد |
|--------|--------|---------|
| `مثال.إختبار` | عربي | — |
| `例子.测试` | صيني | — |
| `пример.испытание` | سيريلي | — |
| `उदाहरण.परीक्षा` | ديفانغاري | — |
| `例え.jp` | ياباني | اليابان |
| `موقع.وزارة-الاتصالات.مصر` | عربي | مصر |

نظام DNS نفسه يتعامل فقط مع ASCII، لذا تُشفَّر نطاقات IDN إلى شكل متوافق مع ASCII باستخدام **Punycode**.

## Punycode وصيغة ACE

يحوّل Punycode Unicode إلى ترميز متوافق مع ASCII (ACE):

```
مثال.إختبار  →  xn--mgbh0fb.xn--kgbechtv
例子.测试     →  xn--fsq270a.xn--0zwm56d
пример.рф    →  xn--e1afmapc.xn--p1ai
```

يدعم RDAP كلا الشكلين:
- **LDH (حرف-رقم-شرطة)** — صيغة ACE/Punycode: `xn--mgbh0fb.xn--kgbechtv`
- **Unicode** — الصيغة المقروءة للإنسان: `مثال.إختبار`

## الاستعلام عن IDN باستخدام RDAPify

يتعامل RDAPify مع كلا الشكلين بشفافية:

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

// You can use either form — RDAPify normalizes automatically

// Unicode form
const domain1 = await client.domain('例え.jp');

// ACE/Punycode form
const domain2 = await client.domain('xn--r8jz45g.jp');

// Both return the same result
console.log(domain1.ldhName);     // "xn--r8jz45g.jp" (ACE)
console.log(domain1.unicodeName); // "例え.jp" (Unicode)
```

## استجابة RDAP: الاسمان معًا

يُعيد RDAP كلا التمثيلين:

```json
{
  "objectClassName": "domain",
  "ldhName": "xn--e1afmapc.xn--p1ai",
  "unicodeName": "пример.рф",
  "status": ["active"],
  "events": [...]
}
```

استخدم دائمًا `unicodeName` للعرض و`ldhName` لعمليات DNS.

## البحث عن النطاقات العربية

نطاقات الخط العربي (من اليمين إلى اليسار):

```typescript
const client = new RDAPClient();

// Arabic domain — either form works
const arabicDomain = await client.domain('xn--mgbh0fb.xn--kgbechtv');

console.log(arabicDomain.unicodeName); // "مثال.إختبار"
console.log(arabicDomain.ldhName);     // "xn--mgbh0fb.xn--kgbechtv"
console.log(arabicDomain.status);
console.log(arabicDomain.nameservers?.map(ns => ns.ldhName));
```

## البحث عن النطاقات الصينية

```typescript
// Chinese TLD (.中国 = China)
const chineseDomain = await client.domain('xn--fiq228c5hs.xn--fiqz9s');

console.log(chineseDomain.unicodeName); // "例子.中国"
console.log(chineseDomain.ldhName);     // "xn--fiq228c5hs.xn--fiqz9s"
```

## التحويل بين الصيغتين

```typescript
// Convert Unicode to Punycode
function toPunycode(domain: string): string {
  const url = new URL(`https://${domain}`);
  return url.hostname; // Browsers handle IDNA automatically
}

// For Node.js
import { domainToASCII, domainToUnicode } from 'url';

const ascii = domainToASCII('مثال.إختبار');
// "xn--mgbh0fb.xn--kgbechtv"

const unicode = domainToUnicode('xn--mgbh0fb.xn--kgbechtv');
// "مثال.إختبار"
```

## هجمات الرسوم المتشابهة في IDN

يفتح IDN الباب أمام هجمات الرسوم المتشابهة (Homograph) — أحرف متطابقة بصريًا من خطوط مختلفة:

```
Latin 'a'   (U+0061)  → apple.com
Cyrillic 'а' (U+0430) → аpple.com  ← different character!
```

تبدو متطابقة في كثير من الخطوط. يساعد RDAP في اكتشاف هذه الحالات:

```typescript
async function detectHomograph(domain: string) {
  const client = new RDAPClient();
  const result = await client.domain(domain);

  // Get the ACE form — reveals hidden non-ASCII characters
  const aceForm = result.ldhName ?? '';
  const hasIDN = aceForm.includes('xn--');

  if (hasIDN) {
    console.log(`⚠️ Domain contains non-ASCII characters:`);
    console.log(`  Display form: ${result.unicodeName}`);
    console.log(`  ACE form:     ${result.ldhName}`);
    console.log(`  Always verify the ACE form matches expectations`);
  }

  return { hasIDN, aceForm, unicodeForm: result.unicodeName };
}
```

## أفضل ممارسات العرض

```typescript
function displayDomainSafely(rdapResult: any): string {
  const ldhName = rdapResult.ldhName;
  const unicodeName = rdapResult.unicodeName;

  // Show both forms for IDN domains
  if (ldhName?.includes('xn--') && unicodeName) {
    return `${unicodeName} (${ldhName})`;
  }

  return ldhName ?? unicodeName ?? 'Unknown';
}

// Output: "例え.jp (xn--r8jz45g.jp)"
// Security tools should always show the ACE form
```

## دعم RDAP لامتدادات TLD الدولية الجديدة

فوّضت IANA أكثر من 1200 امتداد TLD جديد، كثير منها دولي:

```typescript
const client = new RDAPClient();

// New IDN TLDs are supported via bootstrap
const egyptianDomain = await client.domain('xn--4gbrim.xn--wgbh1c');
// ".مصر" (.masr — Egypt in Arabic)

const chineseTLD = await client.domain('xn--fiq228c5hs.xn--vermgensberatung-pwb');
// German IDN TLD
```

## الخلاصة

دعم Unicode الأصلي في RDAP يمثّل ميزة كبيرة على WHOIS. تحصل على استجابات نظيفة ومنظمة مع صيغتي ACE وUnicode، مما يُيسّر بناء أدوات إدارة نطاقات دولية حقيقية.

---

*جرّب بحث IDN في [Playground](/playground) الخاص بنا — يتعامل مع كلا شكلي Unicode وPunycode.*
