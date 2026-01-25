# 🤖 دليل النشر التلقائي على npm

**التاريخ**: 25 يناير 2025  
**الحالة**: ✅ جاهز للنشر التلقائي

---

## ✅ ما تم إعداده

### 1. Workflow File ✅
- **الملف**: `.github/workflows/release.yml`
- **المحفز**: عند دفع tag بصيغة `v*.*.*`
- **الصلاحيات**: `id-token: write` (لـ Trusted Publisher)
- **Environment**: `npm-publish`

### 2. npm Trusted Publisher ✅
- **مضبوط على**: https://www.npmjs.com/package/rdapify/access
- **Repository**: `rdapify/RDAPify`
- **Workflow**: `release.yml`
- **Environment**: `npm-publish`

### 3. Build System ✅
- **الأمر**: `npm run build`
- **المخرجات**: `dist/` directory
- **TypeScript**: يتم تحويله إلى JavaScript

---

## 🚀 كيفية النشر التلقائي

### الطريقة 1: عبر npm version (موصى به) ⭐

```bash
cd ~/dev/rdapify/RDAPify

# إنشاء نسخة patch (0.1.0 → 0.1.1)
npm version patch

# أو نسخة minor (0.1.0 → 0.2.0)
npm version minor

# أو نسخة major (0.1.0 → 1.0.0)
npm version major

# دفع مع tags
git push --follow-tags
```

**ماذا سيحدث**:
1. ✅ `npm version` يحدث package.json
2. ✅ ينشئ commit تلقائياً
3. ✅ ينشئ tag (مثل v0.1.1)
4. ✅ `git push --follow-tags` يدفع الكود والـ tag
5. ✅ GitHub Actions يشتغل تلقائياً
6. ✅ ينشر على npm

---

### الطريقة 2: عبر GitHub Release

1. **اذهب إلى**: https://github.com/rdapify/RDAPify/releases/new

2. **اختر tag**: 
   - إذا موجود: اختر من القائمة
   - إذا جديد: اكتب `v0.1.1` واختر "Create new tag"

3. **املأ البيانات**:
   - **Title**: `v0.1.1 - Bug fixes and improvements`
   - **Description**: اكتب ملاحظات الإصدار

4. **انشر**: انقر "Publish release"

**ماذا سيحدث**:
1. ✅ GitHub Release ينشأ
2. ✅ Tag ينشأ تلقائياً
3. ✅ GitHub Actions يشتغل
4. ✅ ينشر على npm

---

## 📋 Workflow Steps

عند دفع tag، الـ workflow يقوم بـ:

### Job 1: Validate (التحقق)
1. ✅ Checkout الكود
2. ✅ Setup Node.js 20
3. ✅ تثبيت التبعيات (`npm ci`)
4. ✅ تشغيل الاختبارات (`npm test`)
5. ✅ تشغيل linter (`npm run lint`)
6. ✅ تشغيل type check (`npm run typecheck`)
7. ✅ فحص أمني (`npm audit`)
8. ✅ بناء الحزمة (`npm run build`)

### Job 2: Publish to NPM (النشر)
1. ✅ Checkout الكود
2. ✅ Setup Node.js 20 مع npm registry
3. ✅ تثبيت التبعيات
4. ✅ بناء الحزمة
5. ✅ النشر على npm مع provenance

### Job 3: Create GitHub Release (إنشاء Release)
1. ✅ استخراج رقم الإصدار من tag
2. ✅ استخراج ملاحظات من CHANGELOG.md
3. ✅ إنشاء GitHub Release تلقائياً

### Job 4: Notify (الإشعار)
1. ✅ طباعة رسالة نجاح

---

## 🧪 اختبار النشر التلقائي

### الخطوة 1: إنشاء نسخة patch

```bash
cd ~/dev/rdapify/RDAPify

# تحديث الإصدار
npm version patch -m "chore: bump version to %s"

# دفع
git push --follow-tags
```

### الخطوة 2: مراقبة Workflow

1. **اذهب إلى**: https://github.com/rdapify/RDAPify/actions
2. **ابحث عن**: Workflow "Release"
3. **راقب**: جميع الخطوات

**يجب أن ترى**:
- ✅ Validate Release (أخضر)
- ✅ Publish to NPM (أخضر)
- ✅ Create GitHub Release (أخضر)
- ✅ Notify Release (أخضر)

### الخطوة 3: التحقق من npm

```bash
# التحقق من الإصدار الجديد
npm view rdapify version

# التحقق من جميع البيانات
npm view rdapify

# يجب أن ترى:
# - version: 0.1.1 (الجديد)
# - repository: git+https://github.com/rdapify/RDAPify.git
# - homepage: https://rdapify.com
```

### الخطوة 4: التحقق من GitHub Release

1. **اذهب إلى**: https://github.com/rdapify/RDAPify/releases
2. **يجب أن ترى**: Release جديد (v0.1.1)
3. **مع**: ملاحظات من CHANGELOG.md

---

## 🔧 إعدادات package.json

تأكد من هذه الحقول في `package.json`:

```json
{
  "name": "rdapify",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist",
    "README.md",
    "LICENSE",
    "CHANGELOG.md"
  ],
  "scripts": {
    "build": "npm run clean && tsc",
    "clean": "rimraf dist",
    "test": "jest --runInBand",
    "lint": "eslint src --ext .ts,.tsx",
    "typecheck": "tsc --noEmit"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/rdapify/RDAPify.git"
  },
  "homepage": "https://rdapify.com",
  "bugs": {
    "url": "https://github.com/rdapify/RDAPify/issues"
  }
}
```

---

## 📝 CHANGELOG.md Format

لكي يعمل استخراج الملاحظات تلقائياً، استخدم هذا التنسيق:

```markdown
# Changelog

## [0.1.1] - 2025-01-25

### Fixed
- Fixed repository URL in package.json
- Fixed homepage URL

### Changed
- Updated documentation

## [0.1.0] - 2025-01-25

### Added
- Initial release
```

---

## 🆘 استكشاف الأخطاء

### Workflow فشل في "Validate"

**السبب**: الاختبارات أو linter فشل

**الحل**:
```bash
# تشغيل محلياً
npm test
npm run lint
npm run typecheck

# إصلاح المشاكل
npm run lint:fix

# commit و push
git add .
git commit -m "fix: resolve linting issues"
git push
```

---

### Workflow فشل في "Publish to NPM"

**الأسباب المحتملة**:

1. **Trusted Publisher غير مضبوط**
   - تحقق من: https://www.npmjs.com/package/rdapify/access
   - تأكد من الإعدادات صحيحة

2. **الإصدار موجود بالفعل**
   - لا يمكن نشر نفس الإصدار مرتين
   - أنشئ إصدار جديد: `npm version patch`

3. **Environment "npm-publish" غير موجود**
   - اذهب إلى: https://github.com/rdapify/RDAPify/settings/environments
   - أنشئ environment اسمه `npm-publish`

---

### الإصدار نُشر لكن البيانات خاطئة

**السبب**: package.json يحتوي بيانات قديمة

**الحل**:
```bash
# تحديث package.json
# تأكد من repository, homepage, bugs صحيحة

# إنشاء إصدار جديد
npm version patch

# دفع
git push --follow-tags
```

---

### GitHub Release لم ينشأ

**السبب**: CHANGELOG.md لا يحتوي على الإصدار

**الحل**:
```bash
# تحديث CHANGELOG.md
# أضف قسم للإصدار الجديد:

## [0.1.1] - 2025-01-25
### Fixed
- Bug fixes

# commit و push
git add CHANGELOG.md
git commit -m "docs: update changelog for v0.1.1"
git push
```

---

## ✅ قائمة التحقق قبل النشر

### قبل `npm version`:
- [ ] جميع التغييرات committed
- [ ] الاختبارات تعمل (`npm test`)
- [ ] Linter نظيف (`npm run lint`)
- [ ] Type check نظيف (`npm run typecheck`)
- [ ] Build ينجح (`npm run build`)
- [ ] CHANGELOG.md محدث

### بعد `npm version`:
- [ ] package.json محدث
- [ ] Tag تم إنشاؤه
- [ ] Commit تم إنشاؤه

### بعد `git push --follow-tags`:
- [ ] Workflow اشتغل
- [ ] جميع Jobs نجحت
- [ ] npm محدث
- [ ] GitHub Release تم إنشاؤه

---

## 🎯 الخطوة التالية الفورية

**جرب النشر التلقائي الآن**:

```bash
cd ~/dev/rdapify/RDAPify

# إنشاء نسخة patch
npm version patch -m "chore: bump version to %s"

# دفع
git push --follow-tags

# راقب
# https://github.com/rdapify/RDAPify/actions
```

**بعد النجاح**:
```bash
# تحقق
npm view rdapify version
npm view rdapify repository homepage
```

---

## 📞 الدعم

- **Workflow Issues**: https://github.com/rdapify/RDAPify/actions
- **npm Issues**: https://www.npmjs.com/support
- **Email**: admin@rdapify.com

---

**مبروك! النشر التلقائي جاهز! 🎉**
