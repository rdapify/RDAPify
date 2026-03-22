# `domain()`

```typescript
domain(domain: string): Promise<DomainResponse>
```

يستعلم عن بيانات تسجيل اسم نطاق. يُكتشف خادم RDAP المعتمد تلقائياً من سجل IANA Bootstrap (RFC 9224).

---

## المعاملات

| المعامل | النوع | الوصف |
|-----------|------|-------------|
| `domain` | `string` | اسم النطاق — ASCII (LDH) أو Unicode IDN (مثل `'example.com'`، `'例子.测试'`) |

---

## قيمة الإعادة — `DomainResponse`

```typescript
interface DomainResponse {
  query: string;           // النطاق المُدخَل كما قُدِّم
  objectClass: 'domain';
  handle?: string;         // المعرّف المُخصَّص من السجل (مثل '2336799_DOMAIN_COM-VRSN')
  ldhName?: string;        // صيغة LDH (ASCII) للنطاق
  unicodeName?: string;    // صيغة Unicode (IDN) حين تختلف عن ldhName
  status?: RDAPStatus[];   // علامات الحالة وفق RFC 5732 (مثل 'clientDeleteProhibited')
  nameservers?: string[];  // خوادم الأسماء المفوَّضة (أسماء المضيف فقط)
  registrar?: {
    name?: string;
    handle?: string;
    url?: string;
  };
  entities?: RDAPEntity[];  // جميع الكيانات المرتبطة (المسجِّل، الإداري، التقني، إلخ)
  events?: RDAPEvent[];     // أحداث دورة الحياة — انظر أدناه
  links?: RDAPLink[];
  remarks?: RDAPRemark[];
  raw?: any;               // موجود فقط عند تفعيل خيار العميل includeRaw: true
  metadata: {
    source: string;        // عنوان URL لخادم RDAP الذي قدَّم الاستجابة
    timestamp: string;     // طابع زمني ISO 8601 للاستعلام
    cached: boolean;       // true عند التقديم من التخزين المؤقت
  };
}
```

### الأحداث

```typescript
interface RDAPEvent {
  eventAction: string;  // مثل 'registration', 'expiration', 'last changed'
  eventDate: string;    // سلسلة التاريخ بتنسيق ISO 8601
}
```

قيم `eventAction` الشائعة: `'registration'`، `'last changed'`، `'expiration'`، `'deletion'`.

### الكيانات

تحمل الكيانات معلومات الدور في مصفوفة `roles` الخاصة بها. الأدوار الشائعة: `'registrant'`، `'administrative'`، `'technical'`، `'billing'`، `'registrar'`.

عند تفعيل إخفاء البيانات الشخصية (الافتراضي)، تُستبدَل الحقول مثل `email` و`phone` و`fax` داخل بيانات vCard للكيان بـ `[REDACTED]`.

---

## أمثلة

### استعلام أساسي

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();
const result = await client.domain('example.com');

console.log(result.query);                    // 'example.com'
console.log(result.registrar?.name);          // اسم المسجِّل
console.log(result.nameservers);              // ['a.iana-servers.net', 'b.iana-servers.net']
console.log(result.status);                   // ['client delete prohibited', ...]
console.log(result.metadata.cached);          // false (الاستدعاء الأول)، true (الاستدعاءات اللاحقة)

// تاريخ الانتهاء
const expiry = result.events?.find(e => e.eventAction === 'expiration');
console.log(expiry?.eventDate);               // '2024-08-13T04:00:00Z'
```

### مع الاستجابة الخام

```typescript
const client = new RDAPClient({ includeRaw: true });
const result = await client.domain('example.com');

console.log(result.raw); // RDAP JSON غير معالج من السجل
```

### تعطيل إخفاء البيانات الشخصية

```typescript
const client = new RDAPClient({ privacy: false });
const result = await client.domain('example.com');
// حقول vCard للكيان (email, phone) لا تُخفى
```

### أنواع TypeScript الصريحة

```typescript
import { RDAPClient, DomainResponse, RDAPEvent } from 'rdapify';

const client = new RDAPClient();
const result: DomainResponse = await client.domain('example.com');

const expiry: RDAPEvent | undefined =
  result.events?.find(e => e.eventAction === 'expiration');
```

---

## معالجة الأخطاء

```typescript
import { RDAPClient, ValidationError, FetchError, SSRFError } from 'rdapify';

const client = new RDAPClient();

try {
  const result = await client.domain('example.com');
} catch (error) {
  if (error instanceof ValidationError) {
    // اسم نطاق مشوَّه
  } else if (error instanceof SSRFError) {
    // الهدف محجوب بواسطة حماية SSRF
  } else if (error instanceof FetchError) {
    // خطأ شبكي أو استجابة غير 2xx بعد كل المحاولات
  }
}
```

---

## ذو صلة

- [ip()](ip.md) — استعلامات عناوين IP
- [asn()](asn.md) — استعلامات ASN
- [nameserver()](../client.md#nameservernameserver) — استعلامات خوادم الأسماء
- [entity()](../client.md#entityhandle-serverurl) — استعلامات الكيانات
- [خيارات RDAPClient](../client.md#constructor-options) — المهلة الزمنية، التخزين المؤقت، إعادة المحاولة، الخصوصية
