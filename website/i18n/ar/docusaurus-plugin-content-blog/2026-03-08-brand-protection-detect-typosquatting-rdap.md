---
slug: brand-protection-detect-typosquatting-rdap
title: "حماية العلامة التجارية باستخدام RDAP: اكتشاف Typosquatting وإساءة النطاقات"
authors: [rdapify]
tags: [security, brand-protection, typosquatting, rdap]
description: "تعلم كيفية استخدام RDAP لمراقبة علامتك التجارية ضد Typosquatting وCybersquatting وإساءة النطاقات. بناء أدوات حماية العلامة التجارية الآلية باستخدام Node.js وRDAPify."
keywords: [typosquatting detection, brand protection domain, cybersquatting monitoring, domain brand abuse, rdap brand monitoring, detect similar domains]
image: /img/rdapify-social-card.png
---

قام شخص ما بتسجيل `paypa1.com` قبل أن تنتبه PayPal. آلاف العلامات التجارية تتعرض يوميًا للـ Typosquatters والـ Cybersquatters وجهات الاحتيال. يمنحك RDAP الأدوات اللازمة للمراقبة والاستجابة. إليك كيفية بناء نظام حماية للعلامة التجارية.

<!-- truncate -->

## أنواع إساءة النطاقات

| الهجوم | مثال | الهدف |
|--------|---------|------|
| **Typosquatting** | `gooogle.com`، `paypa1.com` | اصطياد حركة المرور المكتوبة خطأ |
| **Cybersquatting** | `yourbrand-official.com` | ابتزاز أصحاب العلامات التجارية |
| **هجوم الرسوم المتشابهة** | `аррlе.com` (حرف أ سيريلي) | التصيد عبر أحرف متشابهة |
| **إساءة امتدادات TLD** | `yourbrand.xyz`، `yourbrand.shop` | إرباك المستخدمين عبر امتدادات مختلفة |
| **Combosquatting** | `yourbrand-login.com` | التصيد، سرقة بيانات الاعتماد |

## توليد المتغيرات الخاطئة

```typescript
function generateTypos(brand: string): string[] {
  const typos = new Set<string>();
  const chars = brand.split('');

  // Character substitutions (1→i, 0→o, etc.)
  const substitutions: Record<string, string[]> = {
    'a': ['@', '4'],
    'e': ['3'],
    'i': ['1', 'l', '!'],
    'o': ['0'],
    's': ['5', '$'],
    'l': ['1', 'i'],
    'g': ['9'],
  };

  // Substitution typos
  chars.forEach((char, idx) => {
    const subs = substitutions[char.toLowerCase()];
    if (subs) {
      subs.forEach(sub => {
        const typo = chars.slice();
        typo[idx] = sub;
        typos.add(typo.join(''));
      });
    }
  });

  // Missing character
  for (let i = 0; i < chars.length; i++) {
    typos.add([...chars.slice(0, i), ...chars.slice(i + 1)].join(''));
  }

  // Double character
  for (let i = 0; i < chars.length; i++) {
    typos.add([...chars.slice(0, i), chars[i], ...chars.slice(i)].join(''));
  }

  // Adjacent key swaps
  for (let i = 0; i < chars.length - 1; i++) {
    const swapped = chars.slice();
    [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
    typos.add(swapped.join(''));
  }

  // Remove the original
  typos.delete(brand);

  return Array.from(typos);
}

const variants = generateTypos('rdapify');
console.log(variants.slice(0, 10));
// ['radpify', 'rdapif', 'rrdapify', 'rdpify', 'rdapif y', ...]
```

## توليد تركيبات النطاقات

```typescript
const MONITORED_TLDS = [
  'com', 'net', 'org', 'io', 'co', 'app', 'dev',
  'xyz', 'info', 'biz', 'shop', 'online', 'site',
];

const PREFIXES = ['my', 'get', 'try', 'use', 'the', 'official'];
const SUFFIXES = ['app', 'api', 'web', 'online', 'official', 'login', 'secure'];

function generateBrandDomains(brand: string): string[] {
  const domains: Set<string> = new Set();

  // Direct TLD variations
  for (const tld of MONITORED_TLDS) {
    domains.add(`${brand}.${tld}`);
  }

  // Prefix combinations
  for (const prefix of PREFIXES) {
    for (const tld of MONITORED_TLDS.slice(0, 5)) {
      domains.add(`${prefix}${brand}.${tld}`);
      domains.add(`${prefix}-${brand}.${tld}`);
    }
  }

  // Suffix combinations
  for (const suffix of SUFFIXES) {
    for (const tld of MONITORED_TLDS.slice(0, 5)) {
      domains.add(`${brand}${suffix}.${tld}`);
      domains.add(`${brand}-${suffix}.${tld}`);
    }
  }

  return Array.from(domains);
}
```

## التحقق من حالة تسجيل النطاق

```typescript
import { RDAPClient } from 'rdapify';

interface DomainCheckResult {
  domain: string;
  registered: boolean;
  registeredDate?: string;
  expiryDate?: string;
  nameservers?: string[];
  status?: string[];
}

async function checkDomainRegistration(domain: string): Promise<DomainCheckResult> {
  const client = new RDAPClient({ cache: { ttl: 3600 } });

  try {
    const result = await client.domain(domain);
    return {
      domain,
      registered: true,
      registeredDate: result.events?.find(
        e => e.eventAction === 'registration'
      )?.eventDate,
      expiryDate: result.events?.find(
        e => e.eventAction === 'expiration'
      )?.eventDate,
      nameservers: result.nameservers?.map(ns => ns.ldhName) ?? [],
      status: result.status ?? [],
    };
  } catch (error: any) {
    if (error.message?.includes('404') || error.message?.includes('not found')) {
      return { domain, registered: false };
    }
    throw error;
  }
}
```

## ماسح تهديدات العلامة التجارية

```typescript
async function scanBrandThreats(brand: string) {
  const typos = generateTypos(brand);
  const combos = generateBrandDomains(brand);
  const allDomains = [...new Set([...typos.map(t => `${t}.com`), ...combos])];

  console.log(`Scanning ${allDomains.length} potential threat domains...`);

  // Process in batches to avoid rate limiting
  const BATCH_SIZE = 10;
  const registered: DomainCheckResult[] = [];

  for (let i = 0; i < allDomains.length; i += BATCH_SIZE) {
    const batch = allDomains.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(d => checkDomainRegistration(d))
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.registered) {
        registered.push(result.value);
      }
    }

    // Respect rate limits
    if (i + BATCH_SIZE < allDomains.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return {
    brand,
    scanned: allDomains.length,
    threatsFound: registered.length,
    threats: registered.sort((a, b) => {
      // Sort by registration date (newest first — most likely active threats)
      const aDate = a.registeredDate ? new Date(a.registeredDate).getTime() : 0;
      const bDate = b.registeredDate ? new Date(b.registeredDate).getTime() : 0;
      return bDate - aDate;
    }),
  };
}

// Usage
const threats = await scanBrandThreats('yourcompany');
console.log(`Found ${threats.threatsFound} registered threat domains:`);
for (const threat of threats.threats) {
  console.log(`  ${threat.domain} — registered ${threat.registeredDate?.split('T')[0]}`);
}
```

## المراقبة اليومية الآلية

```typescript
// Run daily with cron: 0 8 * * *
async function dailyBrandScan(brands: string[], webhookUrl?: string) {
  const newThreats: DomainCheckResult[] = [];

  for (const brand of brands) {
    const result = await scanBrandThreats(brand);

    // Filter: only domains registered in the last 7 days
    const recent = result.threats.filter(t => {
      if (!t.registeredDate) return false;
      const age = (Date.now() - new Date(t.registeredDate).getTime()) / 86400000;
      return age < 7;
    });

    newThreats.push(...recent);
  }

  if (newThreats.length > 0 && webhookUrl) {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alert: 'New brand threat domains detected',
        count: newThreats.length,
        domains: newThreats.map(t => ({
          domain: t.domain,
          registered: t.registeredDate,
          nameservers: t.nameservers,
        })),
      }),
    });
  }

  return newThreats;
}
```

## الاستجابة للتهديدات

بعد تحديد النطاق المهدِّد، يساعدك RDAP على اتخاذ الإجراء:

1. **تقرير الإساءة** — احصل على جهة اتصال المسجّل من كيانات RDAP، وقدّم تقرير إساءة
2. **شكوى UDRP** — استخدم بيانات التسجيل كدليل في نزاعات النطاق
3. **طلب الإغلاق** — تواصل مع مزود الاستضافة عبر بحث RDAP عن IP
4. **مراقبة التغييرات** — تتبع ما إذا بدأ النطاق في الحل أو تغيّرت خوادم أسمائه

```typescript
async function getAbuseContact(domain: string) {
  const client = new RDAPClient();
  const result = await client.domain(domain);

  // Get registrar abuse contact
  const registrar = result.entities?.find(e => e.roles?.includes('registrar'));
  const abuseEntity = registrar?.entities?.find(e => e.roles?.includes('abuse'));

  return {
    registrar: registrar?.vcardArray?.[1]?.find(
      (f: string[]) => f[0] === 'fn'
    )?.[3],
    abuseEmail: abuseEntity?.vcardArray?.[1]?.find(
      (f: string[]) => f[0] === 'email'
    )?.[3],
  };
}
```

## الخلاصة

حماية العلامة التجارية معركة مستمرة، لكن RDAP يجعلها منهجية. الفحص الآلي يكتشف التهديدات مبكرًا — قبل أن تُستخدم في التصيد أو سرقة حركة المرور. ابدأ بأسماء علاماتك التجارية الأكثر قيمة وتوسّع منها.

---

*هل تحتاج إلى مراقبة جماعية؟ [RDAPify Pro](https://rdapify.com) يتضمن مراقبة علامات تجارية مدمجة مع اكتشاف التغييرات وتنبيهات Webhook.*
