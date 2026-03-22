# `ip()`

```typescript
ip(ip: string): Promise<IPResponse>
```

يستعلم عن بيانات RDAP لعنوان IPv4 أو IPv6. يُكتشف سجل الإنترنت الإقليمي (RIR) المعتمد تلقائياً من سجل IANA Bootstrap.

---

## المعاملات

| المعامل | النوع | الوصف |
|-----------|------|-------------|
| `ip` | `string` | عنوان IPv4 أو IPv6 — مثل `'8.8.8.8'`، `'2001:4860:4860::8888'` |

---

## قيمة الإعادة — `IPResponse`

```typescript
interface IPResponse {
  query: string;              // عنوان IP المُدخَل
  objectClass: 'ip network';
  handle?: string;            // معرّف الشبكة (مثل 'NET-8-8-8-0-2')
  startAddress?: string;      // أول عنوان في الكتلة المُخصَّصة
  endAddress?: string;        // آخر عنوان في الكتلة المُخصَّصة
  ipVersion?: 'v4' | 'v6';
  name?: string;              // اسم الشبكة (مثل 'GOOGL-2')
  type?: string;              // نوع التخصيص
  country?: string;           // رمز الدولة ISO 3166-1 alpha-2
  status?: RDAPStatus[];
  entities?: RDAPEntity[];    // مالك الشبكة، جهة اتصال الإساءة، إلخ
  events?: RDAPEvent[];
  links?: RDAPLink[];
  remarks?: RDAPRemark[];
  raw?: any;                  // موجود فقط عند تفعيل includeRaw: true
  metadata: {
    source: string;           // عنوان URL لخادم RDAP التابع لـ RIR
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
const result = await client.ip('8.8.8.8');

console.log(result.query);        // '8.8.8.8'
console.log(result.name);         // 'GOOGL-2'
console.log(result.country);      // 'US'
console.log(result.startAddress); // '8.8.8.0'
console.log(result.endAddress);   // '8.8.8.255'
console.log(result.ipVersion);    // 'v4'
```

### IPv6

```typescript
const result = await client.ip('2001:4860:4860::8888');
console.log(result.ipVersion); // 'v6'
console.log(result.country);   // 'US'
```

### الوصول إلى كيان مالك الشبكة

```typescript
const result = await client.ip('8.8.8.8');

const owner = result.entities?.find(e => e.roles?.includes('registrant'));
console.log(owner?.handle); // 'GOGL'
```

---

## حماية SSRF

الاستعلامات عن نطاقات IP الخاصة والمحجوزة تُحجب بواسطة حماية SSRF (مُفعَّلة افتراضياً):

```typescript
// هذه تُلقي SSRFError:
await client.ip('192.168.1.1');    // نطاق RFC 1918 الخاص
await client.ip('127.0.0.1');      // العودة المحلية (Loopback)
await client.ip('169.254.0.1');    // رابط محلي (Link-local)
```

لتعطيل حماية SSRF (غير موصى به في بيئة الإنتاج):

```typescript
const client = new RDAPClient({ ssrfProtection: false });
```

---

## معالجة الأخطاء

```typescript
import { RDAPClient, ValidationError, FetchError, SSRFError } from 'rdapify';

const client = new RDAPClient();

try {
  const result = await client.ip('8.8.8.8');
} catch (error) {
  if (error instanceof ValidationError) {
    // عنوان IP مشوَّه
  } else if (error instanceof SSRFError) {
    // IP خاص/محجوز مُحجوب
  } else if (error instanceof FetchError) {
    // خطأ شبكي أو استجابة غير 2xx بعد المحاولات
  }
}
```

---

## ذو صلة

- [domain()](domain.md)
- [asn()](asn.md)
- [خيارات RDAPClient](../client.md#constructor-options) — ssrfProtection، التخزين المؤقت، المهلة الزمنية
