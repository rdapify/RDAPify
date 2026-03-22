---
slug: internationalized-domain-names-rdap
title: "Internationalized Domain Names (IDN) with RDAP: A Complete Guide"
authors: [rdapify]
tags: [rdap, idn, internationalization, unicode]
description: "How RDAP handles Internationalized Domain Names (IDN) — Unicode domains in Arabic, Chinese, Russian, and other scripts. Learn about Punycode, IDNA, and querying IDN with RDAPify."
keywords: [internationalized domain names, idn rdap, unicode domain lookup, punycode rdap, arabic domain names, chinese domain lookup, idna rdap]
image: /img/rdapify-social-card.png
---

Over half the world doesn't use Latin characters. Internationalized Domain Names (IDN) let you register domains in Arabic, Chinese, Cyrillic, Devanagari, and dozens of other scripts. RDAP was built with internationalization in mind — unlike WHOIS, which was ASCII-only. Here's everything you need to know.

<!-- truncate -->

## What are IDN Domains?

IDN domains contain non-ASCII characters from the Unicode standard:

| Domain | Script | Country |
|--------|--------|---------|
| `مثال.إختبار` | Arabic | — |
| `例子.测试` | Chinese | — |
| `пример.испытание` | Cyrillic | — |
| `उदाहरण.परीक्षा` | Devanagari | — |
| `例え.jp` | Japanese | Japan |
| `موقع.وزارة-الاتصالات.مصر` | Arabic | Egypt |

The DNS system itself only handles ASCII, so IDN domains are encoded into ASCII-compatible form using **Punycode**.

## Punycode and ACE Form

Punycode converts Unicode to ASCII-compatible encoding (ACE):

```
مثال.إختبار  →  xn--mgbh0fb.xn--kgbechtv
例子.测试     →  xn--fsq270a.xn--0zwm56d
пример.рф    →  xn--e1afmapc.xn--p1ai
```

RDAP supports both forms:
- **LDH (Letter-Digit-Hyphen)** — ACE/Punycode form: `xn--mgbh0fb.xn--kgbechtv`
- **Unicode** — Human-readable form: `مثال.إختبار`

## Querying IDN with RDAPify

RDAPify handles both forms transparently:

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

## The RDAP Response: Both Names

RDAP returns both representations:

```json
{
  "objectClassName": "domain",
  "ldhName": "xn--e1afmapc.xn--p1ai",
  "unicodeName": "пример.рф",
  "status": ["active"],
  "events": [...]
}
```

Always use `unicodeName` for display and `ldhName` for DNS operations.

## Arabic Domain Lookups

Arabic script domains (right-to-left):

```typescript
const client = new RDAPClient();

// Arabic domain — either form works
const arabicDomain = await client.domain('xn--mgbh0fb.xn--kgbechtv');

console.log(arabicDomain.unicodeName); // "مثال.إختبار"
console.log(arabicDomain.ldhName);     // "xn--mgbh0fb.xn--kgbechtv"
console.log(arabicDomain.status);
console.log(arabicDomain.nameservers?.map(ns => ns.ldhName));
```

## Chinese Domain Lookups

```typescript
// Chinese TLD (.中国 = China)
const chineseDomain = await client.domain('xn--fiq228c5hs.xn--fiqz9s');

console.log(chineseDomain.unicodeName); // "例子.中国"
console.log(chineseDomain.ldhName);     // "xn--fiq228c5hs.xn--fiqz9s"
```

## Converting Between Forms

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

## IDN Homograph Attacks

IDN opens the door to homograph attacks — visually identical characters from different scripts:

```
Latin 'a'   (U+0061)  → apple.com
Cyrillic 'а' (U+0430) → аpple.com  ← different character!
```

They look identical in many fonts. RDAP helps detect these:

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

## Display Best Practices

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

## RDAP Support for New IDN TLDs

IANA has delegated over 1,200 new TLDs, many of which are IDN:

```typescript
const client = new RDAPClient();

// New IDN TLDs are supported via bootstrap
const egyptianDomain = await client.domain('xn--4gbrim.xn--wgbh1c');
// ".مصر" (.masr — Egypt in Arabic)

const chineseTLD = await client.domain('xn--fiq228c5hs.xn--vermgensberatung-pwb');
// German IDN TLD
```

## Conclusion

RDAP's native Unicode support is a significant advantage over WHOIS. You get clean, structured responses with both ACE and Unicode forms, making it easy to build truly international domain management tools.

---

*Try IDN lookups in our [Playground](/playground) — it handles both Unicode and Punycode forms.*
