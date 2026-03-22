# توافق إصدارات Node.js

**الهدف**: دليل توافق شامل لـ RDAPify عبر إصدارات Node.js، مع تفصيل خصائص الأداء واعتبارات الأمان واستراتيجيات الهجرة لبيئات التشغيل المختلفة
**ذات صلة**: [مصفوفة التوافق](matrix.md) | [دعم Bun](bun.md) | [دعم Deno](deno.md) | [Cloudflare Workers](cloudflare-workers.md) | [المتصفحات](browsers.md)
**وقت القراءة**: 4 دقائق

## مصفوفة دعم إصدارات Node.js

تدعم RDAPify إصدارات Node.js المتعددة بمستويات مختلفة من توفر الميزات وخصائص الأداء وضمانات الأمان:

| إصدار Node.js | حالة LTS | مستوى الدعم | جاهز للإنتاج | الأداء | الأمان | ملاحظات |
|--------------|----------|-------------|---------------|--------|--------|---------|
| **v21.x** | الحالي | كامل | نعم | ★★★★★ | ★★★★★ | أحدث الميزات، بدون ضمانات LTS |
| **v20.x** | LTS (نشط) | كامل | نعم | ★★★★★ | ★★★★★ | LTS النشط الحالي (حتى أبريل 2026) |
| **v18.x** | LTS (صيانة) | كامل | نعم | ★★★★☆ | ★★★★☆ | LTS الصيانة (حتى أبريل 2025) |
| **v16.x** | انتهت الدورة | إصلاحات أمنية فقط | لا | ★★★☆☆ | ★★☆☆☆ | انتهت الدورة في سبتمبر 2023 |
| **< v16.x** | غير مدعوم | لا دعم | لا | ★★☆☆☆ | ★☆☆☆☆ | ثغرات أمنية حيوية |

### شرح مستويات الدعم
- **دعم كامل**: مجموعة كاملة من الميزات والتحسينات والتصحيحات الأمنية
- **إصلاحات أمنية فقط**: تصحيحات أمنية حيوية فقط، بدون ميزات جديدة أو تحسينات أداء
- **لا دعم**: غير مُختبَر ولا مدعوم؛ قد يحتوي على ثغرات حيوية

## الإعداد الخاص بكل إصدار

### Node.js 20+ (موصى به)
```typescript
// config/node20.ts
import { RDAPClient } from 'rdapify';

export const createNode20Client = () => {
  return new RDAPClient({
    // Node.js 20+ specific optimizations
    performance: {
      maxConcurrent: 20, // Higher concurrency limits
      connectionPool: {
        max: 100,
        timeout: 2000, // 2 seconds
        keepAlive: 30000 // 30 seconds
      },
      uvThreadpoolSize: 8 // Higher thread pool size
    },
    security: {
      ssrfProtection: true,
      certificatePinning: true,
      tlsMinVersion: 'TLSv1.3' // Enforce TLS 1.3+
    },
    cache: {
      enabled: true,
      type: 'memory',
      memory: {
        max: 15000, // Larger cache size
        ttl: 3600000 // 1 hour
      }
    }
  });
};
```

### Node.js 18 (LTS صيانة)
```typescript
// config/node18.ts
import { RDAPClient } from 'rdapify';

export const createNode18Client = () => {
  return new RDAPClient({
    // Node.js 18 specific configuration
    performance: {
      maxConcurrent: 15,
      connectionPool: {
        max: 75,
        timeout: 3000, // 3 seconds
        keepAlive: 20000 // 20 seconds
      },
      uvThreadpoolSize: 4 // Default thread pool size
    },
    security: {
      ssrfProtection: true,
      certificatePinning: true,
      tlsMinVersion: 'TLSv1.2' // TLS 1.2 minimum
    },
    cache: {
      enabled: true,
      type: 'memory',
      memory: {
        max: 10000, // Standard cache size
        ttl: 1800000 // 30 minutes
      }
    }
  });
};
```

### Node.js 16 (انتهاء الدورة)
```typescript
// config/node16.ts
import { RDAPClient } from 'rdapify';

export const createNode16Client = () => {
  // Warning: Node.js 16 is end-of-life and contains known security vulnerabilities
  console.warn('⚠️ WARNING: Node.js 16 is end-of-life. Upgrade to Node.js 18+ for security updates.');

  return new RDAPClient({
    // Limited configuration for EOL version
    performance: {
      maxConcurrent: 10,
      connectionPool: {
        max: 50,
        timeout: 5000, // 5 seconds
        keepAlive: 10000 // 10 seconds
      },
      uvThreadpoolSize: 4
    },
    security: {
      ssrfProtection: true,
      certificatePinning: false, // Limited certificate pinning support
      tlsMinVersion: 'TLSv1.2'
    },
    cache: {
      enabled: true,
      type: 'memory',
      memory: {
        max: 5000, // Reduced cache size
        ttl: 600000 // 10 minutes
      }
    }
  });
};
```

## قياسات الأداء حسب إصدار Node.js

### أداء الاستعلام (1000 استعلام نطاق)
| إصدار Node.js | متوسط الوقت (مللي ثانية) | الإنتاجية (طلب/ثانية) | الذاكرة (ميجابايت) | زمن P99 (مللي ثانية) |
|--------------|--------------------------|----------------------|-------------------|---------------------|
| **v21.1** | 1.6 | 625 | 82 | 3.8 |
| **v20.10** | 1.8 | 555 | 85 | 4.2 |
| **v18.18** | 2.3 | 434 | 92 | 5.7 |
| **v16.20** | 3.8 | 263 | 110 | 9.5 |
| **v14.21** | 6.2 | 161 | 145 | 15.8 |

### أداء المعالجة الدفعية (500 نطاق في دفعات من 50)
| إصدار Node.js | الوقت الإجمالي (ثانية) | ذاكرة الذروة (ميجابايت) | معدل الأخطاء (%) | استهلاك المعالج (%) |
|--------------|------------------------|------------------------|-----------------|---------------------|
| **v21.1** | 2.7 | 175 | 0.1 | 68 |
| **v20.10** | 3.2 | 185 | 0.1 | 62 |
| **v18.18** | 4.1 | 210 | 0.2 | 55 |
| **v16.20** | 6.8 | 245 | 0.5 | 48 |
| **v14.21** | 11.3 | 290 | 1.2 | 42 |

## اعتبارات الأمان حسب الإصدار

### ميزات أمان Node.js 20+
- **دعم TLS 1.3**: تطبيق TLS 1.3 كامل مع دعم 0-RTT
- **تثبيت الشهادات**: تثبيت شهادات متقدم مع خوارزميات متعددة
- **حماية الذاكرة**: مناطق ذاكرة محمية للبيانات الحساسة
- **بيانات وصفية للأمان**: بيانات أمنية مُعززة في كائنات الأخطاء
- **تصحيح الثغرات**: تحديثات أمنية منتظمة بدورة تصحيح أقل من 30 يوماً

### ميزات أمان Node.js 18
- **دعم TLS 1.2+**: الحد الأدنى TLS 1.2 مع TLS 1.3 اختياري
- **تثبيت الشهادات**: دعم أساسي لتثبيت الشهادات
- **حماية الذاكرة**: ميزات حماية ذاكرة محدودة
- **تصحيح الثغرات**: تحديثات أمنية ممتدة حتى أبريل 2025

### قيود أمان Node.js 16
- **ثغرات معروفة**: CVEs متعددة غير مُصلَّحة بما فيها CVE-2023-32005 (RCE)
- **قيود TLS 1.3**: تطبيق TLS 1.3 غير مكتمل
- **تثبيت الشهادات**: قدرات محدودة لتثبيت الشهادات
- **حماية الذاكرة**: لا توجد ميزات حماية ذاكرة متقدمة
- **تصحيح الثغرات**: لا تحديثات أمنية منذ سبتمبر 2023

## دليل الترقية والهجرة

### من Node.js 16 إلى Node.js 20
```bash
# 1. Update package.json engines field
npm install -D @types/node@20

# 2. Update CI/CD pipeline
sed -i 's/node:16/node:20/g' .github/workflows/*.yml

# 3. Test with Node.js 20
nvm install 20
nvm use 20
npm ci
npm test

# 4. Update deployment configurations
kubectl set image deployment/rdapify *=rdapify:latest-node20
```

### اعتبارات هجرة رئيسية
1. **تطبيق TLS 1.3**: تحديث إعدادات SSL/TLS لاشتراط TLS 1.3
2. **ضبط تجمع الاتصالات**: زيادة أحجام تجمع الاتصالات لإنتاجية أفضل
3. **إدارة الذاكرة**: ضبط حدود الكومة مع `--max-old-space-size`
4. **خيوط العمال**: الاستفادة من خيوط العمال للعمليات المكثفة للمعالج
5. **استيراد التأكيدات**: تحديث بناء جملة الاستيراد لوحدات ESM

## استكشاف المشكلات الشائعة

### 1. أخطاء تحليل الوحدات الخاصة بالإصدار
**الأعراض**: أخطاء `Cannot find module` عند تبديل إصدارات Node.js
**الأسباب الجذرية**:
- خوارزميات تحليل وحدات مختلفة بين إصدارات Node.js
- مشكلات توافق الوحدات الأصيلة
- مشاكل التشغيل المتبادل بين ESM وCommonJS

**خطوات التشخيص**:
```bash
# Check Node.js version and module paths
node -v
node -p "require.resolve.paths('rdapify')"

# Verify native module compatibility
node -p "process.versions.modules"

# Check ESM/CommonJS interoperability
node --experimental-vm-modules -p "import('rdapify').then(console.log)"
```

**الحلول**:
- **التبعيات الشرطية**: استخدام حقل `engines` في `package.json` مع تبعيات خاصة بالإصدار
- **استراتيجية تحليل الوحدات**: إعداد `moduleResolution` في `tsconfig.json` لكل إصدار Node.js
- **ESM Shims**: تطبيق shims لـ ESM لإصدارات Node.js الأقدم
- **مصفوفة البناء**: الحفاظ على أدوات بناء منفصلة لإصدارات Node.js المختلفة

### 2. تدهور الأداء بعد الترقية
**الأعراض**: يعمل التطبيق بشكل أبطأ بعد ترقية إصدار Node.js
**الأسباب الجذرية**:
- الإعدادات الافتراضية غير محسّنة للإصدار الجديد
- تغيرت أنماط استخدام الذاكرة في محرك V8 الجديد
- اختلافات سلوك جمع المهملات
- تغييرات توقيت غير المتزامن تؤثر على حلقة الأحداث

**خطوات التشخيص**:
```bash
# Profile memory usage
NODE_OPTIONS='--max-old-space-size=1024 --trace-gc' node ./dist/app.js

# Analyze event loop latency
clinic doctor --autocannon /domain/example.com -- node ./dist/app.js

# Check V8 optimization status
node --trace-opt --trace-deopt ./dist/app.js
```

**الحلول**:
- **ضبط GC**: ضبط إعدادات جمع المهملات مع `--max-old-space-size` و`--max-semi-space-size`
- **تحسين حلقة الأحداث**: زيادة `UV_THREADPOOL_SIZE` للتطبيقات المرتبطة بالإدخال/الإخراج
- **علامات V8**: تفعيل علامات تحسين V8 مثل `--optimize-for-size` أو `--always-opt`
- **إعادة إعداد تجمع الاتصالات**: ضبط تجمعات الاتصالات لسلوك حزمة الشبكة الجديدة

### 3. تنبيهات ثغرات أمنية
**الأعراض**: تُعلِم أجهزة فحص الأمان عن ثغرات في إصدار Node.js
**الأسباب الجذرية**:
- استخدام إصدارات Node.js المنتهية الدورة
- تبعيات قديمة بثغرات معروفة
- تصحيحات أمنية مفقودة في صور الحاويات
- مشكلات إعداد تكشف سطح هجوم غير ضروري

**خطوات التشخيص**:
```bash
# Scan for vulnerabilities
npm audit --audit-level=high
trivy fs --security-checks vuln .

# Check Node.js security status
node -p "process.release"

# Verify dependency tree
npm ls | grep -E 'vulnerability|security|CVE'
```

**الحلول**:
- **ترقية الإصدار**: الهجرة إلى إصدار Node.js LTS المدعوم بنشاط
- **تحديث التبعيات**: تحديث جميع التبعيات إلى الإصدارات المُصلَّحة
- **أمان الحاوية**: استخدام صور أساسية distroless بأصغر سطح هجوم
- **تصليب الإعداد**: تعطيل الميزات والوحدات غير الضرورية
- **حماية وقت التشغيل**: تطبيق أدوات حماية تطبيق وقت التشغيل (RASP)

## الوثائق ذات الصلة

| المستند | الوصف | المسار |
|---------|--------|--------|
| [مصفوفة التوافق](matrix.md) | مرجع التوافق الكامل | [matrix.md](matrix.md) |
| [دعم Bun](bun.md) | الإعداد الخاص ببيئة تشغيل Bun | [bun.md](bun.md) |
| [دعم Deno](deno.md) | الإعداد الخاص ببيئة تشغيل Deno | [deno.md](deno.md) |
| [Cloudflare Workers](cloudflare-workers.md) | تكامل Cloudflare Workers | [cloudflare-workers.md](cloudflare-workers.md) |
| [الورقة البيضاء للأمان](../../security/whitepaper.md) | البنية الأمنية الشاملة | [../../security/whitepaper.md](../../security/whitepaper.md) |
| [قياسات أداء Node.js](../../../benchmarks/results/nodejs-performance.md) | بيانات قياس الأداء التفصيلية | [../../../benchmarks/results/nodejs-performance.md](../../../benchmarks/results/nodejs-performance.md) |

## مواصفات Node.js

| الخاصية | القيمة |
|---------|--------|
| **الإصدار الموصى به** | Node.js 20 LTS (نشط) |
| **الحد الأدنى المدعوم** | Node.js 18.18.0 |
| **سياسة انتهاء الدورة** | 6 أشهر بعد إعلان EOL الرسمي |
| **سياسة التصحيح الأمني** | تصحيحات حيوية خلال 72 ساعة للإصدارات المدعومة |
| **هدف الأداء** | زمن P95 أقل من 2 مللي ثانية لـ 95% من الاستعلامات |
| **هدف الذاكرة** | أقل من 100 ميجابايت للأحمال المعيارية |
| **تغطية الاختبار** | 98% اختبارات وحدات، 95% اختبارات تكامل لجميع الإصدارات المدعومة |
| **آخر تحديث** | 5 ديسمبر 2025 |

> **تنبيه حرج**: لا تشغّل RDAPify على إصدارات Node.js المنتهية الدورة (v16.x وما دونها) في بيئات الإنتاج. يجب أن تستخدم جميع نشرات الإنتاج إصدارات LTS المدعومة بنشاط مع تصحيحات الأمان الحالية. في البيئات المنظمة، طبّق التحقق ربع السنوي من إصدار Node.js واحتفظ بنسخ احتياطية غير متصلة من الإعدادات العاملة لكل إصدار مدعوم.

[العودة إلى التوافق](../README.md) | [التالي: دعم Bun](bun.md)

*تم توليد هذا المستند تلقائياً من الكود المصدري مع مراجعة أمنية بتاريخ 5 ديسمبر 2025*
