---
slug: securing-domain-lookups-ssrf-protection
title: "تأمين عمليات بحث النطاقات: دليل الحماية من SSRF في عملاء RDAP"
authors: [rdapify]
tags: [security, ssrf, rdap, best-practices]
description: "عملاء RDAP يُرسلون طلبات HTTP خارجية — مما يجعلهم ناقلات محتملة لـ SSRF. تعلم كيفية حماية تطبيقاتك بدفاعات SSRF مناسبة عند إجراء عمليات بحث عن النطاقات."
keywords: [ssrf protection, server side request forgery, secure domain lookup, rdap security, ssrf prevention nodejs, domain lookup security]
image: /img/rdapify-social-card.png
---

كل عميل RDAP يُرسل طلبات HTTP خارجية إلى خوادم خارجية. إذا كان مدخل المستخدم يُؤثر على هذه الطلبات، فلديك ثغرة أمنية محتملة لتزوير طلبات جانب الخادم (SSRF). يوضح هذا الدليل كيفية عمل هجمات SSRF في سياق عمليات بحث النطاقات وكيفية الدفاع ضدها.

<!-- truncate -->

## ما هو SSRF؟

تزوير طلبات جانب الخادم (SSRF) يخدع خادمك لإرسال طلبات إلى وجهات غير مقصودة. في سياق بحث RDAP/WHOIS:

```
مدخل المستخدم: "evil.com"
المتوقع: العميل يستعلم rdap.verisign.com عن evil.com
الهجوم الفعلي: يتلاعب المهاجم بالطلب للوصول إلى خدمات داخلية
```

يمكن للمهاجم أن:

- **يصل إلى الخدمات الداخلية** — `http://169.254.169.254/` (بيانات السحابة)، `http://localhost:6379/` (Redis)
- **يفحص الشبكات الداخلية** — رسم خريطة البنية التحتية الداخلية
- **يسرّب البيانات** — توجيه بيانات حساسة عبر خوادم يتحكم فيها المهاجم
- **يتجاوز جدران الحماية** — استخدام خادمك كوكيل للوصول إلى موارد محمية

## كيف ينطبق SSRF على عملاء RDAP

عملاء RDAP عرضة بشكل خاص لأنهم يتبعون عملية متعددة الخطوات:

```
1. المستخدم يُقدّم اسم نطاق (مدخل مستخدم)
2. العميل يستعلم Bootstrap الخاص بـ IANA (موثوق)
3. Bootstrap يُعيد رابط خادم RDAP (شبه موثوق)
4. العميل يُرسل طلب HTTP لذلك الرابط (ناقل SSRF محتمل!)
5. قد يُعيد خادم RDAP روابط تحويل (ناقل آخر!)
```

### ناقل الهجوم الأول: بيانات Bootstrap ضارة

إذا استطاع مهاجم التأثير على بيانات Bootstrap (كاش مسموم، هجوم وسيط)، يمكنه إعادة توجيه عميلك إلى نقطة نهاية داخلية.

### ناقل الهجوم الثاني: اتباع التحويلات

يمكن لخادم RDAP إعادة تحويل HTTP إلى رابط داخلي:

```
GET https://rdap.example.com/domain/test.com
→ 302 Redirect → http://169.254.169.254/latest/meta-data/
```

### ناقل الهجوم الثالث: روابط مضمّنة في الاستجابات

تحتوي استجابات RDAP على مصفوفات `links`. يمكن لخادم ضار تضمين روابط داخلية يتبعها تطبيقك.

## استراتيجيات الحماية من SSRF

### 1. حظر نطاقات IP الخاصة/المحجوزة

لا تسمح أبدًا بالطلبات إلى عناوين IP الخاصة أو الاسترجاعية أو المحجوزة:

```
النطاقات المحظورة:
- 10.0.0.0/8        (Private)
- 172.16.0.0/12     (Private)
- 192.168.0.0/16    (Private)
- 127.0.0.0/8       (Loopback)
- 169.254.0.0/16    (Link-local / Cloud metadata)
- 0.0.0.0/8         (Current network)
- 100.64.0.0/10     (Carrier-grade NAT)
- ::1/128           (IPv6 loopback)
- fc00::/7          (IPv6 unique local)
- fe80::/10         (IPv6 link-local)
```

### 2. التحقق من حل DNS

حلّ أسماء المضيفين *قبل* الاتصال وتحقق من الـ IP المحلول:

```
Hostname: evil-rdap-server.com
DNS resolves to: 169.254.169.254  ← BLOCK!
```

يمنع هذا هجمات إعادة ربط DNS حيث يحل اسم المضيف مبدئيًا إلى IP عام ثم يتغير إلى IP خاص في عمليات البحث التالية.

### 3. إلزامية البروتوكول

اسمح فقط بـ HTTPS. احظر `http://`، `file://`، `gopher://`، `ftp://`، وجميع المخططات الأخرى.

### 4. حدود التحويل

حدّد اتباع التحويلات وتحقق من صحة كل وجهة تحويل وفق نفس قواعد SSRF.

## كيف يتعامل RDAPify مع SSRF

يمتلك RDAPify حماية مدمجة من SSRF مُفعَّلة بشكل افتراضي:

```typescript
import { RDAPClient } from 'rdapify';

// SSRF protection is ON by default
const client = new RDAPClient();

// These are automatically blocked:
// - Requests to private IP ranges
// - DNS rebinding attacks
// - Suspicious redirects
// - Non-HTTPS protocols
```

### ما الذي يحظره RDAPify

طبقة الحماية من SSRF في RDAPify:

1. **يحل DNS قبل الاتصال** — يتحقق من أن الـ IP المحلول ليس في نطاق خاص
2. **يحظر جميع النطاقات الخاصة/المحجوزة** — بما في ذلك IPv4 وIPv6
3. **يُلزم بـ HTTPS** — يرفض الاتصالات غير المشفرة بخوادم RDAP
4. **يتحقق من التحويلات** — يُفحص كل تحويل وفق قواعد SSRF
5. **يُحدّد عمق التحويل** — يمنع سلاسل التحويل اللانهائية

### اختبار الحماية من SSRF

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

// This would throw an SSRF error if the bootstrap
// somehow resolved to a private IP
try {
  await client.domain('example.com');
} catch (error) {
  if (error.code === 'SSRF_BLOCKED') {
    console.error('SSRF attempt blocked:', error.message);
  }
}
```

## الدفاع المعمّق: ما هو أبعد من العميل

الحماية من SSRF في عميل RDAP هي طبقة واحدة فقط. الدفاع الكامل يشمل:

### ضوابط مستوى الشبكة

```
# Firewall rules: block outbound to private ranges
iptables -A OUTPUT -d 169.254.0.0/16 -j DROP
iptables -A OUTPUT -d 10.0.0.0/8 -j DROP
iptables -A OUTPUT -d 172.16.0.0/12 -j DROP
iptables -A OUTPUT -d 192.168.0.0/16 -j DROP
```

### حماية بيانات تعريف السحابة

إذا كنت تعمل على AWS أو GCP أو Azure، استخدم IMDSv2 (يتطلب رمزًا) بدلًا من نقطة نهاية البيانات الافتراضية:

```bash
# AWS: Require IMDSv2 tokens
aws ec2 modify-instance-metadata-options \
  --instance-id i-1234567890abcdef0 \
  --http-tokens required
```

### ضوابط مستوى التطبيق

```typescript
// Rate limit RDAP queries per user
const rateLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60000, // 100 requests per minute
});

// Validate user input before querying
function validateDomainInput(input: string): boolean {
  // Only allow valid domain name characters
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
  return domainRegex.test(input) && input.length <= 253;
}
```

## تقنيات تجاوز SSRF الشائعة (والدفاعات)

| تقنية التجاوز | المثال | الدفاع |
|-----------------|---------|---------|
| IP العشري | `http://2130706433/` (= 127.0.0.1) | تحليل وتوحيد جميع صيغ IP |
| تعيين IPv6 | `http://[::ffff:127.0.0.1]/` | فحص عناوين IPv4 المعيّنة بـ IPv6 |
| إعادة ربط DNS | المضيف يحل إلى IPs مختلفة | حل DNS والتحقق قبل الاتصال |
| ترميز URL | `http://127.0.0.1%00@evil.com/` | تحليل URL صارم قبل الحل |
| سلسلة تحويلات | عام → خاص عبر 302 | التحقق من كل وجهة تحويل |
| URL مختصر | `http://bit.ly/xyz` → IP خاص | حل والتحقق من الوجهة النهائية |

## قائمة مراجعة: تكامل RDAP آمن من SSRF

- [ ] استخدام عميل مع حماية مدمجة من SSRF (كـ RDAPify)
- [ ] التحقق من مدخل المستخدم قبل تمريره لعميل RDAP
- [ ] حظر الطلبات الخارجية لنطاقات IP الخاصة على مستوى جدار الحماية
- [ ] حماية نقاط نهاية البيانات السحابية (IMDSv2)
- [ ] تحديد معدل استعلامات RDAP
- [ ] تسجيل ومراقبة الطلبات الخارجية بحثًا عن الشذوذات
- [ ] تحديث عميل RDAP باستمرار لأحدث تصحيحات الأمان

## الخلاصة

عملاء RDAP أدوات قوية، لكنها تُرسل طلبات HTTP خارجية استنادًا إلى بيانات شبه موثوقة. الحماية من SSRF ليست اختيارية — إنها ضرورة. يبني RDAPify هذه الدفاعات بشكل افتراضي، حتى تتمكن من الاستعلام عن بيانات التسجيل بأمان دون بناء طبقة أمان خاصة بك.

---

*تعرّف على المزيد حول ميزات الأمان في RDAPify في [توثيق الأمان](/docs/guides/error-handling) أو شغّل مجموعة اختبارات SSRF: `npm run test:security`.*
