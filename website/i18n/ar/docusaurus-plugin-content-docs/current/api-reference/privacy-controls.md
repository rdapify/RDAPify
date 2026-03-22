# ضوابط الخصوصية

تُطبّق RDAPify إخفاء البيانات الشخصية على استجابات RDAP قبل إعادتها إلى المستدعي. الإخفاء مُفعَّل افتراضياً ويستهدف حقول vCard التي تحمل عادةً بيانات شخصية.

---

## الإعداد

### التفعيل والتعطيل (الصيغة المختصرة)

```typescript
// مُفعَّل بالإعدادات الافتراضية (هذا هو السلوك الافتراضي)
const client = new RDAPClient({ privacy: true });

// معطَّل — تُعاد جميع حقول vCard كما هي من السجل
const client = new RDAPClient({ privacy: false });
```

### التحكم الدقيق

```typescript
const client = new RDAPClient({
  privacy: {
    privacy: true,
    redactFields: ['email', 'phone', 'fax'],  // الحقول المراد إخفاؤها (الافتراضي)
    redactionText: '[REDACTED]',               // قيمة الاستبدال (الافتراضي)
  },
});
```

لإخفاء حقول إضافية:

```typescript
const client = new RDAPClient({
  privacy: {
    privacy: true,
    redactFields: ['email', 'phone', 'fax', 'adr', 'url'],
  },
});
```

---

## ما الذي يُخفى

يُطبَّق الإخفاء على خصائص vCard داخل كائنات `RDAPEntity.vcardArray`. الحقول الافتراضية هي:

| خاصية vCard | القيمة المُخفاة |
|----------------|----------------|
| `email` | `[REDACTED]` |
| `tel` (هاتف) | `[REDACTED]` |
| `fax` | `[REDACTED]` |

الحقول التي **لا** يُعدِّلها محرك الإخفاء أبداً:

- `nameservers` — بيانات البنية التحتية التقنية
- `status` — علامات حالة النطاق/الشبكة
- `registrar.name` و`registrar.url` — بيانات السجل على مستوى الأعمال
- `country` و`startAddress` و`endAddress` و`ipVersion` — بيانات تخصيص الشبكة
- جميع حقول `metadata`

> ملاحظة: تُخفي كثير من سجلات RDAP الحديثة البيانات الشخصية من جانب الخادم قبل إعادة الاستجابة. يوفر إخفاء RDAPify من جانب العميل طبقة حماية إضافية، لكنه لا يُولّد إخفاءً لم يُجرِه السجل.

---

## الوصول إلى الاستجابة الخام

يُرفق ضبط `includeRaw: true` الاستجابة غير المعالجة من السجل على `result.raw`. الاستجابة الخام **لا** تخضع للإخفاء من جانب العميل:

```typescript
const client = new RDAPClient({ includeRaw: true });
const result = await client.domain('example.com');

// result مُخفى (بناءً على إعداد privacy)
// result.raw هي الاستجابة غير المعالجة من الخادم
```

لا تُفعّل `includeRaw` إلا عند الحاجة الموثوقة إليها (مثلاً للتصحيح أو التدقيق على امتثال له أساس قانوني موثَّق).

---

## فحص حالة الإخفاء

كل استجابة تحمل كائن `metadata`:

```typescript
result.metadata.cached    // هل جاءت النتيجة من التخزين المؤقت
result.metadata.source    // خادم RDAP الذي أجاب على الاستعلام
result.metadata.timestamp // وقت الاستعلام بتنسيق ISO 8601
```

يُطبَّق الإخفاء بشكل موحّد على جميع الاستجابات الحية والمخزنة مؤقتاً. لا يوجد علامة `metadata.redacted` — إذا كان `privacy: true` مضبوطاً، يُطبَّق الإخفاء دائماً.

---

## التفاعل مع التخزين المؤقت

تُخزَّن الاستجابات مؤقتاً **بعد** الإخفاء. هذا يعني:

- المدخلات المخزنة مؤقتاً لا تحتوي أبداً على حقول البيانات الشخصية التي كان من المفترض إخفاؤها.
- تغيير خيارات `privacy` لا يؤثر بأثر رجعي على المدخلات المخزنة مؤقتاً؛ استدعِ `client.clearCache()` عند تغيير إعدادات الإخفاء.

```typescript
const client = new RDAPClient({ privacy: true });
await client.domain('example.com');  // مخزن مؤقتاً مع تطبيق الإخفاء

// تعطيل الخصوصية ومسح التخزين المؤقت للحصول على بيانات غير مُخفاة
const unredacted = new RDAPClient({ privacy: false });
await unredacted.clearCache();
const result = await unredacted.domain('example.com');
```

---

## التضمين الخام لكل استعلام

`includeRaw` خيار على مستوى العميل — لا يمكن ضبطه لكل استدعاء بشكل منفصل. أنشئ نسخة عميل منفصلة إن احتجت إلى استجابات مُخفاة وخام في آنٍ واحد:

```typescript
const standard = new RDAPClient();
const raw      = new RDAPClient({ privacy: false, includeRaw: true });

const redacted = await standard.domain('example.com');
const full     = await raw.domain('example.com');
```

---

## انظر أيضاً

- [RDAPClientOptions — `privacy`](client.md#privacy)
- [أنواع الخيارات — `PrivacyOptions`](types/options.md#privacyoptions)
- [حماية SSRF](../security/ssrf-prevention.md)
