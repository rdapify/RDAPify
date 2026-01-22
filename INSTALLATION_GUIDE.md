# 📦 RDAPify - دليل التثبيت والإعداد

**التاريخ**: 22 يناير 2025  
**الإصدار**: v0.1.0-alpha.1

---

## 🎯 المتطلبات الأساسية

### Node.js

- **الإصدار المطلوب**: Node.js 16.0.0 أو أحدث
- **الموصى به**: Node.js 20.x LTS

تحقق من إصدار Node.js:

```bash
node --version
```

إذا كنت بحاجة لتثبيت Node.js:

- **Windows/Mac**: [nodejs.org](https://nodejs.org/)
- **Linux**: استخدم مدير الحزم الخاص بك

### npm

- **الإصدار المطلوب**: npm 7.0.0 أو أحدث
- **يأتي مع**: Node.js

تحقق من إصدار npm:

```bash
npm --version
```

---

## 📥 خطوات التثبيت

### الخطوة 1: تثبيت Dependencies

```bash
# تثبيت جميع dependencies
npm install
```

هذا سيثبت:

**Dev Dependencies**:

- `typescript` - TypeScript compiler
- `@types/node` - Node.js type definitions
- `@types/jest` - Jest type definitions
- `jest` - Testing framework
- `ts-jest` - TypeScript support for Jest
- `eslint` - Code linting
- `@typescript-eslint/*` - TypeScript ESLint plugins
- `prettier` - Code formatting
- `eslint-config-prettier` - ESLint + Prettier integration
- `husky` - Git hooks
- `rimraf` - Cross-platform rm -rf

**الوقت المتوقع**: 2-3 دقائق

---

### الخطوة 2: التحقق من التثبيت

```bash
# تحقق من TypeScript
npx tsc --version

# تحقق من Jest
npx jest --version

# تحقق من ESLint
npx eslint --version
```

**النتيجة المتوقعة**:

```
TypeScript: 5.3.3
Jest: 29.7.0
ESLint: 8.56.0
```

---

### الخطوة 3: إعداد Husky (Git Hooks)

```bash
# إعداد Husky
npm run prepare
```

هذا سيُنشئ:

- `.husky/` directory
- Pre-commit hooks

---

### الخطوة 4: بناء المشروع

```bash
# بناء المشروع
npm run build
```

**ما يحدث**:

1. `npm run clean` - حذف مجلد `dist/`
2. `npm run build:types` - توليد `.d.ts` files
3. `npm run build:cjs` - بناء CommonJS
4. `npm run build:esm` - بناء ES Modules

**النتيجة المتوقعة**:

```
dist/
├── index.js          # CommonJS
├── index.mjs         # ES Module
├── index.d.ts        # Type definitions
├── client/
├── fetcher/
├── normalizer/
├── cache/
├── types/
└── utils/
```

---

### الخطوة 5: التحقق من الأنواع (Type Checking)

```bash
# تحقق من TypeScript types
npm run typecheck
```

**النتيجة المتوقعة**: لا أخطاء

---

### الخطوة 6: فحص الكود (Linting)

```bash
# فحص الكود
npm run lint
```

**إذا وجدت أخطاء**:

```bash
# إصلاح تلقائي
npm run lint:fix
```

---

### الخطوة 7: تنسيق الكود (Formatting)

```bash
# تحقق من التنسيق
npm run format:check

# تنسيق تلقائي
npm run format
```

---

### الخطوة 8: اختبار الأمثلة

```bash
# بناء المشروع أولاً
npm run build

# تشغيل مثال Domain lookup
node examples/basic/domain_lookup.js

# تشغيل مثال IP lookup
node examples/basic/ip_lookup.js

# تشغيل مثال ASN lookup
node examples/basic/asn_lookup.js
```

**ملاحظة**: الأمثلة تحتاج اتصال بالإنترنت للاستعلام من RDAP servers

---

## 🧪 تشغيل الاختبارات

### اختبارات Unit (متوفرة حالياً)

```bash
# تشغيل جميع الاختبارات
npm test

# تشغيل unit tests فقط
npm run test:unit

# تشغيل مع watch mode
npm run test:watch

# تشغيل مع coverage report
npm test -- --coverage
```

**الاختبارات المتوفرة حالياً**:

- ✅ validators.test.ts
- ✅ helpers.test.ts
- ✅ errors.test.ts
- ✅ in-memory-cache.test.ts
- ✅ ssrf-protection.test.ts

---

## 🔧 استكشاف الأخطاء

### مشكلة: npm install فشل

**الحل**:

```bash
# حذف node_modules و package-lock.json
rm -rf node_modules package-lock.json

# إعادة التثبيت
npm install
```

### مشكلة: TypeScript errors

**الحل**:

```bash
# تحقق من إصدار TypeScript
npx tsc --version

# إعادة بناء
npm run clean
npm run build
```

### مشكلة: ESLint errors

**الحل**:

```bash
# إصلاح تلقائي
npm run lint:fix

# إذا استمرت المشاكل، تحقق من .eslintrc.js
```

### مشكلة: Husky لا يعمل

**الحل**:

```bash
# إعادة إعداد Husky
rm -rf .husky
npm run prepare
```

### مشكلة: الأمثلة لا تعمل

**الحل**:

```bash
# تأكد من بناء المشروع أولاً
npm run build

# تحقق من وجود dist/
ls -la dist/

# تشغيل المثال مع verbose
node examples/basic/domain_lookup.js
```

---

## 📊 التحقق من الإعداد

### Checklist الإعداد الكامل

- [ ] Node.js 16+ مثبت
- [ ] npm 7+ مثبت
- [ ] `npm install` نجح
- [ ] `npm run build` نجح
- [ ] `npm run typecheck` نجح (لا أخطاء)
- [ ] `npm run lint` نجح (لا أخطاء)
- [ ] `npm test` نجح (الاختبارات المتوفرة)
- [ ] الأمثلة تعمل
- [ ] Husky مُعد

---

## 🚀 الخطوات التالية

بعد إكمال التثبيت:

### للتطوير:

```bash
# وضع التطوير (watch mode)
npm run dev
```

### للاختبار:

```bash
# تشغيل الاختبارات
npm test

# watch mode
npm run test:watch
```

### للبناء:

```bash
# بناء production
npm run build
```

---

## 📦 Scripts المتوفرة

| Script                 | الوصف               |
| ---------------------- | ------------------- |
| `npm run dev`          | وضع التطوير (watch) |
| `npm run build`        | بناء المشروع        |
| `npm run clean`        | حذف dist/           |
| `npm test`             | تشغيل الاختبارات    |
| `npm run test:unit`    | Unit tests فقط      |
| `npm run test:watch`   | Watch mode          |
| `npm run lint`         | فحص الكود           |
| `npm run lint:fix`     | إصلاح تلقائي        |
| `npm run typecheck`    | تحقق من الأنواع     |
| `npm run format`       | تنسيق الكود         |
| `npm run format:check` | تحقق من التنسيق     |
| `npm run audit`        | فحص الأمان          |

---

## 🌐 Runtimes الأخرى

### Bun

```bash
# تثبيت dependencies
bun install

# بناء
bun run build

# تشغيل الاختبارات
bun test
```

### Deno

```typescript
// استيراد مباشر من npm
import { RDAPClient } from 'npm:rdapify@0.1.0-alpha.1';
```

### Cloudflare Workers

```bash
# تثبيت
npm install rdapify

# استخدام في worker
import { RDAPClient } from 'rdapify';
```

---

## 💡 نصائح

### 1. استخدم Node.js LTS

```bash
# تحقق من الإصدار
node --version

# يجب أن يكون 16.x أو 18.x أو 20.x
```

### 2. استخدم npm ci في CI/CD

```bash
# في CI/CD، استخدم ci بدلاً من install
npm ci
```

### 3. فعّل Corepack (اختياري)

```bash
# لدعم yarn و pnpm
corepack enable
```

### 4. استخدم .nvmrc

```bash
# إنشاء .nvmrc
echo "20" > .nvmrc

# استخدام nvm
nvm use
```

---

## 📞 الدعم

إذا واجهت مشاكل:

1. **تحقق من المتطلبات**: Node.js 16+, npm 7+
2. **راجع الأخطاء**: اقرأ رسائل الخطأ بعناية
3. **ابحث في Issues**: [GitHub Issues](https://github.com/rdapify/rdapify/issues)
4. **اطلب المساعدة**: [GitHub Discussions](https://github.com/rdapify/rdapify/discussions)
5. **راسلنا**: hello@rdapify.com

---

## ✅ الخلاصة

بعد إكمال هذه الخطوات، يجب أن يكون لديك:

- ✅ جميع dependencies مثبتة
- ✅ المشروع يبنى بنجاح
- ✅ الاختبارات تعمل
- ✅ الأمثلة تعمل
- ✅ جاهز للتطوير!

**مبروك! 🎉 أنت الآن جاهز لاستخدام RDAPify!**

---

**آخر تحديث**: 22 يناير 2025  
**الإصدار**: v0.1.0-alpha.1  
**الحالة**: Ready for Installation ✅
