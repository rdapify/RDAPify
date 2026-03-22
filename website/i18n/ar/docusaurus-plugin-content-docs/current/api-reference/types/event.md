# النوع `Event`

مرجع كامل للواجهة `Event` التي تمثّل أحداث دورة حياة RDAP المُطبَّعة مع البيانات الوصفية الزمنية.

**ذو صلة:** [DomainResponse](domain-response.md) | [IPResponse](ip-response.md) | [ASNResponse](asn-response.md)

---

## تعريف النوع

```typescript
interface Event {
  // Core event identification
  action: 'registration' | 'last changed' | 'expiration' | 'deletion' |
          'delegation' | 'reassignment' | 'transfer' | 'renewal';

  // Temporal metadata
  date: string;          // ISO 8601 timestamp (e.g., '2023-08-14T07:01:44Z')
  timestamp: number;     // Unix timestamp in milliseconds
  precision: 'exact' | 'day' | 'month' | 'year' | 'unknown';

  // Actor information
  actor?: {
    handle: string;      // Entity handle performing the action
    name?: string;       // Entity name (redacted by default)
    type?: 'registrar' | 'registrant' | 'system' | 'unknown';
  };

  // Additional event metadata
  attributes: {
    [key: string]: any;  // Registry-specific event attributes
  };

  // Security and compliance metadata
  _meta: {
    source: string;      // Source registry (e.g., 'verisign', 'arin')
    verified: boolean;   // Whether event was verified by registry
    confidence: number;  // 0.0-1.0 confidence in event accuracy
    redacted: boolean;   // Whether actor data was redacted
  };
}
```

---

## مرجع الخصائص

### خصائص الحدث الأساسية

| الخاصية | النوع | مطلوبة | الوصف | أمثلة |
|----------|------|---------|-------|-------|
| `action` | `string` | نعم | نوع الحدث الموحَّد | `'registration'`، `'last changed'`، `'expiration'` |
| `date` | `string` | نعم | طابع زمني بتنسيق ISO 8601 | `'2023-08-14T07:01:44Z'`، `'2023-08-14'` |
| `timestamp` | `number` | نعم | طابع زمني Unix بالميلي ثانية | `1692000104000` |
| `precision` | `string` | نعم | مستوى الدقة الزمنية | `'exact'`، `'day'`، `'month'`، `'year'`، `'unknown'` |

### خصائص المُنفِّذ

```typescript
actor?: {
  handle: string;        // Registry identifier for the actor
  name?: string;         // Human-readable name (redacted by default)
  type?: 'registrar' | 'registrant' | 'system' | 'unknown';
}
```

**أنواع المُنفِّذ وقواعد الإخفاء:**
- `registrar`: قد يُحفظ اسم المشغِّل في السجل
- `registrant`: تُخفى أسماء الأفراد دائماً؛ قد تُحفظ أسماء المنظمات
- `system`: أحداث النظام التلقائية (لا حاجة للإخفاء)
- `unknown`: نوع مُنفِّذ غير محدَّد (إخفاء كامل)

### سمات الحدث

البيانات الوصفية الخاصة بالسجل مُخزَّنة في كائن مرن:

```typescript
attributes: {
  // ARIN-specific attributes
  reassignmentType?: 'full' | 'partial';
  sourceRegistry?: string;

  // Verisign-specific attributes
  gracePeriod?: boolean;
  redemptionPeriod?: boolean;

  // RIPE NCC-specific attributes
  authInfo?: string; // REDACTED by default
  transferStatus?: 'pending' | 'completed' | 'rejected';
}
```

### خصائص البيانات الوصفية

```typescript
_meta: {
  source: string;        // Origin registry identifier
  verified: boolean;     // Event verification status
  confidence: number;    // Accuracy confidence score (0.0-1.0)
  redacted: boolean;     // Actor data redaction status
  registrySpecificType?: string; // Original registry event type
}
```

---

## الخصوصية والأمان

### بيانات الأحداث الحساسة

يمكن أن تحتوي الأحداث على معلومات حساسة حول تغييرات دورة حياة النطاق والشبكة.

**قواعد الإخفاء للأحداث:**
- **أسماء المُنفِّذين** ← `REDACTED` ما لم يكن اسم منظمة
- **معلومات المصادقة** ← مُخفاة دائماً بصرف النظر عن السياق
- **مقابض جهات الاتصال** ← تُحفظ فقط عند الضرورة للعمليات التقنية
- **عناوين IP** ← مُخفاة في سمات الأحداث

### حالات الاستخدام الأمني

تُوفِّر الأحداث بيانات حيوية لـ:
- **رصد انتهاء النطاقات** — اكتشاف النطاقات الحرجة المنتهية صلاحيتها
- **كشف التغييرات** — رصد التعديلات المشبوهة على بيانات التسجيل
- **تتبع النقل** — مراقبة نقل النطاقات/أرقام ASN بين الكيانات
- **كشف الاحتيال** — تحديد أنماط التسجيل والنقل السريع

**تنبيه أمني:** يمكن أن تكشف الطوابع الزمنية للأحداث عن أنماط تغيير البنية التحتية التي قد يستغلها المهاجمون. طبِّق دائماً تحديد المعدل وضوابط الوصول للوصول إلى بيانات الأحداث التاريخية.

---

## أمثلة الاستخدام

### معالجة الأحداث الأساسية

```typescript
import { RDAPClient, Event } from 'rdapify';

const client = new RDAPClient({ privacy: true });

async function getDomainEvents(domain: string): Promise<void> {
  try {
    const result = await client.domain(domain);

    // Display key events
    console.log(`Domain events for ${domain}:`);

    result.events.forEach(event => {
      const formattedDate = new Date(event.date).toLocaleDateString();

      console.log(`- ${event.action.replace('-', ' ')}: ${formattedDate}`);

      // Show actor information if available and not redacted
      if (event.actor && !event._meta.redacted) {
        console.log(`  Actor: ${event.actor.name || event.actor.handle}`);
      }

      // Check for imminent expiration
      if (event.action === 'expiration') {
        const daysUntilExpiry = Math.ceil(
          (new Date(event.date).getTime() - Date.now()) / 86400000
        );

        if (daysUntilExpiry < 30) {
          console.warn(`Domain expires in ${daysUntilExpiry} days!`);
        }
      }
    });
  } catch (error) {
    console.error(`Failed to retrieve events for ${domain}:`, error.message);
  }
}

// Usage
getDomainEvents('example.com');
```

### متقدم: رصد الأحداث الأمنية

```typescript
// Monitor for suspicious registration patterns
class SecurityEventMonitor {
  private readonly suspiciousWindows = [
    { hours: 72, transfers: 3, score: 75 },   // 3+ transfers in 72h = high risk
    { hours: 24, registrations: 5, score: 90 }, // 5+ registrations in 24h = critical
    { days: 7, changes: 10, score: 65 }      // 10+ changes in 7d = medium risk
  ];

  async assessEventRisk(events: Event[], context: {
    domain?: string;
    ipRange?: string;
    asn?: number;
  }): Promise<SecurityEventAssessment> {
    // Filter recent events
    const now = Date.now();
    const recentEvents = events.filter(e =>
      (now - e.timestamp) < (7 * 86400000) // Last 7 days
    );

    // Calculate risk score based on patterns
    let riskScore = 0;
    const riskFactors: RiskFactor[] = [];

    // Check for high-frequency transfers
    const transfers = recentEvents.filter(e => e.action === 'transfer');
    if (transfers.length >= 3 && transfers[0].timestamp > now - (72 * 3600000)) {
      riskScore += 75;
      riskFactors.push({
        type: 'frequent-transfers',
        count: transfers.length,
        timeframe: '72h'
      });
    }

    // Check for registration bursts
    const registrations = recentEvents.filter(e => e.action === 'registration');
    if (registrations.length >= 5 && registrations[0].timestamp > now - (24 * 3600000)) {
      riskScore += 90;
      riskFactors.push({
        type: 'registration-burst',
        count: registrations.length,
        timeframe: '24h'
      });
    }

    return {
      domain: context.domain,
      timestamp: new Date().toISOString(),
      riskScore: Math.min(100, riskScore),
      riskLevel: riskScore > 80 ? 'critical' : riskScore > 60 ? 'high' : 'medium',
      riskFactors,
      recommendedAction: this.getRecommendedAction(riskScore)
    };
  }

  private getRecommendedAction(riskScore: number): string {
    if (riskScore > 80) return 'BLOCK_DOMAIN_TRANSFER';
    if (riskScore > 60) return 'MANUAL_REVIEW_REQUIRED';
    return 'CONTINUE_MONITORING';
  }
}

// Usage in security pipeline
const monitor = new SecurityEventMonitor();
const domainResult = await client.domain('suspicious-domain.com');
const assessment = await monitor.assessEventRisk(domainResult.events, {
  domain: 'suspicious-domain.com'
});

if (assessment.riskScore > 70) {
  triggerSecurityAlert(assessment);
}
```

---

## الأنواع ذات الصلة

| النوع | العلاقة | الوصف |
|------|---------|-------|
| [`DomainResponse`](domain-response.md) | حاوية | يحتوي على مصفوفة أحداث دورة حياة النطاق |
| [`IPResponse`](ip-response.md) | حاوية | يحتوي على مصفوفة أحداث دورة حياة تخصيص IP |
| [`ASNResponse`](asn-response.md) | حاوية | يحتوي على مصفوفة أحداث دورة حياة تخصيص ASN |

---

## اعتبارات الأداء

### تحسين معالجة الأحداث

```typescript
// ✅ GOOD: Filter events early to reduce processing
const recentEvents = domainResult.events.filter(e =>
  e.timestamp > Date.now() - (30 * 86400000) // Last 30 days
);

// ✅ GOOD: Use timestamp for fast comparisons instead of parsing dates
const isRecent = event.timestamp > (Date.now() - 86400000); // Last 24 hours

// ✅ GOOD: Lazy parse event attributes only when needed
function getTransferStatus(event: Event): string | undefined {
  if (event.action === 'transfer' && event.attributes) {
    return event.attributes.transferStatus;
  }
  return undefined;
}
```

### أنماط استخدام الذاكرة

خصائص الذاكرة للنوع `Event` قابلة للتنبؤ:
- **حدث بسيط** (الخصائص الأساسية فقط): ~0.3 كيلوبايت
- **حدث قياسي** (مع مُنفِّذ وسمات): ~0.8 كيلوبايت
- **حدث كامل** (مع جميع البيانات الوصفية): ~1.2 كيلوبايت

---

## أنماط الاختبار

### اختبار الوحدة مع متجهات الأحداث

```typescript
// Test event processing logic
describe('Event Processing', () => {
  const testEvents: Event[] = [
    {
      action: 'registration',
      date: '2020-01-15T08:30:00Z',
      timestamp: 1579078200000,
      precision: 'exact',
      actor: { handle: 'REGISTRAR-1', name: 'REDACTED', type: 'registrar' },
      attributes: {},
      _meta: { source: 'verisign', verified: true, confidence: 0.95, redacted: true }
    },
    {
      action: 'last changed',
      date: '2023-05-22T14:45:30Z',
      timestamp: 1684765530000,
      precision: 'exact',
      actor: { handle: 'REGISTRANT-42', name: 'REDACTED', type: 'registrant' },
      attributes: { changedField: 'nameservers' },
      _meta: { source: 'verisign', verified: true, confidence: 0.98, redacted: true }
    },
    {
      action: 'expiration',
      date: '2025-01-15T08:30:00Z',
      timestamp: 1736923800000,
      precision: 'exact',
      attributes: { autoRenew: true },
      _meta: { source: 'verisign', verified: true, confidence: 0.99, redacted: false }
    }
  ];

  test('correctly identifies expiration date', () => {
    const expirationEvent = testEvents.find(e => e.action === 'expiration');
    expect(expirationEvent).toBeDefined();
    expect(new Date(expirationEvent!.date).getFullYear()).toBe(2025);
  });

  test('applies redaction to actor names', () => {
    const registrationEvent = testEvents.find(e => e.action === 'registration');
    expect(registrationEvent?.actor?.name).toBe('REDACTED');
  });
});
```

---

## أوامر CLI لتحليل الأحداث

```bash
# Analyze domain event history
rdapify events example.com --format timeline

# Output format:
# 1995-08-14: registration by REDACTED
# 2023-08-14: last changed by REDACTED
# 2024-08-13: expiration (30 days remaining)

# Security event analysis
rdapify events example.com --security --threshold high

# Export event data for analysis
rdapify events example.com --export csv --output events.csv
```

---

## انظر أيضاً

- [`DomainResponse`](domain-response.md)
- [`IPResponse`](ip-response.md)
- [`ASNResponse`](asn-response.md)
- [ضوابط الخصوصية](../privacy-controls.md)
- [مرجع أنواع الاستجابة](index.md)
