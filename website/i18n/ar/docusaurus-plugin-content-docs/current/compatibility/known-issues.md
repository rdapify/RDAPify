# المشكلات والقيود المعروفة

**الهدف**: توثيق شامل للمشكلات والقيود والحلول البديلة المعروفة في RDAPify عبر البيئات والسجلات والإصدارات المختلفة، لمساعدة المطورين على توقع المشكلات وحلها
**ذات صلة**: [مصفوفة التوافق](matrix.md) | [إصدارات Node.js](nodejs-versions.md) | [دعم Bun](bun.md) | [دعم Deno](deno.md) | [Cloudflare Workers](cloudflare-workers.md)
**وقت القراءة**: 6 دقائق

## نظام تصنيف المشكلات

تستخدم RDAPify نظام تصنيف موحداً لتصنيف المشكلات المعروفة حسب الخطورة والتأثير:

| مستوى الخطورة | التأثير | الجدول الزمني للحل | الإجراء المطلوب من المستخدم |
|--------------|---------|---------------------|------------------------------|
| **حرج** | النظام غير قابل للاستخدام، ثغرة أمنية | فوري (أقل من 72 ساعة) | التوقف عن استخدام الميزة المتأثرة |
| **مرتفع** | وظائف رئيسية متأثرة | قصير المدى (أقل من أسبوعين) | تطبيق الحل البديل فوراً |
| **متوسط** | تأثير معتدل على قابلية الاستخدام | متوسط المدى (أقل من شهر) | تطبيق الحل البديل عند الملاءمة |
| **منخفض** | إزعاج بسيط أو حالة حافة | طويل المدى (إصدارات مستقبلية) | لا يلزم اتخاذ إجراء فوري |
| **معلوماتي** | توثيق أو توضيح مطلوب | مستمر | لا شيء |

## المشكلات الحيوية المعروفة

### 1. عدم استقرار نقاط نهاية API في سجل AFRINIC

**الخطورة**: حرج
**الحالة**: قيد المراقبة
**الإصدارات المتأثرة**: جميع الإصدارات
**البيئات المتأثرة**: جميع البيئات
**تأثير السجل**: AFRINIC (أفريقيا)

**الوصف**:
تشهد نقاط نهاية RDAP الخاصة بـ AFRINIC توقفات متكررة وإرجاع استجابات غير متسقة. أقرّت الجهة التسجيلية بقيود البنية التحتية لكنها لم تقدم جدولاً زمنياً للحل.

**الأعراض**:
- معدلات أخطاء مرتفعة (15-25%) عند الاستعلام عن موارد AFRINIC
- أخطاء 502/503 متقطعة من خوادم AFRINIC RDAP
- بيانات تسجيل مفقودة أو غير مكتملة في الاستجابات

**الحل البديل**:
```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  retry: {
    maxAttempts: 5,
    backoff: 'exponential',
    maxDelay: 10000 // 10 second maximum delay
  },
  timeout: 15000, // 15 second timeout
  fallbackRegistries: [
    {
      registry: 'afrinic',
      fallbacks: [
        { url: 'https://rdap.afrinic.net/rdap/', priority: 1 },
        { url: 'https://afrinic-rest-legacy.afrinic.net/rest/', priority: 2 }
      ]
    }
  ]
});

// Implement circuit breaker pattern
let afrinicFailures = 0;
const MAX_FAILURES = 3;

async function queryWithCircuitBreaker(domain: string): Promise<any> {
  if (afrinicFailures >= MAX_FAILURES) {
    throw new Error('AFRINIC circuit breaker open - service unavailable');
  }

  try {
    const result = await client.domain(domain);
    afrinicFailures = 0; // Reset failures on success
    return result;
  } catch (error) {
    afrinicFailures++;
    throw error;
  }
}
```

**حالة الحل**:
أقرّت AFRINIC بالمشكلة وتعمل على تحسينات البنية التحتية. تحتفظ RDAPify بتواصل فعّال مع فريق AFRINIC التقني وستحدّث هذه الوثائق عند نشر التحسينات.

### 2. تسرب ذاكرة في Node.js 16.x في وحدة التخزين المؤقت

**الخطورة**: حرج
**الحالة**: تم الإصلاح في v0.1.8+
**الإصدارات المتأثرة**: v0.1.8 - v0.1.8
**البيئات المتأثرة**: Node.js 16.x فقط
**تأثير السجل**: جميع السجلات

**الوصف**:
يوجد تسرب ذاكرة في وحدة التخزين المؤقت عند التشغيل على بيئات Node.js 16.x. يحدث التسرب بسبب تنظيف غير سليم لمدخلات التخزين المؤقت أثناء العمليات عالية الحجم.

**الأعراض**:
- يتزايد استخدام الذاكرة بثبات أثناء المعالجة الدفعية
- تعطل العملية مع "نفاد الذاكرة" بعد 4-6 ساعات تشغيل
- تدهور الأداء مع مرور الوقت

**الحل البديل** (للإصدارات قبل v0.1.8):
```typescript
import { RDAPClient } from 'rdapify';

// Implement aggressive cache cleanup
const client = new RDAPClient({
  cache: {
    enabled: true,
    type: 'memory',
    memory: {
      max: 5000, // Reduce cache size
      ttl: 300000, // 5 minute TTL
      cleanupInterval: 300000 // 5 minute cleanup
    }
  },
  performance: {
    maxConcurrent: 5 // Reduce concurrency to limit memory pressure
  }
});

// Manual cache cleanup every 5 minutes
setInterval(() => {
  client.clearCache();
  console.log('Cache manually cleared to prevent memory leak');
}, 300000);
```

**الحل**:
تم حل هذه المشكلة في RDAPify v0.1.8 مع إعادة كتابة كاملة لوحدة التخزين المؤقت باستخدام WeakRefs لبيئات Node.js 16+. يجب على مستخدمي Node.js 16.x الترقية إلى v0.1.8 أو أحدث، أو الهجرة إلى Node.js 18+ غير المتأثر بهذه المشكلة.

## المشكلات عالية الأولوية

### 1. قيود حجم تخزين Cloudflare Workers KV

**الخطورة**: مرتفع
**الحالة**: قيد منصة معروف
**الإصدارات المتأثرة**: جميع الإصدارات
**البيئات المتأثرة**: Cloudflare Workers
**تأثير السجل**: جميع السجلات

**الوصف**:
يبلغ حد تخزين KV في Cloudflare Workers 25 ميجابايت لكل قيمة، وهو قد يُتجاوز عند تخزين استجابات RDAP الكبيرة لمحافظ نطاقات أو نطاقات IP معينة.

**الأعراض**:
- فشل كتابة التخزين المؤقت مع أخطاء "KV PUT operation failed: key too large"
- تدهور الأداء عند فشل عمليات KV والعودة إلى استعلامات السجل
- سلوك تخزين مؤقت غير متسق للاستجابات الكبيرة

**الحل البديل**:
```typescript
// config/cloudflare-workers.ts
import { RDAPClient } from 'rdapify';

export const createCloudflareClient = (env: Env) => {
  return new RDAPClient({
    cache: {
      enabled: true,
      type: 'kv-chunked', // Use chunked KV strategy
      kv: {
        namespace: env.RDAP_CACHE,
        ttl: 1800000, // 30 minutes
        maxChunkSize: 24 * 1024 * 1024, // 24MB chunks
        maxChunksPerKey: 4
      }
    },
    performance: {
      maxConcurrent: 3, // Reduce concurrency for Cloudflare
      connectionPool: {
        max: 8,
        timeout: 2000
      }
    }
  });
};

// Chunked cache implementation
class ChunkedKVCacher {
  async set(key: string, value: any, ttl: number): Promise<void> {
    const jsonString = JSON.stringify(value);
    const chunks = this.chunkString(jsonString);

    // Store chunk metadata
    await this.kv.put(`${key}:meta`, JSON.stringify({
      chunkCount: chunks.length,
      totalSize: jsonString.length,
      timestamp: Date.now(),
      expires: Date.now() + ttl
    }), { expirationTtl: Math.floor(ttl / 1000) });

    // Store chunks
    await Promise.all(
      chunks.map((chunk, index) =>
        this.kv.put(`${key}:chunk:${index}`, chunk, { expirationTtl: Math.floor(ttl / 1000) })
      )
    );
  }

  private chunkString(str: string, chunkSize: number = 24 * 1024 * 1024): string[] {
    const chunks = [];
    for (let i = 0; i < str.length; i += chunkSize) {
      chunks.push(str.substring(i, i + chunkSize));
    }
    return chunks;
  }
}
```

**حالة الحل**:
هذا قيد منصة في Cloudflare Workers. نفّذت RDAPify التخزين المؤقت المجزأ كحل بديل (متاح في v0.1.8+). تحقق Cloudflare في زيادة حدود حجم قيمة KV للعملاء المؤسسيين.

### 2. قيود CORS في Safari 16

**الخطورة**: مرتفع
**الحالة**: قيد متصفح
**الإصدارات المتأثرة**: v0.1.8+
**البيئات المتأثرة**: Safari 16 على iOS وmacOS
**تأثير السجل**: جميع السجلات عند الاستخدام في المتصفح

**الوصف**:
يطبّق Safari 16 سياسة CORS أكثر صرامة من المتصفحات الأخرى، مما يحجب كثيراً من نقاط نهاية RDAP التي لا تتضمن رؤوس CORS المناسبة في استجاباتها.

**الأعراض**:
- أخطاء CORS عند إجراء طلبات RDAP مباشرة من Safari
- أخطاء "Cannot use import statement outside a module" في وحدة تحكم Safari
- ميزات تعمل في Chrome/Firefox لكن تفشل في Safari

**الحل البديل**:
```javascript
// browser/client.js
import { RDAPClient } from 'rdapify';

// Always use proxy in Safari
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

export const createBrowserClient = () => {
  return new RDAPClient({
    security: {
      // Safari requires proxy for all requests
      corsProxy: {
        enabled: isSafari || process.env.NODE_ENV === 'production',
        baseUrl: 'https://cors.rdapify.dev/proxy?url='
      }
    },
    cache: {
      enabled: true,
      type: 'indexeddb' // Safari has better IndexedDB support than Cache API
    }
  });
};

// Proxy validation for Safari
export const validateProxyConfig = (config) => {
  if (isSafari && !config.security?.corsProxy?.enabled) {
    console.warn('Safari requires CORS proxy for RDAP requests. Enabling proxy automatically.');
    config.security = config.security || {};
    config.security.corsProxy = {
      enabled: true,
      baseUrl: config.security.corsProxy?.baseUrl || 'https://cors.rdapify.dev/proxy?url='
    };
  }
  return config;
};
```

**حالة الحل**:
هذا قيد متصفح لا يمكن إصلاحه في RDAPify. النهج الموصى به هو استخدام CORS proxy دائماً عند النشر لمتصفحات Safari. توفر RDAPify إعداد proxy مدمجاً للتعامل مع هذا تلقائياً.

## المشكلات متوسطة الأولوية

### 1. قيود مسار Windows في بيئات التطوير

**الخطورة**: متوسط
**الحالة**: قيد منصة
**الإصدارات المتأثرة**: v0.1.8+
**البيئات المتأثرة**: بيئات تطوير Windows
**تأثير السجل**: لا يوجد (تطوير فقط)

**الوصف**:
يملك Windows حداً لطول المسار يبلغ 260 محرفاً، وهو قد يُتجاوز عند تثبيت تبعيات RDAPify في أدلة مشاريع متداخلة بعمق.

**الأعراض**:
- فشل `npm install` مع أخطاء "path too long"
- ملفات مفقودة في node_modules بعد التثبيت
- فشل الاختبارات بسبب تبعيات مفقودة

**الحل البديل**:
```bash
# Solution 1: Enable long paths in Windows
# Run PowerShell as Administrator:
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1

# Solution 2: Install in a shallow directory
mkdir C:\rdapify-project
cd C:\rdapify-project
npm install rdapify

# Solution 3: Use npm configuration to reduce path depth
npm config set cache C:\npm-cache
npm config set prefix C:\npm-global
npm install -g rdapify
```

**حالة الحل**:
هذا قيد منصة Windows. رغم أن Windows 10+ يدعم المسارات الطويلة عند تفعيلها، إلا أن كثيراً من الأدوات لا تزال تعاني مشكلات. قلّصت RDAPify عمق التبعيات في v0.1.8+ للتخفيف من هذه المشكلة.

### 2. مشكلات تحليل DNS في Alpine Linux بـ Docker

**الخطورة**: متوسط
**الحالة**: قيد بيئة
**الإصدارات المتأثرة**: v0.1.8+
**البيئات المتأثرة**: حاويات Docker تستخدم صور Alpine Linux الأساسية
**تأثير السجل**: جميع السجلات

**الوصف**:
يتصرف musl libc في Alpine Linux بشكل مختلف في تحليل DNS مقارنة بـ glibc، مما يتسبب في فشل DNS متقطع عند تحليل أسماء مضيفي خوادم RDAP.

**الأعراض**:
- أخطاء "getaddrinfo EAI_AGAIN" متقطعة عند تحليل نطاقات السجل
- اتصال غير متسق بنقاط نهاية RDAP
- انتهاء مهلة الاتصالات يُحل بعد إعادة تشغيل الحاوية

**الحل البديل**:
```dockerfile
# Dockerfile with DNS fixes
FROM node:20-alpine

# Fix DNS resolution issues
RUN apk add --no-cache bind-tools && \
    echo 'options rotate timeout:1 attempts:2' >> /etc/resolv.conf && \
    echo 'nameserver 8.8.8.8' >> /etc/resolv.conf && \
    echo 'nameserver 8.8.4.4' >> /etc/resolv.conf

# Alternative: Use glibc-based image
# FROM node:20-slim

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build

USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

```bash
# docker-compose.yml with DNS configuration
version: '3.8'
services:
  rdapify:
    build: .
    dns:
      - 8.8.8.8
      - 8.8.4.4
    dns_search:
      - .
    environment:
      NODE_OPTIONS: --dns-result-order=ipv4first
    # ... rest of configuration
```

**حالة الحل**:
هذا قيد في Alpine Linux. توصي RDAPify باستخدام الصورة الأساسية `node:20-slim` للنشرات الإنتاجية لتجنب مشاكل DNS. بالنسبة للبيئات التي تتطلب Alpine، فإن الحلول البديلة لإعداد DNS المذكورة أعلاه فعّالة.

## المشكلات منخفضة الأولوية

### 1. قيود استنتاج الأنواع في TypeScript 4.x

**الخطورة**: منخفض
**الحالة**: قيد TypeScript
**الإصدارات المتأثرة**: v0.1.8+
**البيئات المتأثرة**: مشاريع TypeScript 4.x
**تأثير السجل**: لا يوجد (تطوير فقط)

**الوصف**:
يملك TypeScript 4.x قيوداً في استنتاج الأنواع للأنواع العامة المعقدة المستخدمة في نظام تعيير استجابة RDAPify.

**الأعراض**:
- أخطاء مصرّف TypeScript حول "type instantiation is excessively deep"
- تدهور أداء IDE عند العمل مع أنواع RDAPify
- الحاجة إلى تأكيدات أنواع صريحة في بعض السيناريوهات

**الحل البديل**:
```typescript
// tsconfig.json adjustments
{
  "compilerOptions": {
    "strict": true,
    "target": "es2020",
    "module": "esnext",
    "moduleResolution": "node",
    "skipLibCheck": true, // Skip type checking of declaration files
    "types": ["node"], // Explicitly specify types to include

    // Reduce type complexity
    "noImplicitAny": false, // Temporarily disable for complex types
    "strictNullChecks": false // Temporarily disable for complex types
  }
}

// Alternative: Use type assertions
import { RDAPClient, DomainResponse } from 'rdapify';

const client = new RDAPClient();
const result = await client.domain('example.com') as DomainResponse;

// Or create simplified type definitions
interface SimplifiedDomain {
  domain: string;
  registrar: string;
  status: string[];
  nameservers: string[];
}
```

**حالة الحل**:
حُلّت هذه المشكلة في TypeScript 5.0+ الذي يملك قدرات استنتاج أنواع محسّنة. تتضمن RDAPify v0.1.8+ تعريفات أنواع TypeScript 5.x التي تعمل بشكل صحيح عبر جميع الإصدارات المدعومة.

## ملاحظات معلوماتية

### 1. دقة بيانات السجل وحداثتها

**الخطورة**: معلوماتي
**الحالة**: يعتمد على السجل
**الإصدارات المتأثرة**: جميع الإصدارات
**البيئات المتأثرة**: جميع البيئات
**تأثير السجل**: جميع السجلات

**الوصف**:
توفر RDAPify وصولاً إلى بيانات السجل لكنها لا تستطيع ضمان دقة البيانات أو اكتمالها أو حداثتها. تملك مشغلو السجلات سياسات تحديث مختلفة ومعايير جودة بيانات متباينة.

**الاعتبارات الرئيسية**:
- **حداثة البيانات**: قد تستغرق التغييرات على تسجيلات النطاقات 24-48 ساعة للظهور في استجابات RDAP
- **اكتمال البيانات**: قد تُخفي بعض السجلات حقولاً معينة أو تحذفها لأسباب خصوصية أو سياسية
- **دقة البيانات**: قد تحتوي بيانات السجل على أخطاء أو تناسقات خارج سيطرة RDAPify
- **سياسات السجل**: لكل سجل سياسات مختلفة للاحتفاظ بالبيانات وتوافرها

**الممارسات الفضلى**:
```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  dataQuality: {
    // Set expectations for data freshness
    maxDataAge: 86400000, // 24 hours in milliseconds

    // Handle missing data gracefully
    missingDataStrategy: 'fallback-to-previous' | 'return-partial' | 'error',

    // Validate data consistency
    validation: {
      requireRegistrationDate: true,
      requireExpirationDate: true,
      requireNameservers: false
    }
  }
});

async function getDomainWithValidation(domain: string) {
  try {
    const result = await client.domain(domain);

    // Check data freshness
    const lastUpdated = result.events?.find(e => e.eventAction === 'last updated')?.eventDate;
    if (lastUpdated && Date.now() - new Date(lastUpdated).getTime() > 86400000) {
      console.warn(`Data for ${domain} may be stale (last updated: ${lastUpdated})`);
    }

    return result;
  } catch (error) {
    // Handle data quality issues separately from network errors
    if (error.code === 'DATA_QUALITY_ISSUE') {
      console.warn(`Data quality issue for ${domain}: ${error.message}`);
      return null; // Or fallback to cached data
    }
    throw error;
  }
}
```

**التوصيات**:
- تطبيق التحقق من جانب العميل لنقاط البيانات الحيوية
- استخدام رؤوس التخزين المؤقت لفهم حداثة البيانات
- الحفاظ على مقاييس جودة بيانات محلية لتحديد السجلات الإشكالية
- وضع توقعات العميل حول قيود البيانات في واجهات المستخدم

## استكشاف المشكلات الشائعة

### 1. تشخيص المشكلات الخاصة بالبيئة
**الأعراض**: يعمل التطبيق في التطوير لكن يفشل في الإنتاج
**خطوات التشخيص**:
```bash
# 1. Check environment compatibility
npx rdapify doctor --env production

# 2. Verify registry connectivity from production environment
npx rdapify test-connectivity --registries verisign,arin,ripe --env production

# 3. Check for missing dependencies in production
npx rdapify check-dependencies --env production

# 4. Validate configuration differences
diff <(npx rdapify config-dump --env development) <(npx rdapify config-dump --env production)
```

**الحلول**:
- **تكافؤ البيئات**: استخدام حاويات Docker لضمان بيئات متطابقة عبر التطوير والإنتاج
- **إدارة الإعداد**: استخدام متغيرات البيئة وملفات الإعداد بدلاً من القيم المضمنة في الكود
- **علامات الميزات**: تطبيق علامات الميزات لتعطيل الميزات الإشكالية في بيئات معينة
- **التحسين التدريجي**: تصميم الوظائف الأساسية للعمل حتى عند عدم توفر الميزات المتقدمة

### 2. تصحيح أخطاء الفشل الخاص بكل سجل
**الأعراض**: يعمل التطبيق لبعض النطاقات لكن يفشل للأخرى
**خطوات التشخيص**:
```bash
# 1. Identify failing registry
npx rdapify registry-lookup --domain example.af --verbose

# 2. Test direct registry connectivity
curl -v "https://rdap.afrinic.net/rdap/domain/example.af"

# 3. Compare working vs non-working responses
npx rdapify compare-responses --working example.com --failing example.af

# 4. Enable debug logging for specific registry
RDAP_DEBUG_REGISTRY=afrinic node app.js
```

**الحلول**:
- **محولات خاصة بالسجل**: تطبيق محولات مخصصة للسجلات الإشكالية
- **قواطع الدائرة**: عزل السجلات الفاشلة لمنع الفشل المتسلسل
- **استراتيجيات احتياطية**: تطبيق نقاط نهاية احتياطية متعددة للسجلات الحيوية
- **كشف الميزات**: ضبط السلوك ديناميكياً بحسب قدرات السجل

## الوثائق ذات الصلة

| المستند | الوصف | المسار |
|---------|--------|--------|
| [مصفوفة التوافق](matrix.md) | مرجع التوافق الكامل | [matrix.md](matrix.md) |
| [حالة السجل](../guides/registry_status.md) | لوحة توفر السجل في الوقت الفعلي | [../guides/registry_status.md](../guides/registry_status.md) |
| [استكشاف مشكلات الأداء](../troubleshooting/performance.md) | دليل تشخيص مشكلات الأداء | [../troubleshooting/performance.md](../troubleshooting/performance.md) |
| [دليل معالجة الأخطاء](../guides/error_handling.md) | استراتيجيات معالجة الأخطاء الشاملة | [../guides/error_handling.md](../guides/error_handling.md) |
| [دعم المجتمع](../../community/support.md) | الحصول على المساعدة من المجتمع والمشرفين | [../../community/support.md](../../community/support.md) |

## مواصفات تتبع المشكلات

| الخاصية | القيمة |
|---------|--------|
| **نظام تتبع المشكلات** | GitHub Issues مع تصنيفات ومعالم |
| **عملية الإفصاح عن الثغرات الأمنية** | الإفصاح المسؤول عبر security@rdapify.com |
| **وقت الاستجابة للمشكلة** | حرجة: أقل من 24 ساعة، مرتفعة: أقل من 72 ساعة، متوسطة: أقل من أسبوع |
| **تحديد أولوية الإصلاح** | الأمان > سلامة البيانات > التوفر > الأداء > الميزات |
| **دعم الإصدار** | الإصدار الحالي + 2 إصدارات ثانوية سابقة تتلقى إصلاحات الأخطاء |
| **سياسة انتهاء الدورة** | إشعار 6 أشهر قبل إيقاف دعم البيئة |
| **تحديثات سجل التغييرات** | جميع المشكلات المُصلَّحة في إصدار موثقة في CHANGELOG.md |
| **آخر تحديث** | 5 ديسمبر 2025 |

> **تنبيه حرج**: تحقق دائماً من هذه الوثائق قبل الإبلاغ عن مشكلات جديدة. كثير من المشكلات الخاصة بالبيئة لها حلول بديلة موثقة. للمشكلات الأمنية، لا تناقش التفاصيل علناً - تواصل مع security@rdapify.com مباشرة باستخدام تشفير PGP. حدّث RDAPify بانتظام للحصول على إصلاحات للمشكلات المعروفة، وطبّق الحلول البديلة الموصى بها للقيود غير المحلولة في بيئتك.

[العودة إلى التوافق](../README.md) | [التالي: إصدارات Node.js](nodejs-versions.md)

*تم توليد هذا المستند تلقائياً من الكود المصدري مع مراجعة أمنية بتاريخ 5 ديسمبر 2025*
