# 🚀 دليل إنشاء GitHub Release ونشر npm

**التاريخ**: 25 يناير 2025  
**الحالة**: Tags موجودة - Release غير منشور بعد

---

## 📊 الوضع الحالي

### ✅ ما هو موجود:

**Tags على GitHub** (4 tags):
- `v0.1.0` ✅ (الإصدار المستقر)
- `v0.1.0-alpha.4`
- `v0.1.0-alpha.3`
- `v0.1.0-alpha.2`

**Workflow Files**:
- ✅ `.github/workflows/release.yml` - مضبوط ومعد بشكل صحيح
- ✅ يدعم npm Trusted Publisher (provenance)
- ✅ ينشئ GitHub Release تلقائياً

### ❌ ما هو مفقود:

- ❌ GitHub Release غير منشور (فقط Tags موجودة)
- ❌ الحزمة غير منشورة على npm بعد
- ⚠️ قد يكون `NPM_TOKEN` غير مضبوط في Secrets

---

## 🔍 كيف تتحقق من وجود Release؟

### الطريقة 1: من واجهة GitHub (الأسهل)

1. اذهب إلى: https://github.com/rdapify/RDAPify
2. انظر في الشريط الجانبي الأيمن → **"Releases"**
3. انقر على **"Releases"**

**إذا رأيت**:
- ✅ قائمة بالإصدارات (مثل v0.1.0 مع ملاحظات) → **عندك Releases منشورة**
- ❌ صفحة فارغة مع زر "Create a new release" فقط → **ما عندك Releases (فقط Tags)**

### الطريقة 2: من سطر الأوامر (إذا عندك gh CLI)

```bash
# تثبيت gh CLI (إذا لم يكن مثبت)
# Ubuntu/Debian:
sudo apt install gh

# بعد التثبيت:
cd ~/dev/rdapify/RDAPify

# عرض جميع الإصدارات
gh release list

# عرض إصدار محدد
gh release view v0.1.0
```

---

## 📝 الفرق بين Tag و Release

| الميزة | Git Tag | GitHub Release |
|--------|---------|----------------|
| **التعريف** | مرجع Git يشير لـ commit محدد | واجهة GitHub مبنية فوق Tag |
| **الملاحظات** | لا يوجد | يمكن إضافة Release Notes |
| **الملفات** | لا يوجد | يمكن رفع ملفات (binaries, assets) |
| **الإشعارات** | لا يوجد | يرسل إشعارات للمتابعين |
| **الظهور** | في قائمة Tags فقط | في صفحة Releases + RSS feed |
| **التنزيل** | Source code فقط | Source code + ملفات إضافية |

**الخلاصة**: Tag موجود في Git، Release موجود في GitHub UI.

---

## 🎯 خياران للنشر

### الخيار 1: إنشاء Release يدوياً (موصى به للمرة الأولى) ⭐

هذا الخيار يتيح لك التحكم الكامل والتحقق من كل شيء.

#### الخطوات:

**1. اذهب إلى صفحة Releases**

https://github.com/rdapify/RDAPify/releases/new

**2. اختر Tag**

في حقل **"Choose a tag"**:
- اختر `v0.1.0` من القائمة المنسدلة
- أو اكتب `v0.1.0` (سيظهر لك "Excellent! This tag already exists")

**3. اختر Target**

- **Target**: `main` (يجب أن يكون محدد تلقائياً)

**4. اكتب Release Title**

```
v0.1.0 - First Public Release
```

**5. اكتب Release Description**

انسخ والصق هذا:

```markdown
# 🎉 RDAPify v0.1.0 - First Public Release

We're excited to announce the first stable release of **RDAPify** - a unified, secure, high-performance RDAP client for enterprise applications with built-in privacy controls.

## 🚀 What is RDAPify?

RDAPify is a modern TypeScript library that provides a simple, secure way to query domain, IP, and ASN registration data using the RDAP protocol (the modern replacement for WHOIS).

## ✨ Key Features

- **🔍 Universal Queries**: Domain, IPv4, IPv6, and ASN lookups
- **🛡️ Security First**: SSRF protection, certificate validation, input sanitization
- **🔒 Privacy Built-in**: GDPR/CCPA compliant PII redaction
- **⚡ High Performance**: In-memory caching with configurable TTL
- **🎯 Type-Safe**: Full TypeScript support with comprehensive types
- **🌐 Auto-Discovery**: Automatic RDAP server discovery via IANA Bootstrap
- **📦 Zero Config**: Works out of the box with sensible defaults

## 📦 Installation

```bash
npm install rdapify
```

## 🎯 Quick Start

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

// Query a domain
const domain = await client.queryDomain('example.com');
console.log(domain.handle, domain.status);

// Query an IP address
const ip = await client.queryIP('8.8.8.8');
console.log(ip.handle, ip.country);

// Query an ASN
const asn = await client.queryASN(15169);
console.log(asn.handle, asn.name);
```

## 📚 Documentation

- **Website**: https://rdapify.com
- **Documentation**: https://rdapify.com/docs.html
- **API Reference**: https://github.com/rdapify/RDAPify/tree/main/docs/api_reference
- **Getting Started**: https://github.com/rdapify/RDAPify/tree/main/docs/getting_started
- **Examples**: https://github.com/rdapify/RDAPify/tree/main/examples

## 🔒 Security

- SSRF protection blocks private IPs and internal domains
- Certificate validation enforced (HTTPS only)
- Input validation prevents injection attacks
- Automated security scanning with CodeQL
- Report vulnerabilities to: security@rdapify.com

## 🧪 Testing

- 146+ unit and integration tests
- Mocked fixtures for reliable testing
- Coverage reporting included

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](https://github.com/rdapify/RDAPify/blob/main/CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](https://github.com/rdapify/RDAPify/blob/main/LICENSE)

## 🙏 Acknowledgments

Thanks to all contributors and the RDAP community for making this possible!

---

**Full Changelog**: https://github.com/rdapify/RDAPify/blob/main/CHANGELOG.md

**npm Package**: https://www.npmjs.com/package/rdapify (coming soon)
```

**6. خيارات إضافية**

- ✅ **"Set as the latest release"** - فعّل هذا الخيار
- ❌ **"Set as a pre-release"** - لا تفعّل (لأنه إصدار مستقر)
- ❌ **"Create a discussion for this release"** - اختياري (يمكنك تفعيله)

**7. انشر Release**

انقر **"Publish release"** 🚀

---

### الخيار 2: تشغيل Workflow يدوياً (بعد إعداد npm)

هذا الخيار يستخدم GitHub Actions لإنشاء Release تلقائياً.

#### المتطلبات:

1. ✅ Tag موجود (v0.1.0) - **موجود**
2. ⚠️ npm Trusted Publisher مضبوط - **يحتاج إعداد**
3. ⚠️ أو NPM_TOKEN في Secrets - **يحتاج إعداد**

#### الخطوات:

**1. إعداد npm Trusted Publisher (موصى به)**

اذهب إلى: https://www.npmjs.com/package/rdapify/access

املأ النموذج:
```
Publisher: GitHub Actions
Organization or user: rdapify
Repository: RDAPify
Workflow filename: release.yml
Environment name: npm-publish
```

انقر **"Set up connection"**

**2. تشغيل Workflow**

اذهب إلى: https://github.com/rdapify/RDAPify/actions/workflows/release.yml

انقر **"Run workflow"**:
- **Branch**: `main`
- انقر **"Run workflow"**

الـ workflow سيقوم بـ:
1. ✅ التحقق من الكود (tests, lint, typecheck)
2. ✅ النشر على npm
3. ✅ إنشاء GitHub Release تلقائياً

---

## 🔐 إعداد npm Publishing

### الطريقة 1: npm Trusted Publisher (موصى به) ⭐

**المميزات**:
- ✅ لا يحتاج تخزين tokens
- ✅ أكثر أماناً (OIDC)
- ✅ يضيف provenance badge تلقائياً

**الخطوات**:

1. **تسجيل الدخول إلى npm**
   - اذهب إلى: https://www.npmjs.com/login

2. **افتح إعدادات الحزمة**
   - اذهب إلى: https://www.npmjs.com/package/rdapify/access
   - (إذا لم تكن الحزمة موجودة بعد، انشرها يدوياً أولاً)

3. **أضف Trusted Publisher**
   
   في قسم **"Trusted Publishers"**:
   ```
   Publisher: GitHub Actions
   Organization or user: rdapify
   Repository: RDAPify
   Workflow filename: release.yml
   Environment name: npm-publish
   ```

4. **احفظ الإعدادات**
   
   انقر **"Set up connection"**

**ملاحظة مهمة**: اسم الـ workflow يجب أن يطابق بالضبط: `release.yml`

---

### الطريقة 2: NPM_TOKEN (بديل)

إذا لم تستطع استخدام Trusted Publisher:

**الخطوات**:

1. **إنشاء npm token**
   
   ```bash
   npm login
   npm token create --type=automation
   ```
   
   انسخ الـ token (يبدأ بـ `npm_...`)

2. **إضافة Token إلى GitHub Secrets**
   
   - اذهب إلى: https://github.com/rdapify/RDAPify/settings/secrets/actions
   - انقر **"New repository secret"**
   - **Name**: `NPM_TOKEN`
   - **Value**: الصق الـ token
   - انقر **"Add secret"**

3. **تحديث workflow** (إذا لزم الأمر)
   
   الـ workflow الحالي يستخدم `NPM_TOKEN` بالفعل، لذا لا حاجة لتغيير.

---

## 📋 خطة العمل الموصى بها

### المرحلة 1: إنشاء Release يدوياً (الآن) ⭐

1. [ ] اذهب إلى: https://github.com/rdapify/RDAPify/releases/new
2. [ ] اختر tag: `v0.1.0`
3. [ ] اكتب العنوان: `v0.1.0 - First Public Release`
4. [ ] الصق الوصف (من الأعلى)
5. [ ] فعّل "Set as the latest release"
6. [ ] انقر "Publish release"

**لماذا يدوياً أولاً؟**
- تتحكم في المحتوى بالكامل
- تتحقق من كل شيء قبل النشر
- لا تحتاج إعداد npm الآن

---

### المرحلة 2: النشر على npm يدوياً (بعد Release)

بعد إنشاء GitHub Release:

```bash
cd ~/dev/rdapify/RDAPify

# تسجيل الدخول (مرة واحدة فقط)
npm login

# التحقق من البناء
npm run build

# النشر
npm publish --access public

# التحقق
npm view rdapify
```

---

### المرحلة 3: إعداد Trusted Publisher (للمستقبل)

بعد النشر اليدوي الأول:

1. [ ] اذهب إلى: https://www.npmjs.com/package/rdapify/access
2. [ ] أضف Trusted Publisher (الإعدادات أعلاه)
3. [ ] اختبر بإنشاء tag جديد (مثل v0.1.1)

---

## ✅ قائمة التحقق النهائية

### قبل إنشاء Release:
- [x] Tag v0.1.0 موجود على GitHub
- [x] CHANGELOG.md محدث
- [x] README.md محدث
- [x] جميع الاختبارات تعمل
- [x] الموقع محدث (rdapify.com)

### بعد إنشاء Release:
- [ ] Release منشور على GitHub
- [ ] Release notes واضحة وشاملة
- [ ] Release مثبت كـ "latest"
- [ ] الإشعارات أرسلت للمتابعين

### النشر على npm:
- [ ] تسجيل الدخول إلى npm
- [ ] النشر بنجاح
- [ ] التحقق من الحزمة على npm
- [ ] Provenance badge يظهر (إذا استخدمت Trusted Publisher)

---

## 🔗 روابط مهمة

### GitHub
- **Releases**: https://github.com/rdapify/RDAPify/releases
- **New Release**: https://github.com/rdapify/RDAPify/releases/new
- **Actions**: https://github.com/rdapify/RDAPify/actions
- **Secrets**: https://github.com/rdapify/RDAPify/settings/secrets/actions

### npm
- **Package**: https://www.npmjs.com/package/rdapify
- **Access Settings**: https://www.npmjs.com/package/rdapify/access
- **Login**: https://www.npmjs.com/login

### التوثيق
- **GitHub Releases**: https://docs.github.com/en/repositories/releasing-projects-on-github
- **npm Trusted Publishers**: https://docs.npmjs.com/generating-provenance-statements
- **npm Tokens**: https://docs.npmjs.com/creating-and-viewing-access-tokens

---

## 🆘 استكشاف الأخطاء

### "Tag already exists"
- ✅ هذا طبيعي! اختر Tag الموجود من القائمة

### "Workflow failed"
- تحقق من Logs في Actions
- تأكد من npm token صحيح
- تأكد من جميع الاختبارات تعمل

### "npm publish failed"
- تحقق من تسجيل الدخول: `npm whoami`
- تحقق من الصلاحيات على الحزمة
- تحقق من اسم الحزمة غير محجوز

---

## 📞 الدعم

- **Issues**: https://github.com/rdapify/RDAPify/issues
- **Email**: admin@rdapify.com

---

**ابدأ الآن بالمرحلة 1: إنشاء GitHub Release! 🚀**
