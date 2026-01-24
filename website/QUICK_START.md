# Quick Start - البدء السريع

## ✅ تم تثبيت Dependencies

الآن يمكنك:

## 1️⃣ تشغيل الموقع محلياً

```bash
npm start
```

سيفتح على: http://localhost:3000

**ماذا ستشاهد:**
- ✅ الصفحة الرئيسية
- ✅ 6 ميزات رئيسية
- ✅ أزرار Get Started و Playground
- ✅ شارات npm/GitHub

**للإيقاف:** `Ctrl+C`

---

## 2️⃣ بناء للإنتاج

```bash
npm run build
```

**النتيجة:**
- مجلد `build/` يحتوي على الملفات الثابتة
- جاهز للنشر

**اختبار البناء:**
```bash
npm run serve
```

---

## 3️⃣ النشر على GitHub

```bash
# من المجلد الرئيسي
cd ..
git add .
git commit -m "chore: install website dependencies"
git push origin main
```

**سيحدث تلقائياً:**
1. GitHub Actions يبني الموقع
2. ينشر على rdapify.github.io
3. يصبح متاحاً على rdapify.com

---

## 🐛 استكشاف الأخطاء

### المشكلة: Port 3000 مستخدم

```bash
# استخدم port آخر
npm start -- --port 3001
```

### المشكلة: Build يفشل

```bash
# امسح cache
npm run clear
npm run build
```

### المشكلة: Dependencies قديمة

```bash
npm update
```

---

## 📚 الأوامر المتاحة

| الأمر | الوصف |
|-------|-------|
| `npm start` | تشغيل dev server |
| `npm run build` | بناء للإنتاج |
| `npm run serve` | اختبار البناء |
| `npm run clear` | مسح cache |
| `npm run swizzle` | تخصيص components |

---

## 🎯 الخطوة التالية

**اختر واحدة:**

### للتطوير:
```bash
npm start
```

### للنشر:
```bash
cd ..
git push origin main
```

---

## 📖 المزيد من المعلومات

- [README.md](README.md) - دليل التطوير الكامل
- [DEPLOYMENT.md](DEPLOYMENT.md) - دليل النشر
- [../NEXT_STEPS.md](../NEXT_STEPS.md) - الخطوات التالية

---

**الحالة الحالية:** ✅ جاهز للاستخدام
