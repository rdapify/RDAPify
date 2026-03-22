# مسار تعلم RDAPify

> **الهدف:** إتقان RDAPify من الأساسيات إلى أنماط التطبيق المتقدمة
> **الوقت الإجمالي:** 8-12 ساعة (وفق وتيرتك الخاصة)
> **المتطلبات الأساسية:** معرفة أساسية بـ JavaScript/TypeScript وفهم مفاهيم تسجيل النطاقات
> **نصيحة:** اتبع المراحل مع [بيئة اللعب التفاعلية](../playground/overview.md) أثناء تقدمك في كل وحدة

---

## المستوى الأول: الأسس (2-3 ساعات)

### إتقان المفاهيم الأساسية
- [ ] **ما هو RDAP؟**
  [المفاهيم الأساسية: ما هو RDAP](../core-concepts/what-is-rdap.md)
  *فهم أساسيات بروتوكول RDAP، وفوائده على WHOIS، وهياكل البيانات القياسية*

- [ ] **التصميم المراعي للخصوصية**
  [الأمان: ضوابط الخصوصية](../api-reference/privacy-controls.md)
  *تعلُّم كيفية تطبيق RDAPify للامتثال مع GDPR/CCPA من خلال حجب البيانات الشخصية تلقائيًا*

- [ ] **نظرة عامة على البنية المعمارية**
  [المفاهيم الأساسية: البنية المعمارية](../core-concepts/architecture.md)
  *دراسة البنية المعمارية المطبَّقة على شكل طبقات مع مخططات Mermaid توضح تدفق البيانات*

### أول مشروع عملي
```javascript
// أكمل تمرين "البدء السريع في 5 دقائق"
// https://rdapify.dev/docs/getting-started/five-minutes
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({ privacy: true });
const result = await client.domain('example.com');
console.log(result);
```

✅ **نقطة تحقق المستوى الأول:** يمكنك استعلام بيانات النطاق مع حمايات الخصوصية وشرح البنية المعمارية الأساسية.

---

## المستوى الثاني: أنماط التطبيق (3-4 ساعات)

### المهارات الأساسية
- [ ] **معالجة الأخطاء**
  [الأدلة: معالجة الأخطاء](../guides/error-handling.md)
  *إتقان آلة حالة الخطأ وتطبيق استعلامات RDAP مرنة*

- [ ] **استراتيجيات التخزين المؤقت**
  [الأدلة: استراتيجيات التخزين المؤقت](../guides/caching-strategies.md)
  *تهيئة التخزين المؤقت في الذاكرة والتخزين المؤقت الدائم مع مدة صلاحية وتشفير مناسبين*

- [ ] **تحديد المعدل والامتثال مع السجل**
  [الأدلة: تحديد المعدل](../guides/rate-limiting.md)
  *تطبيق أنماط الاستعلام الصديقة للسجل وآليات الرجوع*

### التطبيق العملي
```javascript
// بناء خدمة مراقبة النطاقات
import { RDAPClient, RedisAdapter } from 'rdapify';

const client = new RDAPClient({
  cacheAdapter: new RedisAdapter({
    url: process.env.REDIS_URL,
    encryptionKey: process.env.CACHE_KEY,
    redactBeforeStore: true
  }),
  retry: { maxAttempts: 3 },
  backoff: 'exponential'
});

async function monitorDomains(domains) {
  const results = {};
  for (const domain of domains) {
    try {
      results[domain] = await client.domain(domain);
    } catch (error) {
      results[domain] = { error: error.message };
    }
  }
  return results;
}
```

✅ **نقطة تحقق المستوى الثاني:** يمكنك بناء خدمة مراقبة نطاقات مرنة مع تخزين مؤقت صحيح ومعالجة أخطاء مناسبة.

---

## المستوى الثالث: التطبيقات المتقدمة (3-5 ساعات)

### المعرفة المتخصصة
- [ ] **الكشف عن الشذوذات**
  [التحليلات: الكشف عن الشذوذات](../analytics/anomaly-detection.md)
  *تطبيق التعرف على الأنماط لأنشطة تسجيل النطاقات المشبوهة*

- [ ] **البنية المعمارية متعددة المستأجرين**
  [المؤسسات: متعدد المستأجرين](../enterprise/multi-tenant.md)
  *تصميم استراتيجيات عزل البيانات لتطبيقات SaaS*

- [ ] **التعيير المخصص**
  [متقدم: معيِّر مخصص](../advanced/custom-normalizer.md)
  *توسيع خط أنابيب التعيير للاستجابات المتخصصة من السجلات*

### مشروع على مستوى المؤسسات
```javascript
// إنشاء لوحة امتثال مع رسم خرائط العلاقات
import { RDAPClient, RelationshipMapper } from 'rdapify';

const client = new RDAPClient({
  privacy: true,
  customNormalizer: myOrganizationNormalizer
});

const mapper = new RelationshipMapper({
  dataRetentionDays: 30,
  maxRelationshipDepth: 3
});

async function generateComplianceReport(domains) {
  const entities = await Promise.all(domains.map(d => client.domain(d)));

  // رسم خرائط العلاقات بين النطاقات وأصحابها
  const report = mapper.createRelationshipGraph(entities);

  // الكشف عن الشذوذات في أنماط التسجيل
  const anomalies = mapper.detectAnomalies(report);

  return {
    timestamp: new Date().toISOString(),
    domainsAnalyzed: domains.length,
    relationships: report.relationships,
    anomalies,
    complianceScore: calculateComplianceScore(anomalies)
  };
}
```

✅ **نقطة تحقق المستوى الثالث:** يمكنك تصميم وتطبيق تطبيقات على مستوى المؤسسات مع تقارير الامتثال وتحليل العلاقات.

---

## مصفوفة موارد التعلم

| الموضوع | مبتدئ | متوسط | متقدم |
|-------|----------|--------------|----------|
| **المفاهيم الأساسية** | [ما هو RDAP](../core-concepts/what-is-rdap.md) | [RDAP مقابل WHOIS](../core-concepts/rdap-vs-whois.md) | [مواصفات RFC](../specifications/rdap-rfc.md) |
| **البنية المعمارية** | [نظرة عامة](../core-concepts/architecture.md) | [تدفق البيانات](../architecture/data-flow.md) | [بنية الإضافات](../architecture/plugin-architecture.md) |
| **الخصوصية والأمان** | [ضوابط الخصوصية](../api-reference/privacy-controls.md) | [الوقاية من SSRF](../security/ssrf-prevention.md) | [الحجب المخصص](../security/custom-redaction.md) |
| **الأداء** | [أساسيات التخزين المؤقت](../core-concepts/caching.md) | [استراتيجيات التخزين المؤقت](../guides/caching-strategies.md) | [التخزين المؤقت الجغرافي](../guides/geo-caching.md) |
| **المؤسسات** | [استخدام CLI](../cli/commands.md) | [تكاملات المراقبة](../integrations/monitoring/datadog.md) | [دعم SLA](../enterprise/sla-support.md) |

---

## التمارين العملية

### التمرين الأول: محلل محفظة النطاقات (مبتدئ)
```markdown
**الهدف:** بناء أداة تحلل قائمة نطاقات وتُبلِّغ عن:
- تواريخ التسجيل
- حالة انتهاء الصلاحية
- توزيع جهات التسجيل
- اتساق خوادم الأسماء

**المتطلبات:**
- التطبيق مع تفعيل حجب البيانات الشخصية
- إضافة تخزين مؤقت بمدة صلاحية ساعة واحدة
- إخراج النتائج بتنسيق JSON
- التعامل مع 10 نطاقات على الأقل مع مرونة في مواجهة الأخطاء

**الموارد:**
- [دليل الاستعلام الأول](./first-query.md)
- [دليل المعالجة المجمَّعة](../guides/batch-processing.md)
```

### التمرين الثاني: مراقب الامتثال (متوسط)
```markdown
**الهدف:** إنشاء نظام يراقب النطاقات لمشكلات الامتثال مع GDPR:
- الكشف عن النطاقات التي تحتوي على بيانات شخصية في السجلات العامة
- التنبيه عند احتمال انتهاك سياسات الاحتفاظ بالبيانات
- إنشاء تقارير امتثال أسبوعية

**المتطلبات:**
- تطبيق تخزين Redis المؤقت مع التشفير في حالة السكون
- إعداد جدولة التنفيذ (cron أو جدول السحابة)
- إنشاء نظام إشعارات بريد إلكتروني للشذوذات
- تضمين تسجيل التدقيق لجميع عمليات الوصول إلى البيانات

**الموارد:**
- [دليل الكشف عن الشذوذات](../analytics/anomaly-detection.md)
- [التقارير المجدوَلة](../analytics/scheduled-reporting.md)
- [تسجيل التدقيق](../enterprise/audit-logging.md)
```

### التمرين الثالث: وكيل سجل المؤسسات (متقدم)
```markdown
**الهدف:** تصميم خدمة وكيل آمنة توفر:
- وصولًا موحدًا لـ RDAP عبر سجلات متعددة
- عزل المستأجرين للنشر متعدد المستأجرين
- تطبيق سياسات الامتثال المخصصة لكل عميل
- تحليلات استخدام مفصَّلة وإدارة الحصص

**المتطلبات:**
- تطبيق بنية معمارية للإضافات للسياسات المخصصة
- إضافة نظام تحديد أولويات الطلبات
- إنشاء لوحة بيانات مع رسم خرائط العلاقات
- التصميم للتوسع الأفقي في Kubernetes
- تضمين مسارات تدقيق شاملة

**الموارد:**
- [دليل نظام الإضافات](../advanced/plugin-system.md)
- [النشر على Kubernetes](../integrations/cloud/kubernetes.md)
- [رسم خرائط العلاقات](../analytics/relationship-mapping.md)
- [أنماط عزل البيانات](../advanced/data-isolation.md)
```

---

## مسار التعلم المستمر

### مشاركة المجتمع
- [ ] الانضمام إلى [ساعات المكتب الأسبوعية](https://rdapify.dev/community/office-hours) (أيام الخميس الساعة 2 مساءً UTC)
- [ ] المشاركة في [نقاشات GitHub](https://github.com/rdapify/rdapify/discussions)
- [ ] المساهمة في تحسينات التوثيق
- [ ] مشاركة حالات الاستخدام في [مركز المجتمع](../community/events.md)

### موارد الدراسة المتقدمة
- [ ] **غوص عميق في RFC:** دراسة سلسلة [RFC 7480](https://tools.ietf.org/html/rfc7480)
- [ ] **الورقة البيضاء للأمان:** مراجعة [نموذج التهديد](../security/threat-model.md)
- [ ] **معايير الأداء:** تحليل [نتائج المعايير](../../benchmarks/results/throughput.md)
- [ ] **أنماط المؤسسات:** قراءة [دليل التبني](../enterprise/adoption-guide.md)

### مسار الاعتماد المهني
للراغبين في الاعتراف الرسمي:
1. **RDAPify Associate** - إكمال جميع وحدات المبتدئين والتمارين
2. **RDAPify Professional** - إكمال وحدات المستوى المتوسط وبناء مشروعين
3. **RDAPify Enterprise Architect** - إكمال الوحدات المتقدمة وتصميم حل مؤسسي

---

## نصائح للتعلم المتسارع

### إعداد بيئة التطوير
```bash
# استنساخ مستودع الأمثلة
git clone https://github.com/rdapify/examples.git
cd examples

# تثبيت التبعيات
npm install

# تشغيل بيئة اللعب التفاعلية
npm run playground
```

### التصحيح كالمحترفين
1. تفعيل التسجيل التفصيلي: `RDAP_DEBUG=full`
2. استخدام [المصحح البصري](../playground/visual-debugger.md) لتحليل الاستجابات
3. تفعيل وضع الاختبار لاستخدام استجابات وهمية: `RDAP_ENV=test`
4. رصد اختناقات الأداء بالمقاييس المدمجة

### الأخطاء الشائعة التي يجب تجنبها
- تعطيل حجب البيانات الشخصية دون أساس قانوني
- تجاهل حدود معدل السجل
- تخزين استجابات RDAP الخام دون تشفير
- استخدام مدة صلاحية التخزين المؤقت الافتراضية للنطاقات الحساسة
- تجاوز حمايات SSRF في طالبي البيانات المخصصين

---

## الخطوات التالية

بعد إكمال مسار التعلم هذا، ستكون جاهزًا لـ:

- [ ] **المساهمة في RDAPify**
  [دليل المساهمة](../../CONTRIBUTING.md) - المساعدة في تحسين المكتبة

- [ ] **بناء تطبيقات للإنتاج**
  [قائمة مراجعة الإنتاج](./production-checklist.md) - ضمان جاهزية تطبيقك للمؤسسات

- [ ] **التخصص في الامتثال**
  [امتثال المؤسسات](../enterprise/) - التركيز على المتطلبات التنظيمية

- [ ] **تحسين الأداء**
  [أدلة الأداء](../performance/) - إتقان النشر عالي الإنتاجية

---

> **تذكير الخصوصية والأمان:** أثناء تقدمك في وحدات التعلم، تذكر أن بيانات RDAP غالبًا ما تحتوي على معلومات شخصية. حافظ دائمًا على مبادئ الخصوصية الافتراضية، حتى في بيئات التطوير. عند الشك، أبقِ `privacy: true` مفعَّلًا.

[← العودة إلى البدء](./README.md) | [التالي: قائمة مراجعة الإنتاج ←](./production-checklist.md)

*آخر تحديث للوثيقة: 5 ديسمبر 2025*
*إصدار RDAPify المستخدم في الأمثلة: 2.3.0*
