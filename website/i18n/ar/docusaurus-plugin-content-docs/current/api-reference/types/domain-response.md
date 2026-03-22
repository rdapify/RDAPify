# `DomainResponse`

كائن الاستجابة المُطبَّعة المُعادة من [`client.domain()`](../methods/domain.md).

```typescript
interface DomainResponse {
  query: string;           // النطاق المُدخَل كما قُدِّم
  objectClass: 'domain';
  handle?: string;         // المعرّف المُخصَّص من السجل (مثل '2336799_DOMAIN_COM-VRSN')
  ldhName?: string;        // صيغة LDH (ASCII)
  unicodeName?: string;    // صيغة Unicode (IDN) حين تنطبق
  status?: RDAPStatus[];   // علامات الحالة (مثل 'clientDeleteProhibited')
  nameservers?: string[];  // أسماء مضيف خوادم الأسماء المفوَّضة
  registrar?: {
    name?: string;
    handle?: string;
    url?: string;
  };
  entities?: RDAPEntity[];  // جميع الكيانات المرتبطة
  events?: RDAPEvent[];     // أحداث دورة الحياة
  links?: RDAPLink[];
  remarks?: RDAPRemark[];
  raw?: any;               // موجود فقط عند تفعيل خيار العميل includeRaw: true
  metadata: {
    source: string;        // عنوان URL لخادم RDAP
    timestamp: string;     // طابع زمني ISO 8601 للاستعلام
    cached: boolean;
  };
}
```

---

## الأنواع الفرعية

### `RDAPEvent`

```typescript
interface RDAPEvent {
  eventAction: string;  // 'registration' | 'expiration' | 'last changed' | ...
  eventDate: string;    // سلسلة التاريخ بتنسيق ISO 8601
  links?: RDAPLink[];
}
```

### `RDAPEntity`

```typescript
interface RDAPEntity {
  handle?: string;
  objectClass: string;
  roles?: string[];         // 'registrant' | 'administrative' | 'technical' | 'registrar' | ...
  vcardArray?: any[];       // تمثيل مصفوفة vCard 4.0
  entities?: RDAPEntity[];  // كيانات فرعية متداخلة
  events?: RDAPEvent[];
  links?: RDAPLink[];
  remarks?: RDAPRemark[];
}
```

### `RDAPLink`

```typescript
interface RDAPLink {
  value: string;
  rel: string;
  href: string;
  type?: string;
}
```

### `RDAPRemark`

```typescript
interface RDAPRemark {
  title?: string;
  description: string[];
  links?: RDAPLink[];
}
```

---

## إخفاء البيانات الشخصية

عند تفعيل `privacy: true` (الافتراضي)، تُستبدَل حقول vCard التالية داخل كائنات الكيان بـ `[REDACTED]`:

- `email`
- `phone` (tel)
- `fax`

الحقول الأخرى — `fn` (الاسم المُنسَّق)، `org`، `adr` — تُمرَّر كما هي من السجل. تتفاوت السجلات في مقدار ما تُظهره؛ معظم السجلات الحديثة تُخفي البيانات الشخصية من جانب الخادم بالفعل.

لتعطيل الإخفاء بالكامل:

```typescript
const client = new RDAPClient({ privacy: false });
```

لإعداد حقول الإخفاء أو نص الاستبدال:

```typescript
const client = new RDAPClient({
  privacy: {
    privacy: true,
    redactFields: ['email', 'phone', 'fax'],
    redactionText: '[REDACTED]',
  },
});
```

---

## أنماط الوصول الشائعة

```typescript
const result = await client.domain('example.com');

// إدخال الاستعلام
result.query             // 'example.com'

// خوادم الأسماء
result.nameservers       // ['a.iana-servers.net', 'b.iana-servers.net']

// المسجِّل
result.registrar?.name   // 'Registrar Name, Inc.'

// الكيانات حسب الدور
const registrant = result.entities?.find(e => e.roles?.includes('registrant'));
const techContact = result.entities?.find(e => e.roles?.includes('technical'));

// الأحداث
const expiry   = result.events?.find(e => e.eventAction === 'expiration');
const created  = result.events?.find(e => e.eventAction === 'registration');
const modified = result.events?.find(e => e.eventAction === 'last changed');

console.log(expiry?.eventDate);   // '2024-08-13T04:00:00Z'
console.log(created?.eventDate);  // '1995-08-14T04:00:00Z'

// معلومات التخزين المؤقت
result.metadata.cached    // false في الاستدعاء الأول، true عند إصابة التخزين المؤقت
result.metadata.source    // 'https://rdap.verisign.com/com/v1/domain/example.com'
result.metadata.timestamp // '2026-03-21T12:00:00.000Z'
```

---

## انظر أيضاً

- [`IPResponse`](ip-response.md)
- [`ASNResponse`](asn-response.md)
- [مرجع أسلوب `domain()`](../methods/domain.md)
- [ضوابط الخصوصية](../privacy-controls.md)
