# 🔧 دليل إعداد Codecov

## المشكلة

تظهر رسالة الخطأ التالية في GitHub Actions:

```
Codecov: Failed to properly upload report: 
The process '/home/runner/work/_actions/codecov/codecov-action/v4/dist/codecov' 
failed with exit code 1
```

**السبب:** Codecov يحتاج إلى token للمصادقة ورفع تقارير التغطية.

**الحالة الحالية:** ⚠️ التحذير لا يوقف CI (بسبب `fail_ci_if_error: false`)

---

## ✅ الحل 1: إضافة CODECOV_TOKEN (موصى به)

### الخطوة 1: الحصول على Token

1. اذهب إلى https://codecov.io/
2. سجل دخول بحساب GitHub
3. أضف المستودع `rdapify/RDAPify`
4. انسخ الـ `CODECOV_TOKEN`

### الخطوة 2: إضافة Token إلى GitHub Secrets

1. اذهب إلى: https://github.com/rdapify/RDAPify/settings/secrets/actions
2. اضغط "New repository secret"
3. الاسم: `CODECOV_TOKEN`
4. القيمة: الصق الـ token من Codecov
5. اضغط "Add secret"

### الخطوة 3: تحديث CI Workflow

الكود الحالي يحتاج تعديل بسيط:

```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    token: ${{ secrets.CODECOV_TOKEN }}  # ✅ إضافة هذا السطر
    files: ./coverage/lcov.info
    flags: unittests
    name: codecov-umbrella
    fail_ci_if_error: false
  continue-on-error: true
```

---

## ✅ الحل 2: إزالة Codecov (إذا لم تحتاجه)

إذا كنت لا تستخدم Codecov، يمكنك إزالة الخطوة كاملة:

```yaml
# احذف هذه الخطوة من ci.yml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage/lcov.info
    flags: unittests
    name: codecov-umbrella
    fail_ci_if_error: false
  continue-on-error: true
```

---

## ✅ الحل 3: استخدام GitHub Token (بديل)

Codecov v4 يدعم استخدام GitHub token بدلاً من Codecov token:

```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    token: ${{ secrets.GITHUB_TOKEN }}  # استخدام GitHub token
    files: ./coverage/lcov.info
    flags: unittests
    name: codecov-umbrella
    fail_ci_if_error: false
  continue-on-error: true
```

**ملاحظة:** هذا قد لا يعمل مع جميع المستودعات، الحل 1 أفضل.

---

## 🔍 التحقق

بعد تطبيق أي حل:

1. عمل push جديد
2. راقب GitHub Actions
3. تأكد من اختفاء التحذير
4. (للحل 1) تحقق من تقرير التغطية على https://codecov.io/gh/rdapify/RDAPify

---

## 📊 مقارنة الحلول

| الحل | الوقت | الفائدة | التوصية |
|------|-------|---------|----------|
| **1. إضافة Token** | 5 دقائق | تقارير تغطية كاملة | ⭐⭐⭐ موصى به |
| **2. إزالة Codecov** | 1 دقيقة | لا تحذيرات | ⭐⭐ إذا لم تحتاجه |
| **3. GitHub Token** | 2 دقيقة | قد يعمل | ⭐ بديل |

---

## 💡 ملاحظات

### لماذا لا يوقف CI؟

```yaml
fail_ci_if_error: false  # لا توقف CI إذا فشل
continue-on-error: true  # استمر حتى لو فشلت الخطوة
```

هذا تصميم جيد! يعني:
- ✅ CI يكمل حتى لو فشل Codecov
- ✅ Tests تعمل بشكل طبيعي
- ⚠️ فقط تحذير (لا خطأ)

### هل يجب إصلاحه؟

**اختياري** - لكن موصى به إذا كنت تريد:
- 📊 تقارير تغطية الاختبارات
- 📈 تتبع التغطية عبر الوقت
- 🎯 Badge للتغطية في README

---

## 🚀 التطبيق السريع

### إذا اخترت الحل 1 (موصى به):

```bash
# 1. احصل على token من codecov.io
# 2. أضفه إلى GitHub Secrets
# 3. حدّث ci.yml

# تطبيق التحديث:
git checkout fix/docs-build-issues
# عدّل .github/workflows/ci.yml (أضف token: ${{ secrets.CODECOV_TOKEN }})
git add .github/workflows/ci.yml
git commit -m "ci: add Codecov token to fix upload warning"
git push
```

### إذا اخترت الحل 2 (إزالة):

```bash
git checkout fix/docs-build-issues
# احذف خطوة Codecov من ci.yml
git add .github/workflows/ci.yml
git commit -m "ci: remove Codecov upload step"
git push
```

---

## 📚 موارد إضافية

- [Codecov Documentation](https://docs.codecov.com/)
- [codecov-action GitHub](https://github.com/codecov/codecov-action)
- [GitHub Secrets Guide](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

---

**تم إنشاء الدليل بواسطة:** Kiro AI DevOps Assistant  
**التاريخ:** 25 يناير 2026  
**الحالة:** ✅ جاهز للتطبيق
