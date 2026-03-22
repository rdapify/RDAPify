# `asn()`

```typescript
asn(asn: string | number): Promise<ASNResponse>
```

يستعلم عن بيانات RDAP لرقم نظام مستقل (ASN). يُكتشف RIR المعتمد تلقائياً من سجل IANA Bootstrap.

---

## المعاملات

| المعامل | النوع | الوصف |
|-----------|------|-------------|
| `asn` | `string \| number` | الـ ASN — رقم مجرد (`15169`) أو سلسلة مسبوقة بـ `AS` (`'AS15169'`). تُقبل البادئة بغض النظر عن حالة الأحرف. |

---

## قيمة الإعادة — `ASNResponse`

```typescript
interface ASNResponse {
  query: string;          // سلسلة الاستعلام المُطبَّعة (مثل 'AS15169')
  objectClass: 'autnum';
  handle?: string;        // معرّف السجل
  startAutnum?: number;   // أول ASN في الكتلة المُخصَّصة
  endAutnum?: number;     // آخر ASN في الكتلة المُخصَّصة
  name?: string;          // اسم المنظمة (مثل 'GOOGLE')
  type?: string;          // نوع التخصيص
  country?: string;       // رمز الدولة ISO 3166-1 alpha-2
  status?: RDAPStatus[];
  entities?: RDAPEntity[];
  events?: RDAPEvent[];
  links?: RDAPLink[];
  remarks?: RDAPRemark[];
  raw?: any;              // موجود فقط عند تفعيل includeRaw: true
  metadata: {
    source: string;
    timestamp: string;
    cached: boolean;
  };
}
```

---

## أمثلة

### بحث أساسي

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

// كلا الصيغتين متكافئتان
const result = await client.asn(15169);
const result = await client.asn('AS15169');

console.log(result.query);      // 'AS15169'
console.log(result.name);       // 'GOOGLE'
console.log(result.country);    // 'US'
console.log(result.startAutnum); // 15169
console.log(result.endAutnum);   // 15169
```

### الوصول إلى كيان المسجِّل

```typescript
const result = await client.asn(15169);

const registrant = result.entities?.find(e => e.roles?.includes('registrant'));
console.log(registrant?.handle);
```

### أحداث الانتهاء / آخر تعديل

```typescript
const result = await client.asn(15169);

const lastChanged = result.events?.find(e => e.eventAction === 'last changed');
console.log(lastChanged?.eventDate); // تاريخ ISO 8601
```

---

## معالجة الأخطاء

```typescript
import { RDAPClient, ValidationError, FetchError } from 'rdapify';

const client = new RDAPClient();

try {
  const result = await client.asn(15169);
} catch (error) {
  if (error instanceof ValidationError) {
    // ASN مشوَّه أو خارج النطاق المسموح
  } else if (error instanceof FetchError) {
    // خطأ شبكي أو استجابة غير 2xx بعد المحاولات
  }
}
```

---

## ذو صلة

- [domain()](domain.md)
- [ip()](ip.md)
- [خيارات RDAPClient](../client.md#constructor-options)
