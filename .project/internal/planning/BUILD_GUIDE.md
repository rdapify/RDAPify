# 🔨 RDAPify - دليل البناء

**التاريخ**: 22 يناير 2025  
**الإصدار**: v0.1.0-alpha.1

---

## 🎯 نظرة عامة

هذا الدليل يشرح كيفية بناء RDAPify من الكود المصدري.

---

## 📋 المتطلبات

- ✅ Node.js 16+ مثبت
- ✅ npm 7+ مثبت
- ✅ Dependencies مثبتة (`npm install`)

---

## 🔨 عملية البناء

### البناء الكامل

```bash
npm run build
```

**ما يحدث**:

1. `npm run clean` - حذف `dist/` القديم
2. `npm run build:types` - توليد type definitions
3. `npm run build:cjs` - بناء CommonJS
4. `npm run build:esm` - بناء ES Modules

**الوقت المتوقع**: 10-15 ثانية

---

## 📁 هيكل الناتج

بعد البناء، سيكون لديك:

```
dist/
├── index.js              # CommonJS entry point
├── index.mjs             # ES Module entry point
├── index.d.ts            # Type definitions
├── client/
│   ├── RDAPClient.js
│   ├── RDAPClient.mjs
│   └── RDAPClient.d.ts
├── fetcher/
│   ├── Fetcher.js
│   ├── Fetcher.mjs
│   ├── Fetcher.d.ts
│   ├── SSRFProtection.js
│   ├── SSRFProtection.mjs
│   ├── SSRFProtection.d.ts
│   ├── BootstrapDiscovery.js
│   ├── BootstrapDiscovery.mjs
│   └── BootstrapDiscovery.d.ts
├── normalizer/
│   ├── Normalizer.js
│   ├── Normalizer.mjs
│   ├── Normalizer.d.ts
│   ├── PIIRedactor.js
│   ├── PIIRedactor.mjs
│   └── PIIRedactor.d.ts
├── cache/
│   ├── CacheManager.js
│   ├── CacheManager.mjs
│   ├── CacheManager.d.ts
│   ├── InMemoryCache.js
│   ├── InMemoryCache.mjs
│   └── InMemoryCache.d.ts
├── types/
│   ├── index.js
│   ├── index.mjs
│   ├── index.d.ts
│   ├── options.js
│   ├── options.mjs
│   ├── options.d.ts
│   ├── errors.js
│   ├── errors.mjs
│   └── errors.d.ts
└── utils/
    ├── validators.js
    ├── validators.mjs
    ├── validators.d.ts
    ├── helpers.js
    ├── helpers.mjs
    └── helpers.d.ts
```

---

## 🔍 خطوات البناء التفصيلية

### 1. Clean (التنظيف)

```bash
npm run clean
```

**ما يحدث**:

- حذف مجلد `dist/` بالكامل
- استخدام `rimraf` للتوافق عبر الأنظمة

**متى تستخدمه**:

- قبل كل بناء جديد
- عند حدوث مشاكل في البناء
- عند تغيير tsconfig.json

---

### 2. Build Types (توليد التعريفات)

```bash
npm run build:types
```

**ما يحدث**:

- تشغيل `tsc --emitDeclarationOnly`
- توليد `.d.ts` files فقط
- لا يولد `.js` files

**الناتج**:

```
dist/
├── index.d.ts
├── client/
│   └── RDAPClient.d.ts
├── fetcher/
│   ├── Fetcher.d.ts
│   ├── SSRFProtection.d.ts
│   └── BootstrapDiscovery.d.ts
└── ...
```

---

### 3. Build CommonJS

```bash
npm run build:cjs
```

**ما يحدث**:

- تشغيل `tsc --module commonjs`
- توليد `.js` files بصيغة CommonJS
- للاستخدام مع `require()`

**الناتج**:

```javascript
// dist/index.js
'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.RDAPClient = void 0;
// ...
```

---

### 4. Build ES Modules

```bash
npm run build:esm
```

**ما يحدث**:

- تشغيل `tsc --module esnext`
- توليد `.mjs` files بصيغة ES Modules
- للاستخدام مع `import`

**الناتج**:

```javascript
// dist/index.mjs
export { RDAPClient } from './client/RDAPClient.mjs';
// ...
```

---

## ✅ التحقق من البناء

### 1. تحقق من وجود الملفات

```bash
# Windows
dir dist

# Linux/Mac
ls -la dist/
```

**يجب أن ترى**:

- `index.js`, `index.mjs`, `index.d.ts`
- جميع المجلدات الفرعية

---

### 2. تحقق من صحة الأنواع

```bash
npm run typecheck
```

**النتيجة المتوقعة**: لا أخطاء

---

### 3. اختبر الاستيراد

```javascript
// test-import.js
const { RDAPClient } = require('./dist/index.js');
console.log('CommonJS import:', typeof RDAPClient);
```

```javascript
// test-import.mjs
import { RDAPClient } from './dist/index.mjs';
console.log('ES Module import:', typeof RDAPClient);
```

```bash
node test-import.js
node test-import.mjs
```

---

## 🔧 إعدادات البناء

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**الإعدادات المهمة**:

- `strict: true` - TypeScript strict mode
- `declaration: true` - توليد `.d.ts`
- `sourceMap: true` - توليد source maps
- `target: ES2020` - JavaScript target

---

## 🐛 استكشاف الأخطاء

### مشكلة: Build فشل

**الأعراض**:

```
error TS2307: Cannot find module
```

**الحل**:

```bash
# تحقق من imports
npm run typecheck

# تأكد من وجود جميع الملفات
ls -la src/
```

---

### مشكلة: Type errors

**الأعراض**:

```
error TS2322: Type 'X' is not assignable to type 'Y'
```

**الحل**:

```bash
# تحقق من الأنواع
npm run typecheck

# راجع الكود المصدري
```

---

### مشكلة: dist/ فارغ

**الأعراض**:

- `dist/` موجود لكن فارغ
- لا توجد `.js` files

**الحل**:

```bash
# نظف وأعد البناء
npm run clean
npm run build

# تحقق من tsconfig.json
cat tsconfig.json
```

---

### مشكلة: Module resolution errors

**الأعراض**:

```
Cannot find module './client/RDAPClient'
```

**الحل**:

```bash
# تحقق من exports في package.json
cat package.json | grep exports

# تحقق من الملفات
ls -la dist/
```

---

## 📊 Build Performance

### قياس وقت البناء

```bash
# Linux/Mac
time npm run build

# Windows (PowerShell)
Measure-Command { npm run build }
```

**الأوقات المتوقعة**:

- Clean: < 1 ثانية
- Build Types: 2-3 ثواني
- Build CJS: 2-3 ثواني
- Build ESM: 2-3 ثواني
- **المجموع**: 10-15 ثانية

---

### تحسين البناء

**للبناء الأسرع**:

```bash
# بناء بدون source maps
tsc --sourceMap false

# بناء بدون declaration maps
tsc --declarationMap false
```

**للبناء الإضافي (incremental)**:

```json
// tsconfig.json
{
  "compilerOptions": {
    "incremental": true
  }
}
```

---

## 🚀 البناء للإنتاج

### Checklist البناء للإنتاج

- [ ] `npm run clean` - تنظيف
- [ ] `npm run typecheck` - لا أخطاء
- [ ] `npm run lint` - لا تحذيرات
- [ ] `npm test` - جميع الاختبارات تمر
- [ ] `npm run build` - بناء ناجح
- [ ] اختبار الاستيراد - يعمل
- [ ] اختبار الأمثلة - تعمل

---

### البناء التلقائي (CI/CD)

```yaml
# .github/workflows/build.yml
- name: Build
  run: |
    npm ci
    npm run build
    npm run typecheck
```

---

## 📦 التحضير للنشر

### قبل النشر على npm

```bash
# 1. بناء نظيف
npm run clean
npm run build

# 2. تحقق من الملفات
npm pack --dry-run

# 3. تحقق من الحجم
du -sh dist/

# 4. اختبار محلي
npm link
cd ../test-project
npm link rdapify
```

---

## 💡 نصائح

### 1. استخدم Watch Mode للتطوير

```bash
npm run dev
```

هذا أسرع من البناء الكامل في كل مرة.

---

### 2. بناء جزئي

```bash
# بناء types فقط
npm run build:types

# بناء CJS فقط
npm run build:cjs
```

---

### 3. تنظيف دوري

```bash
# نظف قبل كل بناء مهم
npm run clean && npm run build
```

---

## 📞 الدعم

إذا واجهت مشاكل في البناء:

1. **تحقق من المتطلبات**: Node.js 16+, TypeScript 5+
2. **نظف وأعد البناء**: `npm run clean && npm run build`
3. **راجع الأخطاء**: اقرأ رسائل TypeScript بعناية
4. **ابحث في Issues**: [GitHub Issues](https://github.com/rdapify/rdapify/issues)

---

**آخر تحديث**: 22 يناير 2025  
**الحالة**: Build System Ready ✅
