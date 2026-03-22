# التثبيت

## متطلبات النظام

| بيئة التشغيل | الحد الأدنى للإصدار | ملاحظات |
|---------|-----------------|-------|
| Node.js | 20.x | الإصدار الموصى به. مطلوب لتشغيل الأداة من سطر الأوامر CLI. |
| Bun | 1.0 | مدعوم عبر حزمة npm القياسية. |
| Deno | 1.30 | يُستخدم مع محدد `npm:` (`import { RDAPClient } from 'npm:rdapify'`). |
| Cloudflare Workers | الإصدار الحالي | يدعم الذاكرة المؤقتة في الذاكرة والمقاييس؛ لا يدعم الذاكرة المؤقتة المستندة إلى الملفات. |

يُشترط استخدام TypeScript 5.0 أو أحدث للتطوير. تحتوي الحزمة الموزعة على تعريفات النوع الكاملة `.d.ts` — لا حاجة لحزمة `@types/rdapify` منفصلة.

## التثبيت

```bash
# npm
npm install rdapify

# yarn
yarn add rdapify

# pnpm
pnpm add rdapify

# Bun
bun add rdapify
```

## اختياري: الواجهة الخلفية الأصلية بلغة Rust

للسيناريوهات عالية الإنتاجية، قم بتثبيت `rdapify-nd` جنبًا إلى جنب مع `rdapify`. عند توفّرها، تُنفَّذ طرق الاستعلام الخمس الأساسية (`domain`، `ip`، `asn`، `nameserver`، `entity`) عبر ملف Rust مُصرَّف بدلًا من خط أنابيب TypeScript.

```bash
npm install rdapify rdapify-nd
```

`rdapify-nd` هو إضافة Node.js أصلية جاهزة للبناء (ملف `.node`). تُنشر ملفات ثنائية خاصة بكل منصة لـ Linux x64، وmacOS x64، وmacOS arm64، وWindows x64.

## التحقق من التثبيت

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();
const result = await client.domain('example.com');

console.log(result.query);           // "example.com"
console.log(result.registrar?.name); // اسم جهة التسجيل
console.log(result.nameservers);     // خوادم الأسماء المفوَّضة
```

التشغيل:
```bash
node --input-type=module < verify.ts
# أو بعد التصريف عبر tsc:
node dist/verify.js
```

## إعداد TypeScript

تستهدف الحزمة ES2020 مع مخرجات CommonJS. إعداد `tsconfig.json` الأدنى لمشروع مستهلِك:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true
  }
}
```

إذا كنت على Node.js 20+ وتريد ESM أصليًا، فعيِّن `"module": "Node16"` و`"moduleResolution": "Node16"`.

## CLI

أداة CLI الخاصة بـ `rdapify` مُدرجة في الحزمة ولا تحتاج إلى تثبيت منفصل:

```bash
npx rdapify domain example.com
npx rdapify ip 8.8.8.8
npx rdapify asn AS15169
npx rdapify nameserver ns1.example.com
npx rdapify entity ARIN-HN-1 --server https://rdap.arin.net/registry
```

لتثبيت CLI عالميًا:

```bash
npm install -g rdapify
rdapify domain example.com --json
```

## استكشاف الأخطاء وإصلاحها

**`MODULE_NOT_FOUND` للوحدة `rdapify-nd`**

`rdapify-nd` اختيارية. إذا لم تكن مثبتة، يعود `RDAPClient` تلقائيًا إلى الواجهة الخلفية لـ TypeScript (عندما يكون خيار `backend` هو `'auto'`، وهو الافتراضي). فقط `backend: 'native'` يطرح استثناء إذا كانت الوحدة غائبة.

**TypeScript: `Cannot find module 'rdapify'`**

تأكد من تعيين `moduleResolution` إلى `"node"` أو `"node16"` في ملف `tsconfig.json`. تُعرَّف صادرات الحزمة في `package.json#exports` وتتطلب محللًا يدعم حقل `exports`.

**انتهاء المهلة في بيئات الشبكة المقيدة**

قم بتهيئة عنوان URL مخصص للبوتستراب ومهلة زمنية:

```typescript
const client = new RDAPClient({
  bootstrapUrl: 'https://data.iana.org/rdap',
  timeout: { request: 15000, connect: 5000 },
});
```

إذا كان HTTPS الصادر إلى IANA محجوبًا، قم بعمل نسخة محلية لملفات البوتستراب وأشِر إليها باستخدام `bootstrapUrl`.

---

التالي: [البدء السريع](./quick-start.md)
