# خطة تنظيف المستودع للنشر العام

## الملفات التي يجب الاحتفاظ بها في الجذر

### ملفات أساسية
- ✅ README.md
- ✅ README_AR.md
- ✅ LICENSE
- ✅ CHANGELOG.md
- ✅ CONTRIBUTING.md
- ✅ CODE_OF_CONDUCT.md
- ✅ SECURITY.md
- ✅ PRIVACY.md
- ✅ GOVERNANCE.md
- ✅ MAINTAINERS.md
- ✅ ROADMAP.md

### ملفات تقنية
- ✅ package.json
- ✅ package-lock.json
- ✅ tsconfig.json
- ✅ jest.config.js
- ✅ .gitignore
- ✅ .npmignore
- ✅ .editorconfig
- ✅ .prettierrc
- ✅ .prettierignore
- ✅ .eslintrc.js
- ✅ .eslintignore
- ✅ .npmrc

## الملفات التي يجب نقلها إلى docs/project-management/

- BUILD_GUIDE.md
- BUILD_PHASE_READY.md
- CLOUDFLARE_EMAIL_SETUP.md
- CORE_IMPLEMENTATION_COMPLETE.md
- CURRENT_BUILD_STATUS.md
- CURRENT_STATUS.md
- DEPLOYMENT_CHECKLIST.md
- DNS_SETUP.md
- DOMAIN_SETUP_SUMMARY.md
- EMAIL_HOSTING_RECOMMENDATION.md
- FINAL_REPORT.md
- GITHUB_PAGES_RECOMMENDATION.md
- GITHUB_PAGES_SETUP.md
- GITHUB_READY_SUMMARY.md
- IMPLEMENTATION_SUMMARY.md
- IMPROVEMENTS_SUMMARY.md
- INSTALLATION_GUIDE.md (دمجها مع docs/getting_started/)
- NEXT_STEPS.md
- NODEJS_INSTALLATION_WINDOWS.md
- PROJECT_ROADMAP_UPDATED.md
- PROJECT_STATUS.md
- QUICK_START_GUIDE.md (دمجها مع docs/getting_started/)
- RDApify_Structure.md
- START_HERE.md
- TESTING_PHASE_STARTED.md

## الملفات التي يجب حذفها

- ❌ .x.txt (ملف مؤقت)
- ❌ CNAME (إذا لم يكن مستخدماً)
- ❌ CONTACT.md (دمجها في README أو CONTRIBUTING)
- ❌ index.html (إذا لم يكن جزءاً من الموقع)

## المجلدات التي يجب تنظيفها

- ❌ coverage/ (إضافتها إلى .gitignore)
- ❌ dist/ (إضافتها إلى .gitignore)
- ❌ node_modules/ (موجودة في .gitignore)

## الإجراءات

1. إنشاء مجلد docs/project-management/
2. نقل ملفات إدارة المشروع
3. حذف الملفات المؤقتة
4. تحديث .gitignore
5. تحديث README.md بالروابط الصحيحة
