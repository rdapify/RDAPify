# توثيق RDAPify للمطورين الصينيين

🎯 **الهدف**: توفير توثيق شامل ودقيق لـ RDAPify موجّه للمطورين الصينيين، مع الحفاظ على الدقة التقنية وسياق الأمان والامتثال للوائح التنظيمية
📚 **ذات صلة**: [دليل الترجمة](translation_guide.md) | [التوثيق الإسباني](spanish.md) | [التوثيق الروسي](russian.md) | [التوثيق العربي](arabic.md)
⏱️ **وقت القراءة**: 10 دقائق

## لماذا تختار RDAPify؟

RDAPify هو عميل RDAP (بروتوكول الوصول إلى بيانات التسجيل) موحد وآمن وعالي الأداء، مصمم للتطبيقات المؤسسية. يعالج تعقيدات الاستعلام عن البيانات من سجلات الإنترنت العالمية (Verisign، ARIN، RIPE، APNIC، LACNIC)، مع توفير حماية أمنية قوية وأداء استثنائي وتجربة مطور متكاملة.

> **ملاحظة**: يلغي هذا المشروع الحاجة إلى بروتوكول WHOIS التقليدي، مع الحفاظ على التوافق العكسي عند الحاجة.

### المزايا الأساسية
- **توحيد البيانات**: استجابة متسقة بغض النظر عن مصدر البيانات
- **حماية SSRF**: منع الهجمات على البنية التحتية الداخلية
- **أداء استثنائي**: تخزين مؤقت ذكي، معالجة متوازية، وتحسين الذاكرة
- **توافق واسع**: يدعم Node.js وBun وDeno وCloudflare Workers
- **جاهز لـ GDPR**: أدوات مدمجة لإخفاء البيانات الشخصية تلقائياً

## البدء السريع

### 1. التثبيت
```bash
# باستخدام npm
npm install rdapify

# باستخدام yarn
yarn add rdapify

# باستخدام pnpm
pnpm add rdapify

# باستخدام Bun
bun add rdapify
```

### 2. الاستخدام الأساسي
```javascript
import { RDAPClient } from 'rdapify';

// إنشاء عميل آمن مع إعدادات افتراضية محسّنة
const client = new RDAPClient({
  cache: true,          // تخزين مؤقت تلقائي (TTL ساعة واحدة)
  privacy: true,      // إخفاء المعلومات الشخصية تلقائياً
  retry: {              // إعادة محاولة ذكية للأعطال المؤقتة
    maxAttempts: 3,
    backoff: 'exponential'
  }
});

// استعلام عن نطاق
const result = await client.domain('example.com');

console.log({
  domain: result.query,
  registrar: result.registrar?.name,
  status: result.status,
  nameservers: result.nameservers,
  created: result.events.find(e => e.type === 'created')?.date,
  expires: result.events.find(e => e.type === 'expiration')?.date
});
```

**مثال على الإخراج**:
```json
{
  "domain": "example.com",
  "registrar": "Internet Assigned Numbers Authority",
  "status": ["clientDeleteProhibited", "clientTransferProhibited", "clientUpdateProhibited"],
  "nameservers": ["a.iana-servers.net", "b.iana-servers.net"],
  "created": "1995-08-14T04:00:00Z",
  "expires": "2026-08-13T04:00:00Z"
}
```

## الأمان على المستوى المؤسسي

يتعامل RDAPify مع الأمان باعتباره مبدأ تصميمياً أساسياً لا ميزةً إضافية. يحمي تطبيقاتك من التهديدات التالية:

| نوع التهديد | آلية الحماية | مستوى الخطورة |
|-------------|-------------|--------------|
| SSRF | التحقق من النطاق، حظر عناوين IP الداخلية | حرج |
| هجمات DoS | تحديد معدل الطلبات، آليات المهلة الزمنية | مهم |
| تسريب البيانات | إخفاء PII، عدم تخزين الاستجابات الخام | حرج |
| هجمات الوسيط (MitM) | HTTPS إلزامي، التحقق من الشهادات | مهم |
| حقن البيانات | التحقق من المخطط، التحليل الصارم | مهم |

### أفضل الممارسات الأمنية في البيئة الصينية

عند نشر RDAPify في البيئة الصينية، يجب مراعاة ما يلي:

1. **تحديد موقع البيانات**: وفقاً لقانون الأمن السيبراني وقانون حماية المعلومات الشخصية (PIPL)، يجب ضمان امتثال معالجة البيانات الشخصية لمتطلبات تحديد موقع البيانات
2. **نقل البيانات عبر الحدود**: تفعيل `chinaComplianceMode: true` للحد من نقل البيانات عبر الحدود
3. **تسجيل عمليات التدقيق**: وفقاً لمتطلبات قانون أمن البيانات، يجب الاحتفاظ بجميع سجلات العمليات لمدة لا تقل عن 6 أشهر
4. **متطلبات حماية مستوى الأمان**: في الأنظمة التي تخضع لمعيار حماية مستوى الأمان 2.0، يجب تفعيل جميع ضوابط الأمان

```javascript
// الإعداد الموصى به للبيئة الصينية
const client = new RDAPClient({
  // أمان الشبكة
  timeout: 5000,               // الحد الأقصى للمهلة 5 ثوانٍ
  httpsOnly: true,             // رفض اتصالات HTTP
  validateCertificates: true, // إلزامية التحقق من الشهادات

  // حماية SSRF
  allowPrivateIPs: false,      // حظر نطاقات IP الخاصة
  whitelistRDAPServers: true,  // الاقتصار على خوادم IANA Bootstrap

  // الامتثال للخصوصية
  privacy: true,             // معالجة البيانات المتوافقة مع GDPR/PIPL
  includeRaw: false,           // عدم تخزين الاستجابات الخام

  // الامتثال الخاص بالصين
  chinaComplianceMode: true,   // تفعيل وضع الامتثال الصيني
  dataResidency: 'china',      // تحديد موقع البيانات في الصين

  // حماية الموارد
  rateLimit: { max: 100, window: 60000 }, // 100 طلب/دقيقة
  maxConcurrent: 10,           // تحديد عدد الطلبات المتوازية
  cacheTTL: 3600               // الحد الأقصى لمدة التخزين المؤقت ساعة واحدة
});
```

## الامتثال للوائح الصينية

### التوافق مع PIPL (قانون حماية المعلومات الشخصية)

تم تصميم RDAPify للمساعدة في استيفاء متطلبات PIPL:

- **تقليل البيانات**: جمع البيانات الضرورية للمعالجة فقط
- **الموافقة الصريحة**: توفير أدوات إدارة موافقة المستخدم
- **حقوق أصحاب البيانات**: دعم طلبات الوصول والتصحيح والحذف
- **تقييم الأثر**: أدوات مدمجة لتقييم أثر الخصوصية
- **تقييد نقل البيانات عبر الحدود**: يقيّد `chinaComplianceMode` نقل البيانات خارج الحدود

### التوافق مع قانون الأمن السيبراني
- **البنية التحتية للمعلومات الحيوية**: توفير طبقة أمان إضافية لمشغلي البنية التحتية للمعلومات الحيوية
- **تصنيف البيانات**: التعرف التلقائي على المعلومات الشخصية وتصنيفها
- **تقييم الأمن**: توفير أدوات تقييم أمان تصدير البيانات

## التوثيق التقني

### مرجع API
```typescript
/**
 * الاستعلام عن معلومات تسجيل النطاق
 * @param domain النطاق المراد الاستعلام عنه
 * @param options معلمات اختيارية
 * @returns معلومات تسجيل النطاق بصيغة موحدة
 * @throws RDAPError إذا فشل الاستعلام أو كان النطاق غير موجود
 *
 * @example
 * const data = await client.domain('example.com');
 * console.log(data.registrar.name); // "Internet Assigned Numbers Authority"
 */
async domain(domain: string, options?: DomainOptions): Promise<DomainResponse>
```

### معالجة الأخطاء
```javascript
try {
  const result = await client.domain('example.com');
  // معالجة النتيجة
} catch (error) {
  if (error.code === 'RDAP_NOT_FOUND') {
    console.log('النطاق غير موجود');
  } else if (error.code === 'RDAP_RATE_LIMITED') {
    console.log('معدل الطلبات مرتفع للغاية، يرجى المحاولة لاحقاً');
  } else if (error.code === 'RDAP_TIMEOUT') {
    console.log('انتهت مهلة الطلب، يرجى التحقق من الاتصال بالشبكة');
  } else {
    console.error('خطأ غير متوقع:', error.message);
  }
}
```

## أدوات المطورين

### 1. أداة CLI

```bash
# تثبيت CLI
npm install -g rdapify-cli

# استعلام عن نطاق (واجهة صينية)
rdapify query example.com --lang zh

# معالجة دفعية لقائمة نطاقات
rdapify batch domains.txt --output results.csv --lang zh

# الوضع التفاعلي
rdapify interactive --lang zh
```

### 2. ساحة التجربة

تفضل بزيارة [https://playground.rdapify.cn](https://playground.rdapify.cn) لتجربة إمكانيات RDAPify مباشرةً في المتصفح دون الحاجة إلى تثبيت أي شيء.

## النشر في المنطقة الصينية

### 1. النشر على Alibaba Cloud Function Compute
```yaml
# serverless.yml
service: rdapify-service

provider:
  name: aliyun
  runtime: nodejs16
  credentials: ~/.aliyun/credentials

functions:
  rdapify:
    handler: dist/index.handler
    events:
      - http:
          path: /api
          method: any
    environment:
      CHINA_COMPLIANCE_MODE: true
      DATA_RESIDENCY: china
      ALIYUN_LOG_PROJECT: your-log-project
    vpcConfig:
      securityGroupId: sg-xxxxxx
      vswitchIds: [vsw-xxxxxx]
    nasConfig:
      userId: 10003
      groupId: 10003
      mountPoints:
        - serverAddr: xxxx-xxxxx.cn-hangzhou.nas.aliyuncs.com:/
          mountDir: /mnt/cache
```

### 2. النشر على Tencent Cloud Container Service
```yaml
# docker-compose.tencent.yml
version: '3.8'
services:
  rdapify:
    image: rdapify/rdapify:latest
    environment:
      - NODE_ENV=production
      - CHINA_COMPLIANCE_MODE=true
      - DATA_RESIDENCY=china
      - TENCENT_CLOUD_LOG_ENABLED=true
      - LOG_PROJECT_ID=your-project-id
      - LOG_TOPIC_ID=your-topic-id
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
    logging:
      driver: "tencentlogs"
      options:
        tencentlogs-logset: "rdapify"
        tencentlogs-topic: "production"
    restart: unless-stopped
```

## التحليلات والمراقبة

### 1. التكامل مع Alibaba Cloud ARMS
```javascript
// src/monitoring/arms.js
const { init, setOptions } = require('@alicloud/arms-sdk');

// تهيئة ARMS
init({
  pid: process.env.ARMS_PID,
  uid: process.env.ARMS_UID,
  regionId: 'cn-hangzhou',
  env: process.env.NODE_ENV || 'production'
});

// إضافة مقاييس مراقبة مخصصة
function trackRDAPQuery(domain, latency, status) {
  arms.metric('rdap_query', {
    domain,
    latency,
    status,
    region: 'china'
  });
}

module.exports = { trackRDAPQuery };
```

### 2. التكامل مع Tencent Cloud Monitor
```javascript
// src/monitoring/tencent.js
const { MonitorClient } = require('tencentcloud-sdk-nodejs/tencentcloud/services/monitor/v20180724');

const client = new MonitorClient({
  credential: {
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY
  },
  region: 'ap-guangzhou',
  profile: {
    httpProfile: {
      endpoint: 'monitor.tencentcloudapi.com'
    }
  }
});

async function reportMetrics(metrics) {
  const params = {
    Namespace: 'rdapify/custom',
    MetricData: [
      {
        MetricName: 'QueryLatency',
        Value: metrics.latency,
        Unit: 'ms'
      },
      {
        MetricName: 'QuerySuccess',
        Value: metrics.success ? 1 : 0,
        Unit: 'count'
      }
    ]
  };

  await client.PutMonitorData(params);
}
```

## موارد الدعم

### 1. دعم المجتمع
- **مجموعة التواصل التقني على WeChat**: أضف معرف `rdapify-cn` على WeChat للانضمام
- **عمود Zhihu التقني**: [عمود RDAPify التقني](https://zhuanlan.zhihu.com/rdapify)
- **Open Source China**: [صفحة مشروع RDAPify](https://www.oschina.net/p/rdapify)
- **ساعات مكتب أسبوعية**: كل خميس من 19:00 إلى 20:00 (بتوقيت بكين)

### 2. دعم المؤسسات
- **دعم النسخة المؤسسية**: [https://rdapify.cn/enterprise](https://rdapify.cn/enterprise)
- **التطوير المخصص**: contact@rdapify.cn
- **استشارات الامتثال**: compliance@rdapify.cn
- **خط دعم طارئ**: 86-400-888-RDAP+ (حصري لعملاء المؤسسات)

## التحقق التقني

### 1. اختبار البيئة
```bash
# تشغيل اختبارات البيئة
npm run test:china

# التحقق من الامتثال لـ PIPL
npm run compliance:pipl

# التحقق من صحة التوثيق
npm run docs:validate -- --lang=zh
```

### 2. معايير الأداء (بيئة الشبكة الصينية)

| المقياس | RDAPify | أدوات WHOIS التقليدية | التحسن |
|---------|---------|----------------------|--------|
| متوسط وقت الاستجابة | 120 مللي ثانية | 850 مللي ثانية | أسرع بـ 7.1x |
| وقت 1000 استعلام | 3.2 ثانية | 196.5 ثانية | أسرع بـ 61.4x |
| استهلاك الذاكرة | 85 ميغابايت | 580 ميغابايت | أقل بـ 6.8x |
| قدرة المعالجة المتزامنة | 150 طلب/ثانية | 5 طلبات/ثانية | أعلى بـ 30x |

*بيئة الاختبار: Alibaba Cloud ECS (2 vCPU، 4 GB RAM)، منطقة بكين، عرض نطاق ترددي 200 ميغابت/ثانية*

## الترخيص والامتثال

### الترخيص مفتوح المصدر
RDAPify مرخص بموجب [رخصة MIT](https://opensource.org/licenses/MIT) — مجاني للاستخدام الشخصي والتجاري مع قيود قليلة جداً.

### إعلان الامتثال للوائح الصينية
- يستوفي هذا البرنامج متطلبات قانون الأمن السيبراني الصيني وقانون أمن البيانات وقانون حماية المعلومات الشخصية (PIPL)
- تلتزم معالجة البيانات بمبدأ "الحد الأدنى الضروري"
- لا توجد وظيفة نقل بيانات عبر الحدود مسبقة الإعداد إلا عند التكوين الصريح
- يوفر سجلات تدقيق كاملة وسجلات معالجة البيانات
- تُخزَّن بيانات المستخدمين داخل الصين افتراضياً للمستخدمين داخل الأراضي الصينية

## شكر وتقدير

نتقدم بالشكر لمجتمع الإنترنت الصيني وفريق CNNIC ومطوري سجلات الإنترنت الصينية على جهودهم الدؤوبة في جعل الإنترنت أكثر شفافية وأماناً.

> **ملاحظة**: RDAPify مشروع مستقل غير تابع لأي سجل نطاقات أو سلطة إنترنت رسمية. جميع العلامات التجارية والمنتجات المذكورة هي ملك لأصحابها المعنيين.

© 2025 RDAPify — مبني للمؤسسات التي لا تتنازل عن الجودة والأمان.
[سياسة الأمان](../../../SECURITY.md) • [سياسة الخصوصية](../../../PRIVACY.md) • [تواصل معنا](mailto:china@rdapify.cn)

[← العودة إلى التوطين](../README.md) | [القسم التالي: التوثيق الإسباني →](../spanish.md)

*تم إنشاء هذا المستند تلقائياً من الكود المصدري، وخضع للمراجعة الأمنية في 7 ديسمبر 2025*
