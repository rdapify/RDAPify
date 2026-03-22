# أنواع الأخطاء

مرجع كامل لأنواع الأخطاء الموحَّدة وأنماط معالجتها في RDAPify لبناء تطبيقات متينة وآمنة.

**ذو صلة:** [مرجع Client API](../client.md) | [مرجع أنواع الاستجابة](index.md)

---

## نظرة عامة على نظام الأخطاء

يُنفِّذ RDAPify **نظام معالجة أخطاء منظَّماً** مبنياً على أربعة مبادئ أساسية:

- **الاسترداد المتوقَّع:** كل خطأ يتضمن توجيهات علاجية قابلة للتنفيذ
- **حماية البيانات الشخصية:** لا تُسرِّب كائنات الأخطاء بيانات حساسة أبداً
- **البنية القابلة للمعالجة آلياً:** يمكن معالجة الأخطاء برمجياً
- **السياق المقروء بشرياً:** تفسيرات واضحة لأغراض التصحيح والتسجيل

---

## أنواع الأخطاء الأساسية

### الفئة الأساسية `RDAPError`

```typescript
class RDAPError extends Error {
  constructor(
    public code: string,           // Standardized error code
    public message: string,        // Human-readable description
    public details?: {
      query?: string;              // Sanitized query context
      registryUrl?: string;        // Affected registry (anonymized)
      attemptNumber?: number;      // Retry attempt count
      retryable?: boolean;         // Whether error can be retried
      retryAfter?: number;         // Seconds to wait before retry
      remediation?: string;        // Human-readable fix suggestion
    }
  ) {
    super(message);
    this.name = 'RDAPError';
  }
}
```

**الخصائص الرئيسية:**

| الخاصية | النوع | الوصف | مثال |
|----------|------|-------|------|
| `code` | `string` | معرِّف الخطأ المقروء آلياً | `'RDAP_TIMEOUT'` |
| `message` | `string` | وصف مقروء بشرياً | `'Request timed out after 8000ms'` |
| `privacySafe` | `boolean` | هل الخطأ آمن للتسجيل | `true` |
| `retryable` | `boolean` | هل يمكن إعادة محاولة العملية | `true` |
| `securityCritical` | `boolean` | يستلزم استجابة أمنية فورية | `false` |

### رموز الأخطاء الموحَّدة

| الرمز | الفئة | الوصف | حالة HTTP | قابل للإعادة |
|-------|-------|-------|-----------|-------------|
| `RDAP_INVALID_QUERY` | خطأ العميل | صيغة نطاق/IP غير صالحة | 400 | لا |
| `RDAP_TIMEOUT` | شبكي | انتهت مهلة الطلب | 504 | نعم |
| `RDAP_RATE_LIMITED` | السجل | تجاوز حد معدل الطلبات | 429 | نعم (مع تأخير) |
| `RDAP_REGISTRY_UNAVAILABLE` | السجل | خادم السجل معطَّل | 503 | نعم |
| `RDAP_INVALID_RESPONSE` | البيانات | استجابة RDAP مشوَّهة | 502 | لا |
| `RDAP_BOOTSTRAP_FAILED` | الاكتشاف | بيانات Bootstrap غير متاحة | 503 | نعم |
| `RDAP_SSRF_ATTEMPT` | أمني | محاولة SSRF محظورة | 403 | لا |
| `RDAP_TLS_ERROR` | أمني | فشل التحقق من شهادة TLS | 526 | لا |
| `RDAP_CACHE_ERROR` | النظام | عطل في بنية التخزين المؤقت | 500 | نعم |
| `RDAP_OFFLINE_MODE` | النظام | قيود وضع عدم الاتصال | 503 | لا |
| `RDAP_GDPR_RESTRICTION` | امتثال | قيد GDPR ساري | 451 | لا |
| `RDAP_CCPA_DELETION` | امتثال | طلب حذف CCPA مُنفَّذ | 410 | لا |

### أنواع الأخطاء المتخصصة

#### `SecurityError`

```typescript
class SecurityError extends RDAPError {
  constructor(
    code: string,
    message: string,
    public threatLevel: 'low' | 'medium' | 'high' | 'critical',
    public auditId: string,  // Unique audit identifier
    details?: any
  ) {
    super(code, message, details);
    this.name = 'SecurityError';
  }
}
```

**أخطاء أمنية شائعة:**
- `RDAP_SSRF_ATTEMPT`: محاولة وصول إلى الشبكة الداخلية
- `RDAP_TLS_ERROR`: فشل التحقق من الشهادة
- `RDAP_CACHE_TAMPERING`: اكتُشف تلاعب بسلامة التخزين المؤقت
- `RDAP_AUTH_BYPASS`: محاولة تجاوز المصادقة

#### `ComplianceError`

```typescript
class ComplianceError extends RDAPError {
  constructor(
    code: string,
    message: string,
    public regulation: 'gdpr' | 'ccpa' | 'coppa' | 'other',
    public article?: string,  // Specific regulation article (e.g., 'Article 17')
    details?: any
  ) {
    super(code, message, details);
    this.name = 'ComplianceError';
  }
}
```

**أخطاء امتثال شائعة:**
- `RDAP_GDPR_RESTRICTION`: المعالجة مقيَّدة بموجب GDPR
- `RDAP_CCPA_DELETION`: البيانات محذوفة بناءً على طلب CCPA
- `RDAP_COPPA_PROHIBITED`: المعالجة محظورة للأطفال بموجب COPPA
- `RDAP_DATA_SUBJECT_REQUEST`: حقوق صاحب البيانات سارية

#### `NetworkError`

```typescript
class NetworkError extends RDAPError {
  constructor(
    code: string,
    message: string,
    public networkDetails?: {
      dnsError?: string;
      connectionRefused?: boolean;
      timeoutType?: 'connect' | 'read' | 'write';
      protocol?: 'http' | 'https';
    },
    details?: any
  ) {
    super(code, message, details);
    this.name = 'NetworkError';
  }
}
```

**أخطاء شبكية شائعة:**
- `RDAP_DNS_FAILURE`: فشل حل DNS
- `RDAP_CONNECTION_REFUSED`: رُفض الاتصال صراحةً
- `RDAP_READ_TIMEOUT`: نجح الاتصال لكن انتهت مهلة القراءة
- `RDAP_NETWORK_UNREACHABLE`: مسار الشبكة غير متاح

---

## الأمان وحماية البيانات الشخصية

### حماية البيانات الشخصية في الأخطاء

يُطهِّر RDAPify كائنات الأخطاء تلقائياً لمنع تسرُّب البيانات:

```typescript
// Before sanitization
{
  code: 'RDAP_REGISTRY_UNAVAILABLE',
  message: 'Registry unavailable for example.com',
  details: {
    query: 'example.com',
    registryUrl: 'https://rdap.verisign.com'
  }
}

// After sanitization for logging
{
  code: 'RDAP_REGISTRY_UNAVAILABLE',
  message: 'Registry unavailable for [REDACTED]',
  details: {
    registryUrl: 'https://rdap.************.com' // Partially redacted
  }
}
```

**قواعد التطهير:**
- أسماء النطاقات ← `[REDACTED]`
- عناوين IP ← `[REDACTED_IP]`
- عناوين البريد الإلكتروني ← `[REDACTED_EMAIL]`
- عناوين URL للسجلات ← نطاقات مُخفاة جزئياً
- استجابات RDAP الخام ← لا تُدرَج في كائنات الأخطاء أبداً

---

## أمثلة الاستخدام

### المعالجة الأساسية للأخطاء

```typescript
import { RDAPError, RDAPErrorCode } from 'rdapify';

const client = new RDAPClient();

try {
  const result = await client.domain('example.com');
  console.log('Success:', result);
} catch (error) {
  if (error instanceof RDAPError) {
    handleRDAPError(error);
  } else {
    throw error; // Re-throw non-RDAP errors
  }
}

function handleRDAPError(error: RDAPError): void {
  switch (error.code) {
    case 'RDAP_RATE_LIMITED':
      console.log(`Rate limited. Retry after: ${error.details?.retryAfter} seconds`);
      // Implement exponential backoff
      break;

    case 'RDAP_SSRF_ATTEMPT':
      console.error('SECURITY ALERT: SSRF attempt blocked');
      // Notify security team immediately
      securityTeam.notify(error);
      break;

    case 'RDAP_TIMEOUT':
      console.log('Request timed out. Consider increasing timeout or checking connectivity');
      break;

    default:
      console.error('Unexpected RDAP error:', error.message);
      logger.error('RDAP query failed', {
        code: error.code,
        message: error.message,
        // Safe context only
        registryType: error.details?.registryUrl?.includes('verisign') ? 'verisign' : 'other'
      });
  }
}
```

### نمط متقدم: نظام تصنيف الأخطاء

```typescript
// Comprehensive error handling with classification
function classifyError(error: RDAPError): ErrorClassification {
  return {
    category: getErrorCategory(error.code),
    severity: getErrorSeverity(error),
    remediation: getRemediationStrategy(error),
    securityImpact: getSecurityImpact(error),
    complianceRisk: getComplianceRisk(error),
    recommendedAction: getRecommendedAction(error)
  };
}

function getErrorCategory(code: string): string {
  const categories = {
    'RDAP_INVALID_QUERY': 'client-error',
    'RDAP_TIMEOUT': 'network-error',
    'RDAP_RATE_LIMITED': 'registry-error',
    'RDAP_REGISTRY_UNAVAILABLE': 'registry-error',
    'RDAP_SSRF_ATTEMPT': 'security-error',
    'RDAP_GDPR_RESTRICTION': 'compliance-error'
  };
  return categories[code as keyof typeof categories] || 'unknown';
}

// Usage in monitoring system
const error = new RDAPError('RDAP_RATE_LIMITED', 'Rate limit exceeded', {
  retryAfter: 60,
  registryUrl: 'https://rdap.verisign.com'
});

const classification = classifyError(error);
console.log('Error classification:', classification);
/*
{
  category: 'registry-error',
  severity: 'medium',
  remediation: 'exponential-backoff',
  securityImpact: 'low',
  complianceRisk: 'none',
  recommendedAction: 'wait-and-retry'
}
*/
```

### معالجة الأخطاء المتعلقة بالامتثال

```typescript
// GDPR-compliant error handling
async function handleDomainQuery(domain: string) {
  try {
    return await client.domain(domain);
  } catch (error) {
    if (error instanceof ComplianceError) {
      switch (error.code) {
        case 'RDAP_GDPR_RESTRICTION':
          // Log compliance event with anonymized data
          await complianceLogger.log({
            event: 'gdpr-restriction',
            domainHash: hashDomain(domain),
            regulation: error.regulation,
            article: error.article
          });

          // Return generic error without revealing restriction details
          throw new RDAPError(
            'RDAP_COMPLIANCE_RESTRICTED',
            'Domain information unavailable due to regulatory restrictions',
            { privacySafe: true }
          );

        case 'RDAP_CCPA_DELETION':
          // Honor deletion request
          await client.clearCache({ byDomain: domain });

          throw new RDAPError(
            'RDAP_DATA_DELETED',
            'Domain information has been deleted per legal request',
            { privacySafe: true }
          );
      }
    }

    // Re-throw other errors
    throw error;
  }
}
```

---

## الأنماط المُوصى بها وتلك التي يجب تجنبها

### الأنماط الجيدة

```typescript
// ✅ GOOD: Security-focused error handling
try {
  await client.domain('user-input.com');
} catch (error) {
  if (isSecurityError(error)) {
    // Log full details securely
    await securityLogger.log('security-incident', {
      code: error.code,
      details: error.details,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Return sanitized error to user
    throw new RDAPError(
      'SECURITY_RESTRICTION',
      'Request blocked due to security policy',
      { privacySafe: true }
    );
  }

  // Handle other errors normally
}
```

### الأنماط التي يجب تجنبها

```typescript
// ❌ AVOID: PII leakage in logs
try {
  await client.domain('sensitive-domain.com');
} catch (error) {
  console.error('Query failed for', error.details?.query); // Leaks domain name
}

// ❌ AVOID: Generic error handling
try {
  await client.domain('example.com');
} catch (error) {
  throw new Error('Operation failed'); // Loses all context
}

// ❌ AVOID: Silent error swallowing
try {
  await client.domain('example.com');
} catch (error) {
  // No logging, no recovery, no notification
  return null;
}
```

---

## الأنواع ذات الصلة

| النوع | العلاقة | الوصف |
|------|---------|-------|
| [`RDAPError`](#الفئة-الأساسية-rdaperror) | فئة أساسية | نوع الخطأ الجذر لجميع أخطاء RDAPify |
| [`SecurityError`](#securityerror) | تخصيص | الأخطاء المستلزِمة استجابة أمنية |
| [`ComplianceError`](#complianceerror) | تخصيص | الأخطاء المتعلقة بالامتثال التنظيمي |
| [`NetworkError`](#networkerror) | تخصيص | مشكلات الاتصال بالشبكة |

---

## الامتثال لمعايير البروتوكول

### معايير أخطاء RFC

يُنفِّذ RDAPify استجابات الأخطاء الموحَّدة وفق مواصفات RFC:

| RFC | نوع الخطأ | التنفيذ |
|-----|----------|---------|
| **RFC 7480** | استجابات أخطاء RDAP | صيغة الخطأ `application/rdap+json` |
| **RFC 5730** | رموز أخطاء EPP | مُعيَّنة إلى رموز أخطاء RDAP |
| **RFC 6761** | أسماء نطاقات الاستخدام الخاص | معالجة خاصة للنطاقات المحجوزة |
| **RFC 6890** | عناوين IP ذات الأغراض الخاصة | محظورة برمز `RDAP_SSRF_ATTEMPT` |

---

## انظر أيضاً

- [مرجع RDAPClient](../client.md)
- [ضوابط الخصوصية](../privacy-controls.md)
- [نوع Contact](contact.md)
- [مرجع أنواع الاستجابة](index.md)
