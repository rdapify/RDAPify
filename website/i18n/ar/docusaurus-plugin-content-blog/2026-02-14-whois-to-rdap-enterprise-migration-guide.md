---
slug: whois-to-rdap-enterprise-migration-guide
title: "من WHOIS إلى RDAP: دليل الترحيل للتطبيقات المؤسسية"
authors: [rdapify]
tags: [migration, enterprise, rdap, whois, guide]
description: "دليل ترحيل عملي للفرق المؤسسية المنتقلة من WHOIS إلى RDAP. يشمل تعيين الحقول، والطرح التدريجي، والتوافق العكسي، واستراتيجيات الاختبار، والمخاطر الشائعة."
keywords: [whois to rdap migration, enterprise rdap, rdap migration guide, replace whois with rdap, rdap enterprise integration, domain lookup migration]
image: /img/rdapify-social-card.png
---

تعتمد مؤسستك على WHOIS منذ سنوات. والآن تُوقف ICANN دعمه، وبدأت السجلات تغلق نقاط نهاية WHOIS، ويتعطل كود التحليل لديك كل أسبوع تقريبًا. حان وقت الانتقال إلى RDAP. يمنحك هذا الدليل مسارًا منظمًا للترحيل مع أقل قدر من المخاطر.

<!-- truncate -->

## لماذا الترحيل الآن؟

ثلاثة عوامل تتقاطع في هذا التوقيت:

1. **تفويض ICANN** — RDAP هو البروتوكول المطلوب لبيانات تسجيل نطاقات gTLD
2. **إيقاف السجلات** — تُقلص السجلات الكبرى دعمها لـ WHOIS
3. **عبء الصيانة** — كود تحليل WHOIS هش ومكلف في الصيانة

التأخير في الترحيل يعني تراكم الديون التقنية والمخاطرة بانقطاع الخدمة عند إغلاق نقاط نهاية WHOIS.

## استراتيجية الترحيل: النهج التدريجي

لا تقم بالاستبدال الكامل دفعة واحدة. الترحيل التدريجي يقلل المخاطر:

```
المرحلة 1: وضع الظل     (2-4 أسابيع)  → RDAP بالتوازي، مقارنة النتائج
المرحلة 2: RDAP أساسي   (2-4 أسابيع)  → RDAP كمصدر رئيسي، WHOIS كاحتياط
المرحلة 3: إزالة WHOIS  (1-2 أسبوع)   → حذف كود WHOIS نهائيًا
```

### المرحلة الأولى: وضع الظل

شغّل استعلامات RDAP جنبًا إلى جنب مع WHOIS وقارن النتائج. يتحقق هذا من تكامل RDAP دون التأثير على الإنتاج:

```typescript
import { RDAPClient } from 'rdapify';

const rdapClient = new RDAPClient({
  cache: { ttl: 3600 },
});

async function lookupDomainShadow(domain: string) {
  // Existing WHOIS lookup (your current code)
  const whoisResult = await existingWhoisLookup(domain);

  // New RDAP lookup (shadow)
  try {
    const rdapResult = await rdapClient.domain(domain);

    // Compare key fields
    const comparison = {
      domain,
      whoisExpiry: whoisResult.expiryDate,
      rdapExpiry: rdapResult.events?.find(
        e => e.eventAction === 'expiration'
      )?.eventDate,
      match: whoisResult.expiryDate === rdapResult.events?.find(
        e => e.eventAction === 'expiration'
      )?.eventDate,
    };

    // Log comparison for analysis
    logger.info('rdap_shadow_comparison', comparison);
  } catch (error) {
    logger.warn('rdap_shadow_error', { domain, error: error.message });
  }

  // Return WHOIS result (production path unchanged)
  return whoisResult;
}
```

**معايير النجاح للمرحلة الأولى:**
- RDAP يُعيد بيانات لأكثر من 95% من الاستعلامات
- تتطابق الحقول الرئيسية (الانتهاء، الحالة، خوادم الأسماء) مع بيانات WHOIS
- وقت استجابة RDAP مقبول (أقل من ضعف WHOIS)
- لا توجد أخطاء في الحالات الحدية

### المرحلة الثانية: RDAP أساسي مع WHOIS احتياطي

التحول إلى RDAP كمصدر رئيسي، والرجوع إلى WHOIS فقط عند فشل RDAP:

```typescript
async function lookupDomain(domain: string) {
  try {
    // Try RDAP first
    const rdapResult = await rdapClient.domain(domain);
    return normalizeRDAPResponse(rdapResult);
  } catch (rdapError) {
    // Fall back to WHOIS
    logger.warn('rdap_fallback_to_whois', {
      domain,
      error: rdapError.message,
    });

    const whoisResult = await existingWhoisLookup(domain);
    return normalizeWHOISResponse(whoisResult);
  }
}
```

**معايير النجاح للمرحلة الثانية:**
- معدل الرجوع إلى WHOIS أقل من 5%
- لا توجد زيادة في معدلات الخطأ أو وقت الاستجابة
- تعمل منطق الأعمال بشكل صحيح مع بيانات RDAP

### المرحلة الثالثة: إزالة WHOIS

بعد التحقق من موثوقية RDAP، أزل تبعيات WHOIS:

```typescript
// Final: RDAP only
async function lookupDomain(domain: string) {
  const result = await rdapClient.domain(domain);
  return normalizeRDAPResponse(result);
}

// Delete: whois-parser.ts, whois-client.ts, whois-server-list.json
// Remove: npm uninstall whois whois-parsed node-whois
```

## تعيين الحقول: من WHOIS إلى RDAP

### حقول النطاق

| حقل WHOIS | مكافئه في RDAP | ملاحظات |
|------------|-----------------|-------|
| `Domain Name` | `ldhName` | دائمًا بأحرف صغيرة في RDAP |
| `Registry Domain ID` | `handle` | معرف فريد |
| `Creation Date` | `events[eventAction=registration].eventDate` | تنسيق ISO 8601 |
| `Updated Date` | `events[eventAction=last changed].eventDate` | تنسيق ISO 8601 |
| `Expiry Date` | `events[eventAction=expiration].eventDate` | تنسيق ISO 8601 |
| `Domain Status` | `status[]` | رموز موحدة |
| `Name Server` | `nameservers[].ldhName` | مصفوفة من الكائنات |
| `DNSSEC` | `secureDNS.delegationSigned` | قيمة منطقية |
| `Registrar` | `entities[roles=registrar].vcardArray` | كائن الكيان |
| `Registrant` | `entities[roles=registrant].vcardArray` | كثيرًا ما يكون محجوبًا |

### دوال مساعدة

```typescript
// Extract common fields from RDAP responses
function normalizeRDAPResponse(rdap: any) {
  return {
    domainName: rdap.ldhName,
    handle: rdap.handle,
    status: rdap.status ?? [],

    createdDate: rdap.events?.find(
      (e: any) => e.eventAction === 'registration'
    )?.eventDate ?? null,

    updatedDate: rdap.events?.find(
      (e: any) => e.eventAction === 'last changed'
    )?.eventDate ?? null,

    expiryDate: rdap.events?.find(
      (e: any) => e.eventAction === 'expiration'
    )?.eventDate ?? null,

    nameservers: rdap.nameservers?.map(
      (ns: any) => ns.ldhName
    ) ?? [],

    dnssec: rdap.secureDNS?.delegationSigned ?? false,

    registrar: rdap.entities?.find(
      (e: any) => e.roles?.includes('registrar')
    )?.vcardArray?.[1]?.find(
      (f: any) => f[0] === 'fn'
    )?.[3] ?? null,
  };
}
```

## المخاطر الشائعة في الترحيل

### المخطر الأول: أسماء الحقول المكتوبة ثابتة

غالبًا ما تستخدم محللات WHOIS تعبيرات نمطية مع أسماء حقول مكتوبة ثابتة. يستخدم RDAP بنية متسقة لكن أسماء الحقول مختلفة:

```typescript
// BAD: Looking for WHOIS-style field names in RDAP
const expiry = response['Registry Expiry Date']; // Won't work

// GOOD: Use RDAP's structured events
const expiry = response.events?.find(
  e => e.eventAction === 'expiration'
)?.eventDate;
```

### المخطر الثاني: افتراض دعم جميع امتدادات TLD لـ RDAP

تدعم معظم امتدادات gTLD بروتوكول RDAP، لكن بعض امتدادات ccTLD قد لا تدعمه بعد. تعامل مع هذا بلطف:

```typescript
async function lookupWithFallback(domain: string) {
  try {
    return await rdapClient.domain(domain);
  } catch (error) {
    if (error.code === 'NO_RDAP_SERVER') {
      // This TLD doesn't have RDAP yet
      logger.info(`No RDAP for ${domain}, using fallback`);
      return null;
    }
    throw error;
  }
}
```

### المخطر الثالث: اختلافات تنسيق التاريخ

تواريخ WHOIS غير متسقة. RDAP يستخدم دائمًا ISO 8601:

```typescript
// WHOIS: "14-Aug-2024" or "2024/08/14" or "August 14, 2024"
// RDAP: "2024-08-14T00:00:00Z" (always)

// No more date parsing gymnastics
const expiryDate = new Date(rdapEvent.eventDate); // Just works
```

### المخطر الرابع: توفر بيانات الاتصال

تعني اللوائح مثل GDPR أن كثيرًا من استجابات RDAP تحجب بيانات الاتصال. لا تفترض أن جهات الاتصال متاحة دائمًا:

```typescript
const registrant = domain.entities?.find(
  e => e.roles?.includes('registrant')
);

if (!registrant?.vcardArray) {
  // Contact data is redacted — this is normal, not an error
  console.log('Contact data redacted (GDPR)');
}
```

### المخطر الخامس: اختلافات تحديد معدل الطلبات

تستخدم خوادم RDAP تحديد معدل HTTP قياسي، والذي يتصرف بشكل مختلف عن WHOIS:

```typescript
const client = new RDAPClient({
  // RDAPify handles rate limiting automatically
  // Respects Retry-After headers
  timeout: 15000,
  cache: { ttl: 3600 }, // Reduce requests with caching
});
```

## اختبار عملية الترحيل

### اختبارات الوحدة

```typescript
describe('RDAP Migration', () => {
  it('should extract expiry date correctly', () => {
    const rdapResponse = {
      events: [
        {
          eventAction: 'expiration',
          eventDate: '2025-08-13T04:00:00Z',
        },
      ],
    };

    const normalized = normalizeRDAPResponse(rdapResponse);
    expect(normalized.expiryDate).toBe('2025-08-13T04:00:00Z');
  });

  it('should handle missing events gracefully', () => {
    const rdapResponse = { events: [] };
    const normalized = normalizeRDAPResponse(rdapResponse);
    expect(normalized.expiryDate).toBeNull();
  });

  it('should handle redacted contacts', () => {
    const rdapResponse = {
      entities: [
        {
          roles: ['registrant'],
          remarks: [{ title: 'REDACTED FOR PRIVACY' }],
        },
      ],
    };
    const normalized = normalizeRDAPResponse(rdapResponse);
    expect(normalized.registrar).toBeNull();
  });
});
```

### اختبارات التكامل

```typescript
describe('RDAP Integration', () => {
  it('should query real RDAP servers', async () => {
    const client = new RDAPClient();
    const result = await client.domain('google.com');

    expect(result.ldhName).toBe('google.com');
    expect(result.status).toContain('client delete prohibited');
    expect(result.nameservers?.length).toBeGreaterThan(0);
  });
});
```

## قائمة مراجعة الترحيل

- [ ] **المسح** — جرد جميع استخدامات WHOIS في قاعدة الكود
- [ ] **التثبيت** — `npm install rdapify`
- [ ] **تعيين الحقول** — إنشاء وثيقة تعيين الحقول
- [ ] **بناء الموحّد** — كتابة دالة تحول RDAP إلى تنسيقك الداخلي
- [ ] **وضع الظل** — تشغيل RDAP بالتوازي لمدة 2-4 أسابيع
- [ ] **المقارنة** — التحقق من تطابق نتائج RDAP مع بيانات WHOIS
- [ ] **التحويل** — جعل RDAP مصدرًا رئيسيًا مع WHOIS كاحتياط
- [ ] **المراقبة** — تتبع معدل الرجوع للاحتياط ومعدلات الخطأ
- [ ] **الإزالة** — حذف كود WHOIS وتبعياته
- [ ] **التوثيق** — تحديث الوثائق الداخلية

## الخلاصة

الترحيل من WHOIS إلى RDAP استثمار يؤتي ثماره فورًا: بيانات منظمة، أخطاء تحليل أقل، أمان أفضل، وحماية من إيقاف WHOIS في المستقبل. النهج التدريجي يقلل المخاطر، وRDAPify يتولى عنك تعقيدات البروتوكول.

ابدأ بوضع الظل اليوم. ستشكر نفسك لاحقًا.

---

*هل لديك أسئلة حول الترحيل المؤسسي؟ انضم إلى [GitHub Discussions](https://github.com/rdapify/rdapify/discussions) أو راجع [مرجع API](/docs/api-reference/client).*
