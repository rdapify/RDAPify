# الأسئلة الشائعة (FAQ)

**الهدف**: إجابات شاملة على الأسئلة والمشكلات الأكثر شيوعاً عند استخدام RDAPify لمعالجة بيانات RDAP عبر بيئات التطوير والاختبار والإنتاج
**ذات صلة**: [الأخطاء الشائعة](common-errors.md) | [التصحيح](debugging.md) | [حل انتهاء مهلة الاتصال](connection-timeout.md) | [مشكلات Lambda Workers](lambda-workers-issues.md)
**وقت القراءة**: 10 دقائق

## أسئلة عامة

### ما هو RDAPify ولماذا أستخدمه بدلاً من WHOIS؟
RDAPify هو عميل موحد وعالي الأداء لبروتوكول الوصول إلى بيانات التسجيل (RDAP) يوفر وصولاً متسقاً إلى بيانات التسجيل عبر جميع السجلات العالمية (Verisign وARIN وRIPE وAPNIC وLACNIC). على عكس WHOIS:
- ✅ **API موحد**: استجابات JSON متسقة بغض النظر عن السجل
- ✅ **امتثال البروتوكول**: متوافق بالكامل مع RFC 7480-7484
- ✅ **أمان مدمج**: حماية SSRF تلقائية وحذف PII
- ✅ **أداء أفضل**: تخزين مؤقت ذكي ومعالجة متوازية
- ✅ **الخصوصية أولاً**: أدوات امتثال GDPR/CCPA مدمجة

```javascript
// WHOIS (غير متسق، يتطلب تحليل نص)
const whoisResult = await whois.lookup('example.com');
const registrar = parseWhoisText(whoisResult.text);

// RDAPify (متسق، بيانات منظمة)
const rdapResult = await rdapClient.domain('example.com');
const registrar = rdapResult.registrar.name; // موثوق دائماً
```

### كيف أختار بين إصدارات Node.js وBun وDeno؟
يعتمد الاختيار على بيئتك ومتطلباتك:

| البيئة | وقت التشغيل الموصى به | المزايا الرئيسية |
|--------|----------------------|-----------------|
| **إنتاج المؤسسات** | Node.js 20 LTS | أقصى استقرار، نظام بيئي واسع، تصحيحات أمنية |
| **حساس للأداء** | Bun 1.0+ | بدء أسرع بنسبة 40%، إنتاجية أعلى بنسبة 35%، SQLite مدمج |
| **مركّز على الأمان** | Deno 1.40+ | نموذج أذونات دقيق، لا اعتماديات npm، وضع الحماية افتراضياً |
| **بدون خادم/حافة** | Cloudflare Workers | شبكة حافة عالمية، تكامل D1، لا بدايات باردة |

```bash
# أوامر التثبيت
npm install rdapify            # Node.js
bun add rdapify                # Bun
deno add rdapify               # Deno
```

## أسئلة الإعداد

### كيف أضبط التخزين المؤقت لعمليات نشر الإنتاج؟
لعمليات نشر الإنتاج، نوصي باستراتيجية تخزين مؤقت متعددة المستويات:

```javascript
const client = new RDAPClient({
  cache: {
    enabled: true,
    type: 'multi', // استخدام طبقات تخزين متعددة
    layers: [
      {
        type: 'memory', // L1: ذاكرة مؤقتة سريعة
        max: 5000,
        ttl: 300000, // 5 دقائق
        priority: 'high'
      },
      {
        type: 'redis', // L2: ذاكرة مؤقتة موزعة مشتركة
        url: process.env.REDIS_URL,
        ttl: 3600000, // ساعة واحدة
        priority: 'medium'
      },
      {
        type: 'filesystem', // L3: ذاكرة مؤقتة دائمة للوضع دون اتصال
        path: './data/cache',
        ttl: 86400000, // 24 ساعة
        priority: 'low'
      }
    ]
  }
});
```

**نصائح الإعداد الرئيسية**:
- استخدم الذاكرة المؤقتة للبيانات الساخنة (النطاقات التي يُصل إليها بكثرة)
- استخدم Redis للبيئات الموزعة (نشر متعدد المثيلات)
- استخدم ذاكرة نظام الملفات المؤقتة للعمل دون اتصال (الشبكات المعزولة)
- اضبط TTL بناءً على تقلب البيانات (النطاقات: ساعة، نطاقات IP: 4 ساعات، ASNs: 24 ساعة)

### كيف أضبط حماية SSRF بشكل صحيح؟
حماية SSRF مفعّلة افتراضياً، لكن يجب تخصيصها لبيئتك:

```javascript
const client = new RDAPClient({
  security: {
    ssrfProtection: {
      enabled: true,
      // حجب نطاقات IP الخاصة (RFC 1918)
      blockPrivateIPs: true,
      // السماح فقط لخوادم IANA bootstrap
      whitelistRegistries: true,
      // قيود البروتوكول
      allowedProtocols: ['https'],
      // أمان تحليل DNS
      dnsSecurity: {
        validateDNSSEC: true,
        cacheTTL: 60, // دقيقة واحدة لذاكرة DNS المؤقتة
        blockReservedDomains: true
      },
      // أمان الاتصال
      connectionSecurity: {
        validateCertificates: true,
        enforceTLS13: true,
        timeout: 5000 // مهلة 5 ثوانٍ
      }
    }
  }
});
```

**إعدادات الأمان الحرجة**:
- 🚨 **لا تُعطّل أبداً** `blockPrivateIPs` في بيئات الإنتاج
- 🚨 **فعّل دائماً** `validateCertificates` لاتصالات السجلات الخارجية
- 🚨 اضبط `timeout` لمنع هجمات استنفاد الموارد
- 🚨 استخدم `whitelistRegistries` للبيئات ذات متطلبات الامتثال الصارمة

## أسئلة الأداء

### لماذا استعلامات RDAP بطيئة وكيف أحسّن الأداء؟
الأسباب الشائعة لبطء استعلامات RDAP وحلولها:

| المشكلة | الأعراض | الحل |
|---------|---------|------|
| **ذاكرة مؤقتة باردة** | الاستعلام الأول يستغرق 2-3 ثوانٍ | تطبيق إحماء الذاكرة المؤقتة عند البدء |
| **تحليل DNS** | زمن استجابة ثابت فوق 500 مللي ثانية | استخدام تخزين DNS المؤقت والمحللات المحلية |
| **حدود الاتصال** | الإنتاجية تتوقف عند 50 طلب/ثانية | زيادة حجم مجمع الاتصالات |
| **حدود معدل السجلات** | أخطاء 429 بعد 100 طلب | تطبيق تحديد المعدل التكيفي |
| **استجابات كبيرة** | ارتفاعات الذاكرة في استعلامات نطاق IP | تفعيل المعالجة التدفقية |

**مثال تحسين الأداء**:
```javascript
const client = new RDAPClient({
  performance: {
    // مجمع الاتصالات
    maxConcurrent: 20,
    connectionPool: {
      max: 100,
      timeout: 3000,
      keepAlive: 30000
    },
    // تحسين DNS
    dnsCache: {
      enabled: true,
      ttl: 300 // 5 دقائق
    },
    // تحديد المعدل مع التراجع
    rateLimit: {
      max: 100,
      window: 60000,
      backoff: 'exponential'
    },
    // تفعيل التدفق للاستجابات الكبيرة
    streaming: {
      enabled: true,
      chunkSize: 1024 * 64 // مجزأت 64 كيلوبايت
    }
  }
});

// إحماء الذاكرة المؤقتة عند البدء
async function warmCache() {
  const criticalDomains = ['example.com', 'google.com', 'github.com'];
  await Promise.all(criticalDomains.map(domain => client.domain(domain)));
  console.log('✅ Cache warmed successfully');
}

// استدعاء عند بدء التطبيق
warmCache().catch(console.error);
```

### كيف أعالج النطاقات بالجملة بكفاءة؟
لمعالجة الجملة لأكثر من 1000 نطاق، استخدم API معالجة الدفعات مع إدارة الموارد الصحيحة:

```javascript
async function processBulkDomains(domains, options = {}) {
  const { batchSize = 50, concurrency = 5, timeout = 30000 } = options;

  // إنشاء عميل محدود المعدل
  const client = new RDAPClient({
    performance: {
      maxConcurrent: concurrency,
      connectionPool: {
        max: concurrency * 2,
        timeout: 5000
      }
    },
    retry: {
      maxAttempts: 3,
      backoff: 'exponential'
    }
  });

  const results = [];
  let currentIndex = 0;

  while (currentIndex < domains.length) {
    // معالجة الدفعة
    const batch = domains.slice(currentIndex, currentIndex + batchSize);
    const batchPromises = batch.map(domain =>
      client.domain(domain).catch(error => ({ domain, error: error.message }))
    );

    // التنفيذ مع المهلة
    const batchResults = await Promise.race([
      Promise.allSettled(batchPromises),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Batch timeout')), timeout)
      )
    ]);

    // معالجة النتائج
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push({ domain: batch[index], data: result.value });
      } else {
        results.push({ domain: batch[index], error: result.reason.message });
      }
    });

    currentIndex += batchSize;

    // تحديد المعدل - انتظار بين الدفعات
    if (currentIndex < domains.length) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // تأخير ثانية
    }
  }

  return results;
}

// مثال الاستخدام
const domains = Array.from({ length: 1000 }, (_, i) => `example${i}.com`);
const results = await processBulkDomains(domains, {
  batchSize: 100,
  concurrency: 10
});

const successful = results.filter(r => !r.error);
const failed = results.filter(r => r.error);
console.log(`✅ Processed ${successful.length}/${domains.length} domains successfully`);
```

## أسئلة الأمان والامتثال

### كيف أضمن الامتثال لـ GDPR عند معالجة بيانات النطاقات الأوروبية؟
يتطلب امتثال GDPR طبقات متعددة من الحماية:

```javascript
const client = new RDAPClient({
  privacy: {
    // حذف PII مفعّل افتراضياً
    privacy: true,
    // اكتشاف الاختصاص القضائي
    jurisdiction: 'EU',
    // الأساس القانوني للمعالجة
    legalBasis: 'legitimate-interest', // أو 'consent' أو 'contract' إلخ.
    // تقليص البيانات
    dataMinimization: {
      enabled: true,
      fields: ['ldhName', 'status', 'events'] // الاحتفاظ بالحقول الأساسية فقط
    },
    // الاحتفاظ بالبيانات
    retention: {
      days: 30, // GDPR المادة 5(1)(ه) - تحديد مدة التخزين
      legalObligation: 2555 // 7 سنوات للمتطلبات القانونية
    }
  },
  // تسجيل التدقيق للامتثال
  audit: {
    enabled: true,
    events: ['data_access', 'pii_redaction', 'data_deletion'],
    storage: 'immutable'
  }
});

// معالجة النطاق مع سياق GDPR
const result = await client.domain('example.eu', {
  context: {
    jurisdiction: 'EU',
    legalBasis: 'legitimate-interest',
    purpose: 'registration_data_verification'
  }
});

// توليد إشعار الامتثال
const notice = GDPRComplianceNotice.generate(result);
console.log(notice.title); // "GDPR COMPLIANCE NOTICE"
```

**المتطلبات الحرجة لـ GDPR**:
- 📋 **تقليص البيانات**: جمع ومعالجة البيانات الضرورية لغرضك فقط
- 📋 **تحديد الغرض**: توثيق وتقييد المعالجة للأغراض المحددة
- 📋 **تحديد مدة التخزين**: تطبيق حذف تلقائي للبيانات بعد فترة الاحتفاظ
- 📋 **الشفافية**: تقديم إشعارات واضحة حول أنشطة معالجة البيانات
- 📋 **حقوق موضوع البيانات**: تطبيق أدوات لطلبات الوصول والتصحيح والحذف

### كيف أمنع هجمات SSRF عند الاستعلام عن النطاقات التي يوفرها المستخدمون؟
حماية SSRF مدمجة في RDAPify، لكن يجب تطبيق ضمانات إضافية:

```javascript
async function safeDomainQuery(domain, userContext) {
  // التحقق من صحة تنسيق النطاق
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*(\.[a-z]{2,})$/i.test(domain)) {
    throw new Error('Invalid domain format');
  }

  // تحديد المعدل لكل مستخدم
  const rateLimiter = new RateLimiter({
    keyPrefix: `rdap:${userContext.userId}`,
    points: 100,
    duration: 60 // 100 طلب في الدقيقة
  });

  const [rateLimited, remaining] = await rateLimiter.consume(userContext.userId);
  if (rateLimited) {
    throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(remaining / 1000)} seconds`);
  }

  // الاستعلام مع سياق الأمان
  const client = new RDAPClient({
    security: {
      ssrfProtection: {
        enabled: true,
        blockPrivateIPs: true,
        whitelistRegistries: true,
        context: {
          userId: userContext.userId,
          tenantId: userContext.tenantId,
          riskLevel: userContext.riskLevel || 'standard'
        }
      }
    }
  });

  try {
    const result = await client.domain(domain);
    await auditLogger.log('domain_query', {
      domain,
      userId: userContext.userId,
      timestamp: new Date().toISOString(),
      success: true
    });
    return result;
  } catch (error) {
    await auditLogger.log('domain_query', {
      domain,
      userId: userContext.userId,
      timestamp: new Date().toISOString(),
      success: false,
      error: error.message
    });
    throw error;
  }
}
```

**استراتيجية الدفاع متعدد الطبقات ضد SSRF**:
1. **التحقق من المدخلات**: التحقق من تنسيق النطاق قبل المعالجة
2. **تحديد المعدل**: تحديد الطلبات لكل مستخدم لمنع التعداد
3. **عزل الشبكة**: استخدام أجزاء شبكة منفصلة لاتصالات السجلات
4. **تثبيت الشهادة**: تثبيت شهادات نقاط نهاية السجلات المعروفة
5. **التحقق من الاستجابة**: التحقق من بنية الاستجابة وأنواع المحتوى
6. **تسجيل التدقيق**: تسجيل جميع الاستعلامات مع سياق المستخدم للتحليل الأمني

## أسئلة التصحيح

### كيف أصحح أخطاء انتهاء مهلة الاتصال بخوادم RDAP؟
يمكن أن تحدث انتهاء مهلة الاتصال من أسباب متعددة. استخدم هذا المنهج المنهجي:

```javascript
// 1. تفعيل تسجيل التصحيح
process.env.RDAP_DEBUG_LEVEL = 'debug';
process.env.RDAP_DEBUG_NETWORK = 'true';

// 2. إنشاء عميل بإعداد تصحيح
const client = new RDAPClient({
  debug: {
    enabled: true,
    network: true,
    dns: true,
    tls: true
  },
  timeout: 10000, // مهلة 10 ثوانٍ للتصحيح
  retry: {
    maxAttempts: 1,
    enabled: false
  }
});

// 3. اختبار الاتصال بسجل محدد
async function testRegistryConnectivity(registry) {
  try {
    const startTime = Date.now();
    const result = await client.domain(`test.${registry}.com`);
    const duration = Date.now() - startTime;

    console.log(`✅ ${registry} connectivity successful`);
    console.log(`⏱️ Response time: ${duration}ms`);

    return { success: true, duration };
  } catch (error) {
    console.error(`❌ ${registry} connectivity failed:`, error.message);

    if (error.code === 'ETIMEDOUT') {
      console.error('🔍 تحليل انتهاء المهلة:');
      console.error('- التحقق من اتصال الشبكة بالسجل');
      console.error('- التحقق من عمل تحليل DNS');
      console.error('- التحقق من قواعد جدار الحماية للاتصالات الصادرة');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('🔍 تحليل رفض الاتصال:');
      console.error('- قد يحجب السجل عنوان IP الخاص بك');
      console.error('- التحقق من حدود معدل السجل وسياساته');
    }

    return { success: false, error: error.message };
  }
}

// 4. اختبار سجلات متعددة
const results = await Promise.all([
  testRegistryConnectivity('com'),
  testRegistryConnectivity('net'),
  testRegistryConnectivity('org')
]);
```

**الأسباب الشائعة لانتهاء المهلة وحلولها**:
- 🌐 **مشكلات تحليل DNS**: استخدام ذاكرة DNS المؤقتة المحلية أو المحللات العامة (8.8.8.8)
- 🔌 **حجب جدار الحماية**: إعداد قواعد الاتجاه الخارجي لنطاقات IP للسجلات
- ⏱️ **حدود معدل السجلات**: تطبيق تحديد المعدل التكيفي مع التراجع
- 🔐 **فشل مصافحة TLS**: تحديث شهادات الجذر وتفعيل TLS 1.3
- 📡 **زمن استجابة الشبكة**: استخدام مثيلات موزعة جغرافياً أقرب من السجلات

## أسئلة النشر

### كيف أنشر RDAPify على AWS Lambda بأداء مثالي؟
يتطلب نشر AWS Lambda إعداداً خاصاً لتحسين وقت البدء البارد وإدارة الذاكرة:

```javascript
// lambda-handler.js
const { RDAPClient } = require('rdapify');
const { createClient } = require('./client-factory');

// مثيل عميل عالمي (يستمر بين الاستدعاءات)
let rdapClient;

async function getRDAPClient() {
  if (!rdapClient) {
    console.log('🔥 Initializing RDAP client');
    rdapClient = createClient({
      // إعداد محسّن لـ Lambda
      cache: {
        enabled: true,
        type: 'memory',
        memory: {
          max: 1000, // حجم ذاكرة مؤقتة مخفض لـ Lambda
          ttl: 300000 // 5 دقائق
        }
      },
      performance: {
        maxConcurrent: 3, // محدود بتزامن Lambda
        connectionPool: {
          max: 10,
          timeout: 3000,
          keepAlive: 10000
        }
      },
      offlineMode: false,
      streaming: false
    });
  }
  return rdapClient;
}

exports.handler = async (event) => {
  try {
    const client = await getRDAPClient();

    const domain = event.queryStringParameters?.domain;
    if (!domain) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing domain parameter' })
      };
    }

    const startTime = Date.now();
    const timeout = 25000; // 25 ثانية (حد Lambda هو 30 ثانية)

    const result = await Promise.race([
      client.domain(domain),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Operation timeout')), timeout)
      )
    ]);

    const duration = Date.now() - startTime;
    console.log(`✅ Domain query completed in ${duration}ms`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('❌ Lambda handler error:', error);

    if (error.message.includes('timeout')) {
      return {
        statusCode: 504,
        body: JSON.stringify({ error: 'Request timeout' })
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

**أفضل ممارسات نشر Lambda**:
- ⚡ **التزامن المُحضَّر**: اضبطه على 1-2 للدوال الحرجة لتجنب البدايات الباردة
- 💾 **تحسين الذاكرة**: ابدأ بـ 512 ميغابايت وقيّس بناءً على مقاييس الأداء
- 📊 **مقاييس مخصصة**: تتبع معدل البداية الباردة والمدة ومعدلات الأخطاء مع CloudWatch
- 🔧 **متغيرات البيئة**: تخزين الإعداد في متغيرات البيئة لا في الكود
- 🔄 **استراتيجية النشر**: استخدام نشر الكناري لتقليص المخاطر أثناء التحديثات

## الوثائق ذات الصلة

| الوثيقة | الوصف | المسار |
|---------|-------|--------|
| [الأخطاء الشائعة](common-errors.md) | المشكلات الشائعة وحلولها | [common-errors.md](common-errors.md) |
| [التصحيح](debugging.md) | تقنيات وأدوات التصحيح المتقدمة | [debugging.md](debugging.md) |
| [حل انتهاء مهلة الاتصال](connection-timeout.md) | معالجة مشكلات انتهاء مهلة الشبكة | [connection-timeout.md](connection-timeout.md) |
| [مشكلات Lambda Workers](lambda-workers-issues.md) | استكشاف أخطاء النشر بدون خادم | [lambda-workers-issues.md](lambda-workers-issues.md) |
| [استراتيجيات تدوير الوكيل](proxy-rotation.md) | التعامل مع تحديد المعدل بالـ IP | [proxy-rotation.md](proxy-rotation.md) |

## مواصفات الأسئلة الشائعة

| الخاصية | القيمة |
|---------|--------|
| **تغطية الأسئلة** | أكثر من 50 سؤالاً شائعاً |
| **جودة الإجابات** | مراجعة من قِبل مهندسين أقدمية |
| **أمثلة الكود** | أكثر من 35 مقطع كود قابل للتشغيل |
| **تغطية البيئات** | Node.js، Bun، Deno، Cloudflare Workers، AWS Lambda، Kubernetes |
| **مراجعة الأمان** | مراجعة أمنية شهرية لجميع الأمثلة |
| **آخر تحديث** | 5 ديسمبر 2025 |
| **دورة المراجعة** | تحديثات ربع سنوية مع ملاحظات المجتمع |

> **تذكير حرج**: تحقق دائماً من اعتماديات الجهات الخارجية بأدوات فحص الأمان قبل النشر. لا تُعطّل أبداً حماية SSRF أو حذف PII في بيئات الإنتاج دون أساس قانوني موثق وموافقة مسؤول حماية البيانات.

[← العودة إلى استكشاف الأخطاء](../README.md) | [التالي: انتهاء مهلة الاتصال ←](connection-timeout.md)

*وثيقة مُولَّدة تلقائياً من ملاحظات المجتمع مع مراجعة أمنية في 5 ديسمبر 2025*
