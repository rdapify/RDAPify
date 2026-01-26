# 🔐 دليل إعداد DEPLOY_TOKEN للنشر التلقائي

## 📊 المشكلة

تظهر رسالة الخطأ في GitHub Actions:

```
Error: Action failed with "not found deploy key or tokens"
```

**السبب:** الـ workflow يحاول النشر إلى مستودع خارجي (`rdapify/rdapify.github.io`) لكن لا يوجد `DEPLOY_TOKEN`.

**الحالة:** ❌ النشر التلقائي لا يعمل

---

## ✅ الحل: إنشاء وإضافة Personal Access Token

### الخطوة 1: إنشاء Personal Access Token

1. اذهب إلى: https://github.com/settings/tokens
2. اضغط **"Generate new token"** → **"Generate new token (classic)"**
3. املأ البيانات:
   - **Note:** `RDAPify Deploy Token`
   - **Expiration:** `No expiration` (أو حسب سياستك)
   - **Scopes:** اختر:
     - ✅ `repo` (Full control of private repositories)
     - ✅ `workflow` (Update GitHub Action workflows)

4. اضغط **"Generate token"**
5. **انسخ الـ token فوراً** (لن تراه مرة أخرى!)

---

### الخطوة 2: إضافة Token إلى GitHub Secrets

#### للمستودع الرئيسي (RDAPify):

1. اذهب إلى: https://github.com/rdapify/RDAPify/settings/secrets/actions
2. اضغط **"New repository secret"**
3. املأ:
   - **Name:** `DEPLOY_TOKEN`
   - **Secret:** الصق الـ token
4. اضغط **"Add secret"**

---

### الخطوة 3: التحقق

بعد إضافة الـ token:

1. عمل push جديد إلى `main` (أو تعديل في `website/` أو `docs/`)
2. راقب GitHub Actions: https://github.com/rdapify/RDAPify/actions
3. تأكد من نجاح الـ deployment ✅
4. تحقق من الموقع: https://rdapify.com

---

## 🔄 بدائل

### البديل 1: استخدام Deploy Key (أكثر أماناً)

بدلاً من Personal Access Token، يمكنك استخدام Deploy Key:

#### 1. إنشاء SSH Key:

```bash
ssh-keygen -t ed25519 -C "rdapify-deploy" -f ~/.ssh/rdapify-deploy
# لا تضع passphrase (اضغط Enter)
```

#### 2. إضافة Public Key إلى المستودع الهدف:

1. اذهب إلى: https://github.com/rdapify/rdapify.github.io/settings/keys
2. اضغط **"Add deploy key"**
3. **Title:** `RDAPify Deploy Key`
4. **Key:** الصق محتوى `~/.ssh/rdapify-deploy.pub`
5. ✅ اختر **"Allow write access"**
6. اضغط **"Add key"**

#### 3. إضافة Private Key إلى Secrets:

1. اذهب إلى: https://github.com/rdapify/RDAPify/settings/secrets/actions
2. اضغط **"New repository secret"**
3. **Name:** `DEPLOY_KEY`
4. **Secret:** الصق محتوى `~/.ssh/rdapify-deploy` (المفتاح الخاص)
5. اضغط **"Add secret"**

#### 4. تحديث الـ workflow:

```yaml
- name: Deploy to GitHub Pages
  uses: peaceiris/actions-gh-pages@v4
  with:
    deploy_key: ${{ secrets.DEPLOY_KEY }}  # بدلاً من personal_token
    external_repository: rdapify/rdapify.github.io
    publish_branch: main
    publish_dir: ./website/build
    cname: rdapify.com
    user_name: 'github-actions[bot]'
    user_email: 'github-actions[bot]@users.noreply.github.com'
    commit_message: 'docs: deploy website from rdapify/RDAPify@${{ github.sha }}'
```

---

### البديل 2: النشر إلى نفس المستودع (أبسط)

إذا كنت تريد نشر الموقع من نفس المستودع بدلاً من مستودع خارجي:

```yaml
- name: Deploy to GitHub Pages
  uses: peaceiris/actions-gh-pages@v4
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}  # متوفر تلقائياً
    publish_branch: gh-pages
    publish_dir: ./website/build
    cname: rdapify.com
    user_name: 'github-actions[bot]'
    user_email: 'github-actions[bot]@users.noreply.github.com'
    commit_message: 'docs: deploy website from commit ${{ github.sha }}'
```

**ملاحظة:** ستحتاج تفعيل GitHub Pages من Settings → Pages → Source: `gh-pages` branch

---

### البديل 3: تعطيل النشر التلقائي مؤقتاً

إذا كنت لا تحتاج النشر التلقائي الآن:

```yaml
# أضف هذا الشرط للـ deploy job
jobs:
  deploy:
    name: Deploy to GitHub Pages
    runs-on: ubuntu-latest
    if: false  # تعطيل مؤقت
    steps:
      # ...
```

أو احذف الـ workflow كاملاً مؤقتاً.

---

## 📊 مقارنة الحلول

| الحل | الأمان | السهولة | التوصية |
|------|--------|---------|----------|
| **Personal Access Token** | ⭐⭐ | ⭐⭐⭐ | ✅ سريع وسهل |
| **Deploy Key** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ الأفضل أماناً |
| **نفس المستودع** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ إذا لم تحتاج مستودع منفصل |
| **تعطيل مؤقت** | - | ⭐⭐⭐ | ⭐ حل مؤقت |

---

## 💡 ملاحظات مهمة

### لماذا مستودع خارجي؟

الإعداد الحالي ينشر إلى `rdapify/rdapify.github.io` لأن:
- ✅ يسمح باستخدام domain مخصص (`rdapify.com`)
- ✅ يفصل الكود عن الموقع المنشور
- ✅ يحافظ على نظافة المستودع الرئيسي

### متى يعمل النشر؟

الـ workflow يعمل عند:
- ✅ Push إلى `main` branch
- ✅ تغييرات في `website/**`
- ✅ تغييرات في `docs/**`
- ✅ تغييرات في `.github/workflows/deploy-website.yml`
- ✅ تشغيل يدوي (workflow_dispatch)

### الصلاحيات المطلوبة

Personal Access Token يحتاج:
- ✅ `repo` - للوصول إلى المستودعات
- ✅ `workflow` - لتحديث workflows (اختياري)

Deploy Key يحتاج:
- ✅ Write access على المستودع الهدف

---

## 🚀 التطبيق السريع (5 دقائق)

### الطريقة الموصى بها (Personal Access Token):

```bash
# 1. أنشئ token من GitHub Settings
# 2. أضفه إلى Secrets باسم DEPLOY_TOKEN
# 3. عمل push جديد
git push origin main

# 4. راقب Actions
# https://github.com/rdapify/RDAPify/actions

# 5. تحقق من الموقع
# https://rdapify.com
```

---

## 🔍 استكشاف الأخطاء

### الخطأ: "not found deploy key or tokens"

**الحل:**
- تأكد من إضافة `DEPLOY_TOKEN` إلى Secrets
- تأكد من أن الاسم صحيح تماماً: `DEPLOY_TOKEN`
- تأكد من أن الـ token لديه صلاحيات `repo`

### الخطأ: "Permission denied"

**الحل:**
- تأكد من أن الـ token لديه صلاحيات كتابة
- تأكد من أنك owner أو لديك صلاحيات على المستودع الهدف

### الخطأ: "Repository not found"

**الحل:**
- تأكد من أن `rdapify/rdapify.github.io` موجود
- تأكد من أن الـ token لديه صلاحيات الوصول إليه

---

## 📚 موارد إضافية

- [GitHub Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [GitHub Deploy Keys](https://docs.github.com/en/developers/overview/managing-deploy-keys)
- [peaceiris/actions-gh-pages](https://github.com/peaceiris/actions-gh-pages)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)

---

## ✅ Checklist

### قبل البدء
- [ ] لديك صلاحيات admin على المستودعين
- [ ] المستودع `rdapify/rdapify.github.io` موجود
- [ ] Domain `rdapify.com` مُعد بشكل صحيح

### التطبيق
- [ ] أنشأت Personal Access Token
- [ ] أضفت الـ token إلى GitHub Secrets
- [ ] عملت push جديد
- [ ] راقبت GitHub Actions
- [ ] تحققت من نجاح الـ deployment

### بعد التطبيق
- [ ] الموقع يعمل على https://rdapify.com
- [ ] لا أخطاء في GitHub Actions
- [ ] الـ deployment يعمل تلقائياً

---

**الحالة:** ⏳ يحتاج إضافة token من جانبك

**الوقت المطلوب:** 5 دقائق

**تم إنشاء الدليل بواسطة:** Kiro AI DevOps Assistant  
**التاريخ:** 25 يناير 2026
