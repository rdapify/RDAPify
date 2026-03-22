# دليل المعالجة الدُفعية

تتيح المعالجة الدُفعية الاستعلام الفعّال عن نطاقات متعددة وعناوين IP وأرقام ASN بصورة متوازية مع التحكم في مستوى التزامن.

## نظرة عامة

يوفر BatchProcessor ما يلي:
- معالجة متزامنة مع حدود قابلة للضبط
- استراتيجيات معالجة الأخطاء
- تتبع التقدم
- إحصائيات الأداء

## الاستخدام الأساسي

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();
const batchProcessor = client.getBatchProcessor();

// معالجة استعلامات متعددة
const results = await batchProcessor.processBatch([
  { type: 'domain', query: 'example.com' },
  { type: 'domain', query: 'google.com' },
  { type: 'ip', query: '8.8.8.8' },
  { type: 'asn', query: 15169 }
]);

// فحص النتائج
results.forEach(result => {
  if (result.error) {
    console.error(`Failed: ${result.query}`, result.error.message);
  } else {
    console.log(`Success: ${result.query}`, result.result);
  }
});
```

## خيارات الضبط

```typescript
interface BatchOptions {
  /** الحد الأقصى للطلبات المتزامنة (الافتراضي: 5) */
  concurrency?: number;

  /** الاستمرار عند الخطأ أو الإيقاف (الافتراضي: true) */
  continueOnError?: boolean;

  /** مهلة الدُفعة بأكملها بالملي ثانية */
  timeout?: number;
}
```

## الاستخدام المتقدم

### التحكم في التزامن

```typescript
// معالجة 10 استعلامات في آنٍ واحد
const results = await batchProcessor.processBatch(queries, {
  concurrency: 10
});

// معالجة واحدة تلو الأخرى (تسلسلية)
const results = await batchProcessor.processBatch(queries, {
  concurrency: 1
});
```

### معالجة الأخطاء

```typescript
// الإيقاف عند أول خطأ
const results = await batchProcessor.processBatch(queries, {
  continueOnError: false
});

// الاستمرار حتى لو فشل بعضها
const results = await batchProcessor.processBatch(queries, {
  continueOnError: true
});
```

### مع مهلة زمنية

```typescript
// انتهاء المهلة بعد 30 ثانية
const results = await batchProcessor.processBatchWithTimeout(
  queries,
  30000,  // 30 ثانية
  { concurrency: 5 }
);
```

## تحليل النتائج

```typescript
const results = await batchProcessor.processBatch(queries);

// الحصول على الإحصائيات
const stats = batchProcessor.analyzeBatchResults(results);

console.log('Total queries:', stats.total);
console.log('Successful:', stats.successful);
console.log('Failed:', stats.failed);
console.log('Success rate:', stats.successRate + '%');
console.log('Average duration:', stats.averageDuration + 'ms');
console.log('Total duration:', stats.totalDuration + 'ms');
```

## أمثلة عملية

### مراقبة محفظة النطاقات

```typescript
async function monitorDomains(domains: string[]) {
  const client = new RDAPClient();
  const batchProcessor = client.getBatchProcessor();

  const queries = domains.map(domain => ({
    type: 'domain' as const,
    query: domain
  }));

  const results = await batchProcessor.processBatch(queries, {
    concurrency: 10,
    continueOnError: true
  });

  // البحث عن النطاقات التي توشك على الانتهاء
  const expiring = results
    .filter(r => !r.error && r.result)
    .map(r => {
      const expiryEvent = r.result!.events?.find(e => e.type === 'expiration');
      if (expiryEvent) {
        const daysUntilExpiry = Math.floor(
          (new Date(expiryEvent.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return { domain: r.query, daysUntilExpiry };
      }
      return null;
    })
    .filter(d => d && d.daysUntilExpiry < 30);

  return expiring;
}
```

### تحليل نطاق IP

```typescript
async function analyzeIPRange(startIP: string, count: number) {
  const client = new RDAPClient();
  const batchProcessor = client.getBatchProcessor();

  // توليد استعلامات IP
  const queries = [];
  const baseIP = startIP.split('.').map(Number);

  for (let i = 0; i < count; i++) {
    const ip = [...baseIP];
    ip[3] = (ip[3] + i) % 256;
    queries.push({
      type: 'ip' as const,
      query: ip.join('.')
    });
  }

  const results = await batchProcessor.processBatch(queries, {
    concurrency: 5,
    continueOnError: true
  });

  // التجميع حسب الدولة
  const byCountry = results
    .filter(r => !r.error && r.result)
    .reduce((acc, r) => {
      const country = r.result!.country || 'Unknown';
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  return byCountry;
}
```

### اكتشاف أرقام ASN

```typescript
async function discoverASNs(startASN: number, count: number) {
  const client = new RDAPClient();
  const batchProcessor = client.getBatchProcessor();

  const queries = Array.from({ length: count }, (_, i) => ({
    type: 'asn' as const,
    query: startASN + i
  }));

  const results = await batchProcessor.processBatch(queries, {
    concurrency: 10,
    continueOnError: true
  });

  // استخراج أرقام ASN النشطة
  const active = results
    .filter(r => !r.error && r.result)
    .map(r => ({
      asn: r.query,
      name: r.result!.name,
      country: r.result!.country
    }));

  return active;
}
```

## تحسين الأداء

### التزامن المثالي

```typescript
// منخفض جداً: معالجة بطيئة
const results = await batchProcessor.processBatch(queries, {
  concurrency: 1  // تسلسلي
});

// مثالي: توازن بين السرعة واستهلاك الموارد
const results = await batchProcessor.processBatch(queries, {
  concurrency: 5  // موصى به
});

// مرتفع جداً: قد يُحدث تجاوزاً لحدود المعدل أو يُثقل الخادم
const results = await batchProcessor.processBatch(queries, {
  concurrency: 50  // محفوف بالمخاطر
});
```

### مع التخزين المؤقت

```typescript
const client = new RDAPClient({
  cache: {
    strategy: 'memory',
    ttl: 3600  // ساعة واحدة
  }
});

// الدُفعة الأولى: تجلب من الخوادم
const results1 = await batchProcessor.processBatch(queries);

// الدُفعة الثانية: تستخدم التخزين المؤقت (أسرع بكثير)
const results2 = await batchProcessor.processBatch(queries);
```

### تتبع التقدم

```typescript
async function processBatchWithProgress(queries: any[]) {
  const results: any[] = [];
  let completed = 0;

  // معالجة على دفعات صغيرة
  const chunkSize = 10;
  for (let i = 0; i < queries.length; i += chunkSize) {
    const chunk = queries.slice(i, i + chunkSize);
    const chunkResults = await batchProcessor.processBatch(chunk);
    results.push(...chunkResults);

    completed += chunk.length;
    console.log(`Progress: ${completed}/${queries.length} (${Math.round(completed / queries.length * 100)}%)`);
  }

  return results;
}
```

## التعافي من الأخطاء

### إعادة محاولة الاستعلامات الفاشلة

```typescript
async function processBatchWithRetry(queries: any[], maxRetries = 3) {
  let results = await batchProcessor.processBatch(queries, {
    continueOnError: true
  });

  // إعادة محاولة الاستعلامات الفاشلة
  for (let retry = 0; retry < maxRetries; retry++) {
    const failed = results
      .filter(r => r.error)
      .map(r => ({ type: r.type, query: r.query }));

    if (failed.length === 0) break;

    console.log(`Retrying ${failed.length} failed queries (attempt ${retry + 1})`);

    const retryResults = await batchProcessor.processBatch(failed, {
      continueOnError: true
    });

    // تحديث النتائج
    retryResults.forEach(retryResult => {
      const index = results.findIndex(
        r => r.type === retryResult.type && r.query === retryResult.query
      );
      if (index !== -1) {
        results[index] = retryResult;
      }
    });
  }

  return results;
}
```

## أفضل الممارسات

1. **اختر التزامن المناسب**: ابدأ بـ 5 وعدّل بناءً على الأداء
2. **فعّل التخزين المؤقت**: يُقلل الاستعلامات المتكررة
3. **تعامل مع الأخطاء بسلاسة**: استخدم `continueOnError: true` للدُفعات الكبيرة
4. **راقب التقدم**: للدُفعات طويلة التشغيل
5. **طبّق منطق إعادة المحاولة**: للأعطال العابرة
6. **احترم حدود المعدل**: لا ترفع مستوى التزامن كثيراً

## انظر أيضاً

- [دليل تحديد المعدل](./rate-limiting.md)
- [استراتيجيات التخزين المؤقت](./caching-strategies.md)
- [دليل الأداء](./performance.md)
